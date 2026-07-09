/**
 * GET /api/delivery/admin/fahrer-performance-vergleich?location_id=<uuid>&driver_id_a=<uuid>&driver_id_b=<uuid>
 *
 * Phase 966 — Fahrer-Performance-Vergleich-API (Backend)
 * Direkter Leistungsvergleich zweier Fahrer: Stopps/h, Pünktlichkeit, Bewertung, Umsatz
 * für die letzten 30 Tage. Multi-Tenant via location_id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface FahrerStats {
  driver_id: string;
  fahrer_name: string;
  vehicle: string | null;
  touren: number;
  stopps: number;
  stopps_pro_h: number;
  puenktlichkeit_pct: number;
  bewertung_avg: number;
  umsatz_eur: number;
  km_gesamt: number;
  gesamtscore: number;
}

function calcScore(puenktlichkeitPct: number, stoppsPh: number, bewertungAvg: number): number {
  const pScore = puenktlichkeitPct * 0.45;
  const sScore = Math.min(stoppsPh * 8, 35);
  const bScore = bewertungAvg > 0 ? (bewertungAvg / 5) * 20 : 0;
  return Math.min(100, Math.round(pScore + sScore + bScore));
}

function mockFahrerStats(driverId: string, name: string, seed: number): FahrerStats {
  const touren = 18 + seed * 3;
  const stopps = touren * (3 + seed);
  const stoppsPh = 3.5 + seed * 0.5;
  const puenktlichkeit = 78 + seed * 7;
  const bewertung = 4.1 + seed * 0.2;
  const umsatz = touren * (12 + seed * 2);
  const km = touren * (8 + seed);
  return {
    driver_id: driverId,
    fahrer_name: name,
    vehicle: seed % 2 === 0 ? 'bike' : 'car',
    touren,
    stopps,
    stopps_pro_h: Math.round(stoppsPh * 10) / 10,
    puenktlichkeit_pct: Math.min(100, puenktlichkeit),
    bewertung_avg: Math.min(5, Math.round(bewertung * 10) / 10),
    umsatz_eur: Math.round(umsatz * 100) / 100,
    km_gesamt: Math.round(km * 10) / 10,
    gesamtscore: calcScore(Math.min(100, puenktlichkeit), stoppsPh, Math.min(5, bewertung)),
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const locationId = url.searchParams.get('location_id');
  const driverIdA = url.searchParams.get('driver_id_a');
  const driverIdB = url.searchParams.get('driver_id_b');

  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  if (!driverIdA || !driverIdB) return NextResponse.json({ error: 'driver_id_a und driver_id_b required' }, { status: 400 });

  const sb = await createClient();
  const now = new Date();
  const vor30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  try {
    const driverIds = [driverIdA, driverIdB];

    // Driver names
    const { data: drivers } = await sb
      .from('mise_drivers')
      .select('id, vorname, nachname, vehicle_type')
      .in('id', driverIds);

    // Batches for both drivers in last 30 days
    const { data: batches } = await sb
      .from('delivery_batches')
      .select('id, driver_id, started_at, completed_at, created_at')
      .eq('location_id', locationId)
      .in('driver_id', driverIds)
      .gte('created_at', vor30d.toISOString());

    if (!batches || batches.length === 0) {
      return NextResponse.json({
        ok: true,
        fahrer_a: mockFahrerStats(driverIdA, 'Fahrer A', 1),
        fahrer_b: mockFahrerStats(driverIdB, 'Fahrer B', 2),
        generatedAt: now.toISOString(),
        mock: true,
      });
    }

    const batchIds = batches.map((b) => b.id);

    const [stopsRes, ordersRes, ratingsRes] = await Promise.all([
      sb.from('delivery_stops')
        .select('id, batch_id, driver_id, delivered_at, eta_at, distance_km')
        .in('batch_id', batchIds),
      sb.from('orders')
        .select('id, batch_id, driver_id, delivery_fee')
        .in('batch_id', batchIds)
        .eq('location_id', locationId),
      sb.from('driver_ratings')
        .select('driver_id, rating, created_at')
        .in('driver_id', driverIds)
        .gte('created_at', vor30d.toISOString()),
    ]);

    const driverMap = new Map<string, string>();
    const vehicleMap = new Map<string, string | null>();
    for (const d of drivers ?? []) {
      const id = d.id as string;
      driverMap.set(id, `${d.vorname ?? ''} ${d.nachname ?? ''}`.trim() || 'Fahrer');
      vehicleMap.set(id, (d.vehicle_type as string | null) ?? null);
    }

    function buildStats(driverId: string): FahrerStats {
      const fahrerBatches = (batches ?? []).filter((b) => b.driver_id === driverId);
      const bIds = fahrerBatches.map((b) => b.id);
      const fahrerStopps = (stopsRes.data ?? []).filter((s) => bIds.includes(s.batch_id));

      const puenktlich = fahrerStopps.filter((s) => {
        const del = (s as { delivered_at?: string | null }).delivered_at;
        const eta = (s as { eta_at?: string | null }).eta_at;
        if (!del || !eta) return true;
        return new Date(del) <= new Date(eta);
      }).length;
      const puenktlichkeitPct = fahrerStopps.length > 0
        ? Math.round((puenktlich / fahrerStopps.length) * 100)
        : 100;

      let gesamtDauerH = 0;
      for (const b of fahrerBatches) {
        const start = (b as { started_at?: string | null }).started_at;
        const end = (b as { completed_at?: string | null }).completed_at;
        if (start && end) {
          gesamtDauerH += (new Date(end).getTime() - new Date(start).getTime()) / 3_600_000;
        }
      }
      const stoppsPh = gesamtDauerH > 0
        ? Math.round((fahrerStopps.length / gesamtDauerH) * 10) / 10
        : 0;

      const fahrerRatings = (ratingsRes.data ?? []).filter((r) => r.driver_id === driverId);
      const bewertungAvg = fahrerRatings.length > 0
        ? Math.round((fahrerRatings.reduce((s, r) => s + (r.rating ?? 0), 0) / fahrerRatings.length) * 10) / 10
        : 0;

      const fahrerOrders = (ordersRes.data ?? []).filter((o) => bIds.includes(o.batch_id));
      const umsatzEur = Math.round(
        fahrerOrders.reduce((s, o) => s + ((o.delivery_fee as number | null) ?? 0), 0) * 100,
      ) / 100;

      const kmGesamt = Math.round(
        fahrerStopps.reduce((s, st) => s + ((st as { distance_km?: number | null }).distance_km ?? 2), 0) * 10,
      ) / 10;

      return {
        driver_id: driverId,
        fahrer_name: driverMap.get(driverId) ?? 'Fahrer',
        vehicle: vehicleMap.get(driverId) ?? null,
        touren: fahrerBatches.length,
        stopps: fahrerStopps.length,
        stopps_pro_h: stoppsPh,
        puenktlichkeit_pct: puenktlichkeitPct,
        bewertung_avg: bewertungAvg,
        umsatz_eur: umsatzEur,
        km_gesamt: kmGesamt,
        gesamtscore: calcScore(puenktlichkeitPct, stoppsPh, bewertungAvg),
      };
    }

    return NextResponse.json({
      ok: true,
      fahrer_a: buildStats(driverIdA),
      fahrer_b: buildStats(driverIdB),
      zeitraum_tage: 30,
      generatedAt: now.toISOString(),
    });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Unbekannter Fehler' },
      { status: 500 },
    );
  }
}
