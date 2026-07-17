import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerKmEffizienz {
  driver_id: string;
  name: string;
  km_per_auftrag: number;
  auftraege: number;
  effizienz_score: number; // 0–100 (100 = beste Effizienz)
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_delta: number;
  alert: boolean;
}

export interface FahrerKmEffizienzResponse {
  location_id: string;
  fahrer: FahrerKmEffizienz[];
  team_avg_km: number;
  alert_count: number;
  generiert_am: string;
}

const MOCK: FahrerKmEffizienzResponse = {
  location_id: 'mock',
  fahrer: [
    { driver_id: 'd1', name: 'Max M.',   km_per_auftrag: 3.2,  auftraege: 12, effizienz_score: 92, trend: 'besser',     trend_delta: -0.4, alert: false },
    { driver_id: 'd2', name: 'Sarah K.', km_per_auftrag: 5.8,  auftraege: 9,  effizienz_score: 71, trend: 'gleich',     trend_delta: 0,    alert: false },
    { driver_id: 'd3', name: 'Tom B.',   km_per_auftrag: 13.1, auftraege: 7,  effizienz_score: 31, trend: 'schlechter', trend_delta: 2.1,  alert: true  },
    { driver_id: 'd4', name: 'Anna L.',  km_per_auftrag: 4.5,  auftraege: 11, effizienz_score: 81, trend: 'besser',     trend_delta: -0.9, alert: false },
  ],
  team_avg_km: 6.7,
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

const ALERT_THRESHOLD_KM = 10;

function calcScore(km: number): number {
  if (km <= 3) return 100;
  if (km >= 20) return 0;
  return Math.round(100 - ((km - 3) / 17) * 100);
}

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    const { data: drivers } = await sb
      .from('drivers')
      .select('id, vorname, nachname')
      .eq('location_id', locationId);

    const { data: batches } = await sb
      .from('delivery_batches')
      .select('id, driver_id, distance_km, created_at, status')
      .eq('location_id', locationId)
      .gte('created_at', since48h)
      .eq('status', 'completed');

    const { data: stops } = await sb
      .from('delivery_stops')
      .select('batch_id, order_id')
      .eq('location_id', locationId);

    if (!drivers || !batches) return NextResponse.json(MOCK);

    const stopCountByBatch: Record<string, number> = {};
    if (stops) {
      for (const s of stops) {
        stopCountByBatch[s.batch_id] = (stopCountByBatch[s.batch_id] ?? 0) + 1;
      }
    }

    const fahrerList: FahrerKmEffizienz[] = [];

    for (const d of drivers) {
      const recent = batches.filter(b => b.driver_id === d.id && b.created_at >= since24h && b.distance_km != null);
      const older  = batches.filter(b => b.driver_id === d.id && b.created_at <  since24h && b.distance_km != null);

      if (recent.length === 0) continue;

      const avgKmPerAuftrag = (arr: typeof recent) => {
        const vals = arr.map(b => {
          const stops = stopCountByBatch[b.id] ?? 1;
          return (b.distance_km as number) / Math.max(stops, 1);
        });
        return vals.reduce((a, v) => a + v, 0) / vals.length;
      };

      const recentAvg = avgKmPerAuftrag(recent);
      let trend: FahrerKmEffizienz['trend'] = 'gleich';
      let delta = 0;

      if (older.length > 0) {
        const olderAvg = avgKmPerAuftrag(older);
        delta = Math.round((recentAvg - olderAvg) * 10) / 10;
        if (delta < -0.3) trend = 'besser';
        else if (delta > 0.3) trend = 'schlechter';
      }

      fahrerList.push({
        driver_id: d.id,
        name: `${d.vorname ?? ''} ${d.nachname ?? ''}`.trim() || 'Fahrer',
        km_per_auftrag: Math.round(recentAvg * 10) / 10,
        auftraege: recent.length,
        effizienz_score: calcScore(recentAvg),
        trend,
        trend_delta: delta,
        alert: recentAvg > ALERT_THRESHOLD_KM,
      });
    }

    fahrerList.sort((a, b) => a.km_per_auftrag - b.km_per_auftrag);

    const teamAvg =
      fahrerList.length > 0
        ? Math.round((fahrerList.reduce((s, f) => s + f.km_per_auftrag, 0) / fahrerList.length) * 10) / 10
        : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer: fahrerList,
      team_avg_km: teamAvg,
      alert_count: fahrerList.filter(f => f.alert).length,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerKmEffizienzResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
