/**
 * GET /api/delivery/admin/tour-rueckkehr-eta?location_id=<uuid>
 *
 * Phase 884 — Tour-Rückkehr-ETA-API
 * Estimated-Time-to-Base je aktiver Tour: verbleibende Stopps × 5 Min + Haversine Rückfahrt.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const KMH = 30;
const MIN_PER_STOP = 5;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function resolveLocationId(req: NextRequest): Promise<string | null> {
  const fromQuery = new URL(req.url).searchParams.get('location_id');
  if (fromQuery) return fromQuery;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data: emp } = await sb
    .from('employees')
    .select('location_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return emp?.location_id ?? null;
}

export async function GET(req: NextRequest) {
  const locationId = await resolveLocationId(req);
  if (!locationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sb = await createClient();
  const now = new Date();

  const { data: locData } = await sb
    .from('locations')
    .select('lat, lng')
    .eq('id', locationId)
    .maybeSingle();
  const hubLat: number = (locData as { lat: number; lng: number } | null)?.lat ?? 48.1351;
  const hubLng: number = (locData as { lat: number; lng: number } | null)?.lng ?? 11.582;

  const { data: batches } = await sb
    .from('delivery_batches')
    .select('id, fahrer_id, startzeit, zone')
    .eq('location_id', locationId)
    .eq('status', 'unterwegs');

  if (!batches || batches.length === 0) {
    return NextResponse.json({ touren: [], avg_etb_min: 0, generatedAt: now.toISOString() });
  }

  type BatchRow = { id: string; fahrer_id: string | null; startzeit: string | null; zone: string | null };
  const typedBatches = batches as BatchRow[];
  const batchIds = typedBatches.map(b => b.id);
  const driverIds = typedBatches.map(b => b.fahrer_id).filter((x): x is string => x !== null);

  const [{ data: stops }, { data: driversRaw }] = await Promise.all([
    sb.from('delivery_stops')
      .select('id, batch_id, geliefert_am, lat, lng')
      .in('batch_id', batchIds),
    sb.from('employees')
      .select('id, vorname, nachname, current_lat, current_lng')
      .in('id', driverIds),
  ]);

  type StopRow = { id: string; batch_id: string; geliefert_am: string | null; lat: number | null; lng: number | null };
  type DriverRow = { id: string; vorname: string; nachname: string; current_lat: number | null; current_lng: number | null };

  const typedStops = (stops as StopRow[] | null) ?? [];
  const typedDrivers = (driversRaw as DriverRow[] | null) ?? [];

  const touren = typedBatches.map(batch => {
    const driver = typedDrivers.find(d => d.id === batch.fahrer_id);
    const batchStops = typedStops.filter(s => s.batch_id === batch.id);
    const pending = batchStops.filter(s => !s.geliefert_am);
    const done = batchStops.length - pending.length;

    const driverLat = driver?.current_lat ?? hubLat;
    const driverLng = driver?.current_lng ?? hubLng;

    const stopTimeMin = pending.length * MIN_PER_STOP;
    const lastStop = pending[pending.length - 1];
    const fromLat = lastStop?.lat ?? driverLat;
    const fromLng = lastStop?.lng ?? driverLng;
    const returnKm = haversineKm(fromLat, fromLng, hubLat, hubLng);
    const returnMin = Math.round((returnKm / KMH) * 60);
    const etbMin = stopTimeMin + returnMin;

    const etbTime = new Date(now.getTime() + etbMin * 60_000);
    const etbUhrzeit = etbTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' });

    const elapsedMin = batch.startzeit
      ? Math.round((now.getTime() - new Date(batch.startzeit).getTime()) / 60_000)
      : 0;

    return {
      tour_id: batch.id,
      fahrer_id: batch.fahrer_id,
      fahrer_name: driver ? `${driver.vorname} ${driver.nachname}` : 'Fahrer',
      zone: batch.zone ?? '?',
      total_stopps: batchStops.length,
      erledigte_stopps: done,
      verbleibende_stopps: pending.length,
      stopps_min: stopTimeMin,
      rueckfahrt_km: Math.round(returnKm * 10) / 10,
      rueckfahrt_min: returnMin,
      etb_min: etbMin,
      etb_uhrzeit: etbUhrzeit,
      elapsed_min: elapsedMin,
      status: pending.length === 0 ? 'rueckfahrt' : pending.length === 1 ? 'letzter_stopp' : 'unterwegs',
    };
  });

  touren.sort((a, b) => a.etb_min - b.etb_min);

  const avg_etb_min = touren.length > 0
    ? Math.round(touren.reduce((s, t) => s + t.etb_min, 0) / touren.length)
    : 0;

  return NextResponse.json({
    touren,
    avg_etb_min,
    aktive_touren: touren.length,
    generatedAt: now.toISOString(),
  });
}
