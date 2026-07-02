/**
 * GET /api/delivery/admin/tour-effizienz-realtime
 *
 * Tour-Effizienz je aktiver Tour in Echtzeit:
 *   - Ø km/Lieferung (aus gps_events Distanz-Delta)
 *   - Ø Min/Stop
 *   - Profitabilität: Liefergebühren – Fahrerkosten (0,20 €/km + 10 €/h)
 * Phase 518
 *
 * Query: ?location_id=<uuid>
 * Response: { ok, touren: TourEffizienzRow[], generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface TourEffizienzRow {
  batchId: string;
  driverName: string | null;
  stopsGesamt: number;
  stopsDone: number;
  avgMinProStop: number | null;
  estimatedKm: number | null;
  kmProLieferung: number | null;
  liefergebuehrenEur: number | null;
  fahrerKostenEur: number | null;
  profitEur: number | null;
  startedAt: string | null;
  elapsedMin: number;
}

export interface TourEffizienzRealtimeResponse {
  ok: boolean;
  touren: TourEffizienzRow[];
  generatedAt: string;
}

const KM_COST_PER_KM = 0.20;
const DRIVER_COST_PER_H = 10.0;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const param = new URL(req.url).searchParams.get('location_id');
  if (param) return param;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const svc = createServiceClient();
  const { data: emp } = await svc
    .from('employees')
    .select('location_id')
    .eq('user_id', user.id)
    .maybeSingle();
  return (emp as { location_id: string } | null)?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  try {
    const locationId = await resolveLocationId(req);
    if (!locationId) return NextResponse.json({ error: 'location_id fehlt' }, { status: 400 });

    const svc = createServiceClient();
    const now = new Date();
    const since8h = new Date(now.getTime() - 8 * 3600_000).toISOString();

    // Aktive Batches
    const { data: batches } = await svc
      .from('delivery_batches')
      .select('id, driver_id, created_at, status')
      .eq('location_id', locationId)
      .in('status', ['pickup', 'unterwegs', 'assigned', 'at_restaurant', 'on_route', 'pending_acceptance'])
      .gte('created_at', since8h);

    if (!batches || (batches as unknown[]).length === 0) {
      return NextResponse.json<TourEffizienzRealtimeResponse>({
        ok: true,
        touren: [],
        generatedAt: now.toISOString(),
      });
    }

    const batchList = batches as { id: string; driver_id: string | null; created_at: string; status: string }[];
    const batchIds = batchList.map((b) => b.id);
    const driverIds = [...new Set(batchList.map((b) => b.driver_id).filter(Boolean))] as string[];

    // Stops je Batch
    const { data: stopsData } = await svc
      .from('delivery_tour_stops')
      .select('id, batch_id, status, angekommen_am, geliefert_am, delivery_fee')
      .in('batch_id', batchIds)
      .eq('location_id', locationId);

    // Fahrernamen
    const { data: driversData } = await svc
      .from('employees')
      .select('id, name')
      .in('id', driverIds.length > 0 ? driverIds : ['00000000-0000-0000-0000-000000000000']);

    // GPS-Events für Distanz-Schätzung
    const { data: gpsData } = await svc
      .from('driver_gps_events')
      .select('driver_id, lat, lng, recorded_at')
      .eq('location_id', locationId)
      .in('driver_id', driverIds.length > 0 ? driverIds : ['00000000-0000-0000-0000-000000000000'])
      .gte('recorded_at', since8h)
      .order('recorded_at', { ascending: true });

    type StopRow = { id: string; batch_id: string; status: string; angekommen_am: string | null; geliefert_am: string | null; delivery_fee: number | null };
    type DriverRow = { id: string; name: string };
    type GpsRow = { driver_id: string; lat: number; lng: number; recorded_at: string };

    const stops = (stopsData as StopRow[] | null) ?? [];
    const drivers = (driversData as DriverRow[] | null) ?? [];
    const gpsEvents = (gpsData as GpsRow[] | null) ?? [];

    const driverNameMap = new Map(drivers.map((d) => [d.id, d.name]));

    // GPS-Distanz je Fahrer berechnen
    const gpsDistanceMap = new Map<string, number>();
    for (const dId of driverIds) {
      const events = gpsEvents.filter((g) => g.driver_id === dId);
      let km = 0;
      for (let i = 1; i < events.length; i++) {
        const prev = events[i - 1];
        const curr = events[i];
        const delta = haversineKm(prev.lat, prev.lng, curr.lat, curr.lng);
        if (delta < 50) km += delta; // Ausreißer >50km/Segment ignorieren
      }
      gpsDistanceMap.set(dId, Math.round(km * 10) / 10);
    }

    const touren: TourEffizienzRow[] = batchList.map((batch) => {
      const batchStops = stops.filter((s) => s.batch_id === batch.id);
      const doneStops = batchStops.filter((s) => s.status === 'geliefert');

      // Ø Min/Stop aus angekommen_am→geliefert_am
      const stopDurations = doneStops
        .filter((s) => s.angekommen_am && s.geliefert_am)
        .map((s) =>
          (new Date(s.geliefert_am!).getTime() - new Date(s.angekommen_am!).getTime()) / 60_000
        );
      const avgMinProStop = stopDurations.length > 0
        ? Math.round((stopDurations.reduce((a, b) => a + b, 0) / stopDurations.length) * 10) / 10
        : null;

      const estimatedKm = batch.driver_id ? (gpsDistanceMap.get(batch.driver_id) ?? null) : null;
      const liefCount = Math.max(doneStops.length, 1);
      const kmProLieferung = estimatedKm !== null ? Math.round((estimatedKm / liefCount) * 10) / 10 : null;

      const elapsedMin = Math.round((now.getTime() - new Date(batch.created_at).getTime()) / 60_000);
      const elapsedH = elapsedMin / 60;

      const liefergebuehrenEur = doneStops.reduce((sum, s) => sum + (s.delivery_fee ?? 0), 0) || null;
      const fahrerKostenEur = estimatedKm !== null
        ? Math.round((estimatedKm * KM_COST_PER_KM + elapsedH * DRIVER_COST_PER_H) * 100) / 100
        : null;
      const profitEur = liefergebuehrenEur !== null && fahrerKostenEur !== null
        ? Math.round((liefergebuehrenEur - fahrerKostenEur) * 100) / 100
        : null;

      return {
        batchId: batch.id,
        driverName: batch.driver_id ? (driverNameMap.get(batch.driver_id) ?? null) : null,
        stopsGesamt: batchStops.length,
        stopsDone: doneStops.length,
        avgMinProStop,
        estimatedKm,
        kmProLieferung,
        liefergebuehrenEur,
        fahrerKostenEur,
        profitEur,
        startedAt: batch.created_at,
        elapsedMin,
      };
    });

    return NextResponse.json<TourEffizienzRealtimeResponse>({
      ok: true,
      touren: touren.sort((a, b) => b.elapsedMin - a.elapsedMin),
      generatedAt: now.toISOString(),
    });
  } catch (err) {
    console.error('[tour-effizienz-realtime]', err);
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 });
  }
}
