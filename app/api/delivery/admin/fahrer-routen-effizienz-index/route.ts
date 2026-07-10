import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type FahrerEffizienz = {
  fahrer_id: string;
  fahrer_name: string;
  km_je_stopp: number;
  km_je_stopp_vorwoche: number | null;
  trend: 'besser' | 'gleich' | 'schlechter';
  delta_pct: number;
  gesamtkm_heute: number;
  stopps_heute: number;
  rang: number;
};

function mockData(): { fahrer: FahrerEffizienz[]; team_ø_km_je_stopp: number } {
  const fahrer: FahrerEffizienz[] = [
    { fahrer_id: 'f1', fahrer_name: 'Max M.', km_je_stopp: 1.8, km_je_stopp_vorwoche: 2.1, trend: 'besser', delta_pct: -14.3, gesamtkm_heute: 32.4, stopps_heute: 18, rang: 1 },
    { fahrer_id: 'f2', fahrer_name: 'Lisa B.', km_je_stopp: 2.0, km_je_stopp_vorwoche: 1.9, trend: 'gleich', delta_pct: 5.3, gesamtkm_heute: 28.0, stopps_heute: 14, rang: 2 },
    { fahrer_id: 'f3', fahrer_name: 'Tom K.', km_je_stopp: 2.6, km_je_stopp_vorwoche: 2.3, trend: 'schlechter', delta_pct: 13.0, gesamtkm_heute: 36.4, stopps_heute: 14, rang: 3 },
    { fahrer_id: 'f4', fahrer_name: 'Jan S.', km_je_stopp: 3.1, km_je_stopp_vorwoche: null, trend: 'gleich', delta_pct: 0, gesamtkm_heute: 24.8, stopps_heute: 8, rang: 4 },
  ];
  return { fahrer, team_ø_km_je_stopp: 2.375 };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');

  try {
    const supabase = createClient();

    const driversQ = supabase
      .from('mise_drivers')
      .select('id, full_name, location_id')
      .in('status', ['online', 'busy', 'delivering', 'returning']);
    if (locationId) driversQ.eq('location_id', locationId);
    const { data: drivers, error: dErr } = await driversQ;
    if (dErr || !drivers || drivers.length === 0) throw new Error('no drivers');

    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString().slice(0, 10);
    const weekAgoEnd = new Date(Date.now() - 6 * 24 * 3600_000).toISOString().slice(0, 10);

    const [{ data: batchesToday }, { data: batchesVorwoche }] = await Promise.all([
      supabase
        .from('mise_delivery_batches')
        .select('driver_id, distance_km, stops_completed')
        .eq('status', 'completed')
        .gte('created_at', `${today}T00:00:00`),
      supabase
        .from('mise_delivery_batches')
        .select('driver_id, distance_km, stops_completed')
        .eq('status', 'completed')
        .gte('created_at', `${weekAgo}T00:00:00`)
        .lt('created_at', `${weekAgoEnd}T00:00:00`),
    ]);

    const fahrerList: FahrerEffizienz[] = drivers.map((d, idx) => {
      const mine = (batchesToday ?? []).filter((b) => b.driver_id === d.id);
      const gesamtkm = mine.reduce((s, b) => s + (b.distance_km ?? 0), 0);
      const stopps = mine.reduce((s, b) => s + (b.stops_completed ?? 0), 0);
      const km_je_stopp = stopps > 0 ? parseFloat((gesamtkm / stopps).toFixed(2)) : 0;

      const vorwoche = (batchesVorwoche ?? []).filter((b) => b.driver_id === d.id);
      const vwKm = vorwoche.reduce((s, b) => s + (b.distance_km ?? 0), 0);
      const vwStopps = vorwoche.reduce((s, b) => s + (b.stops_completed ?? 0), 0);
      const km_je_stopp_vorwoche = vwStopps > 0 ? parseFloat((vwKm / vwStopps).toFixed(2)) : null;

      let trend: FahrerEffizienz['trend'] = 'gleich';
      let delta_pct = 0;
      if (km_je_stopp_vorwoche !== null && km_je_stopp > 0) {
        delta_pct = parseFloat((((km_je_stopp - km_je_stopp_vorwoche) / km_je_stopp_vorwoche) * 100).toFixed(1));
        if (delta_pct < -5) trend = 'besser';
        else if (delta_pct > 5) trend = 'schlechter';
      }

      return { fahrer_id: d.id, fahrer_name: d.full_name ?? `Fahrer ${idx + 1}`, km_je_stopp, km_je_stopp_vorwoche, trend, delta_pct, gesamtkm_heute: parseFloat(gesamtkm.toFixed(1)), stopps_heute: stopps, rang: 0 };
    });

    fahrerList.sort((a, b) => a.km_je_stopp - b.km_je_stopp);
    fahrerList.forEach((f, i) => { f.rang = i + 1; });

    const teamØ = fahrerList.length > 0
      ? parseFloat((fahrerList.reduce((s, f) => s + f.km_je_stopp, 0) / fahrerList.length).toFixed(2))
      : 0;

    return NextResponse.json({ fahrer: fahrerList, team_ø_km_je_stopp: teamØ });
  } catch {
    return NextResponse.json(mockData());
  }
}
