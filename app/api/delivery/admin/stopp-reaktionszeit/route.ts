import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerStoppReaktionszeit {
  driver_id: string;
  name: string;
  median_min: number;
  avg_min: number;
  stopps_heute: number;
  outlier_count: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_delta: number;
  alert: boolean;
}

export interface StoppReaktionsteitResponse {
  location_id: string;
  fahrer: FahrerStoppReaktionszeit[];
  team_median_min: number;
  alert_count: number;
  generiert_am: string;
}

const MOCK: StoppReaktionsteitResponse = {
  location_id: 'mock',
  fahrer: [
    { driver_id: 'd1', name: 'Max M.',   median_min: 2.1, avg_min: 2.4, stopps_heute: 14, outlier_count: 1, trend: 'besser',      trend_delta: -0.4, alert: false },
    { driver_id: 'd2', name: 'Sarah K.', median_min: 3.8, avg_min: 4.1, stopps_heute: 11, outlier_count: 2, trend: 'gleich',      trend_delta: 0.0,  alert: false },
    { driver_id: 'd3', name: 'Tom B.',   median_min: 5.7, avg_min: 6.3, stopps_heute: 9,  outlier_count: 4, trend: 'schlechter', trend_delta: 1.8,  alert: true  },
    { driver_id: 'd4', name: 'Anna L.',  median_min: 2.8, avg_min: 3.0, stopps_heute: 13, outlier_count: 1, trend: 'besser',      trend_delta: -0.6, alert: false },
  ],
  team_median_min: 3.6,
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

const ALERT_THRESHOLD_MIN = 3;

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
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

    const { data: stops } = await sb
      .from('batch_stops')
      .select('driver_id, angekommen_am, geliefert_am, created_at')
      .eq('location_id', locationId)
      .gte('created_at', since48h)
      .not('angekommen_am', 'is', null)
      .not('geliefert_am', 'is', null);

    if (!drivers || !stops) return NextResponse.json({ ...MOCK, location_id: locationId });

    const fahrerList: FahrerStoppReaktionszeit[] = [];
    const allMedians: number[] = [];

    for (const d of drivers) {
      const recent = stops.filter(s => s.driver_id === d.id && s.created_at >= since24h);
      const older  = stops.filter(s => s.driver_id === d.id && s.created_at <  since24h);

      if (recent.length === 0) continue;

      const dwellTimes = (arr: typeof recent) =>
        arr.map(s => (new Date(s.geliefert_am as string).getTime() - new Date(s.angekommen_am as string).getTime()) / 60_000)
           .filter(t => t >= 0 && t < 60);

      const recentTimes = dwellTimes(recent);
      const olderTimes  = dwellTimes(older);

      const med     = median(recentTimes);
      const avg     = recentTimes.reduce((s, v) => s + v, 0) / recentTimes.length;
      const oldMed  = olderTimes.length > 0 ? median(olderTimes) : med;
      const delta   = parseFloat((med - oldMed).toFixed(1));
      const trend   = delta < -0.2 ? 'besser' : delta > 0.2 ? 'schlechter' : 'gleich';
      const outlier = recentTimes.filter(t => t > med * 2 && t > ALERT_THRESHOLD_MIN * 1.5).length;

      fahrerList.push({
        driver_id: d.id,
        name: `${d.vorname} ${d.nachname.charAt(0)}.`,
        median_min: parseFloat(med.toFixed(1)),
        avg_min:    parseFloat(avg.toFixed(1)),
        stopps_heute: recent.length,
        outlier_count: outlier,
        trend,
        trend_delta: delta,
        alert: med > ALERT_THRESHOLD_MIN,
      });
      allMedians.push(med);
    }

    if (fahrerList.length === 0) return NextResponse.json({ ...MOCK, location_id: locationId });

    fahrerList.sort((a, b) => a.median_min - b.median_min);
    const teamMedian = parseFloat(median(allMedians).toFixed(1));

    return NextResponse.json({
      location_id: locationId,
      fahrer: fahrerList,
      team_median_min: teamMedian,
      alert_count: fahrerList.filter(f => f.alert).length,
      generiert_am: new Date().toISOString(),
    } satisfies StoppReaktionsteitResponse);
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
