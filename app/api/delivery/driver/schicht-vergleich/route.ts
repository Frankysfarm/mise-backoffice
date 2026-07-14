/**
 * GET /api/delivery/driver/schicht-vergleich?driver_id=<uuid>
 *
 * Phase 1505 supporting API — Schicht-Vergleich
 * Stopps/Verdienst/km/Ø Lieferzeit heute vs. gleicher Wochentag Vorwoche.
 * Supabase + Mock-Fallback.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SchichtVergleich {
  stopps_heute: number;
  stopps_vorwoche: number;
  verdienst_heute_eur: number;
  verdienst_vorwoche_eur: number;
  km_heute: number;
  km_vorwoche: number;
  lieferzeit_heute_min: number;
  lieferzeit_vorwoche_min: number;
}

function buildMock(driverId: string): SchichtVergleich {
  const seed = (driverId.charCodeAt(0) ?? 65) % 5;
  return {
    stopps_heute: 8 + seed,
    stopps_vorwoche: 7 + seed,
    verdienst_heute_eur: parseFloat(((8 + seed) * 4.2).toFixed(2)),
    verdienst_vorwoche_eur: parseFloat(((7 + seed) * 4.2).toFixed(2)),
    km_heute: 22 + seed * 2,
    km_vorwoche: 25 + seed * 2,
    lieferzeit_heute_min: 28 - seed,
    lieferzeit_vorwoche_min: 30 - seed,
  };
}

export async function GET(req: NextRequest) {
  const driverId = req.nextUrl.searchParams.get('driver_id');
  if (!driverId) {
    return NextResponse.json({ error: 'driver_id required' }, { status: 400 });
  }

  try {
    const sb = await createClient();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const vorwocheStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
    const vorwocheEnd = new Date(vorwocheStart.getTime() + 24 * 60 * 60 * 1000);

    const { data: tagesBatches } = await (sb as any)
      .from('mise_delivery_batches')
      .select('id, total_distance_km, trinkgeld_eur, fahrerlohn_eur')
      .eq('driver_id', driverId)
      .gte('created_at', todayStart.toISOString());

    const { data: vorwocheBatches } = await (sb as any)
      .from('mise_delivery_batches')
      .select('id, total_distance_km, trinkgeld_eur, fahrerlohn_eur')
      .eq('driver_id', driverId)
      .gte('created_at', vorwocheStart.toISOString())
      .lt('created_at', vorwocheEnd.toISOString());

    type BatchRow = { id: string; total_distance_km?: number; trinkgeld_eur?: number; fahrerlohn_eur?: number };
    type StoppRow = { batch_id: string; geliefert_am?: string; versucht_um?: string };

    const tbIds = (tagesBatches as BatchRow[] ?? []).map(b => b.id);
    const vbIds = (vorwocheBatches as BatchRow[] ?? []).map(b => b.id);

    if (tbIds.length === 0 && vbIds.length === 0) {
      return NextResponse.json(buildMock(driverId));
    }

    const fetchStopps = async (ids: string[]): Promise<StoppRow[]> => {
      if (ids.length === 0) return [];
      const { data } = await (sb as any)
        .from('mise_delivery_stops')
        .select('batch_id, geliefert_am, versucht_um')
        .in('batch_id', ids)
        .not('geliefert_am', 'is', null);
      return (data as StoppRow[]) ?? [];
    };

    const [tagesStopps, vorwocheStopps] = await Promise.all([
      fetchStopps(tbIds),
      fetchStopps(vbIds),
    ]);

    function avgLieferzeit(stopps: StoppRow[]): number {
      const diffs = stopps
        .filter(s => s.geliefert_am && s.versucht_um)
        .map(s => (new Date(s.geliefert_am!).getTime() - new Date(s.versucht_um!).getTime()) / 60_000)
        .filter(d => d > 0 && d < 120);
      if (diffs.length === 0) return 0;
      return Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
    }

    function sumKm(batches: BatchRow[]): number {
      return Math.round(batches.reduce((s, b) => s + (b.total_distance_km ?? 0), 0));
    }

    function sumVerdienst(batches: BatchRow[]): number {
      return parseFloat(batches.reduce((s, b) => s + (b.fahrerlohn_eur ?? 0) + (b.trinkgeld_eur ?? 0), 0).toFixed(2));
    }

    const response: SchichtVergleich = {
      stopps_heute: tagesStopps.length,
      stopps_vorwoche: vorwocheStopps.length,
      verdienst_heute_eur: sumVerdienst(tagesBatches as BatchRow[] ?? []),
      verdienst_vorwoche_eur: sumVerdienst(vorwocheBatches as BatchRow[] ?? []),
      km_heute: sumKm(tagesBatches as BatchRow[] ?? []),
      km_vorwoche: sumKm(vorwocheBatches as BatchRow[] ?? []),
      lieferzeit_heute_min: avgLieferzeit(tagesStopps),
      lieferzeit_vorwoche_min: avgLieferzeit(vorwocheStopps),
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(buildMock(driverId));
  }
}
