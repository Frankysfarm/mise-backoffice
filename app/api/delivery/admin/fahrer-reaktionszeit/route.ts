import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerReaktionszeit {
  driver_id: string;
  name: string;
  avg_min: number;
  auftraege: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_delta: number;
  alert: boolean;
}

export interface FahrerReaktionsteitResponse {
  location_id: string;
  fahrer: FahrerReaktionszeit[];
  team_avg_min: number;
  alert_count: number;
  generiert_am: string;
}

const MOCK: FahrerReaktionsteitResponse = {
  location_id: 'mock',
  fahrer: [
    { driver_id: 'd1', name: 'Max M.', avg_min: 3.2, auftraege: 12, trend: 'besser', trend_delta: -0.8, alert: false },
    { driver_id: 'd2', name: 'Sarah K.', avg_min: 5.1, auftraege: 9, trend: 'gleich', trend_delta: 0, alert: false },
    { driver_id: 'd3', name: 'Tom B.', avg_min: 11.4, auftraege: 7, trend: 'schlechter', trend_delta: 2.3, alert: true },
    { driver_id: 'd4', name: 'Anna L.', avg_min: 4.0, auftraege: 11, trend: 'besser', trend_delta: -1.2, alert: false },
  ],
  team_avg_min: 5.9,
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

const ALERT_THRESHOLD_MIN = 10;

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
      .select('id, driver_id, assigned_at, picked_up_at, created_at')
      .eq('location_id', locationId)
      .gte('created_at', since48h)
      .not('picked_up_at', 'is', null);

    if (!drivers || !batches) return NextResponse.json(MOCK);

    const fahrerList: FahrerReaktionszeit[] = [];

    for (const d of drivers) {
      const recent = batches.filter(
        b => b.driver_id === d.id && b.created_at >= since24h && b.assigned_at && b.picked_up_at,
      );
      const older = batches.filter(
        b => b.driver_id === d.id && b.created_at < since24h && b.assigned_at && b.picked_up_at,
      );

      if (recent.length === 0) continue;

      const avgReaction = (arr: typeof recent) => {
        const times = arr
          .map(b => {
            const assigned = new Date(b.assigned_at as string).getTime();
            const picked = new Date(b.picked_up_at as string).getTime();
            return (picked - assigned) / 60_000;
          })
          .filter(t => t >= 0 && t < 120);
        return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
      };

      const recentAvg = avgReaction(recent);

      let trend: FahrerReaktionszeit['trend'] = 'gleich';
      let delta = 0;
      if (older.length > 0) {
        const olderAvg = avgReaction(older);
        delta = Math.round((recentAvg - olderAvg) * 10) / 10;
        if (delta < -0.5) trend = 'besser';
        else if (delta > 0.5) trend = 'schlechter';
      }

      fahrerList.push({
        driver_id: d.id,
        name: `${d.vorname ?? ''} ${d.nachname ?? ''}`.trim() || 'Fahrer',
        avg_min: Math.round(recentAvg * 10) / 10,
        auftraege: recent.length,
        trend,
        trend_delta: delta,
        alert: recentAvg > ALERT_THRESHOLD_MIN,
      });
    }

    fahrerList.sort((a, b) => a.avg_min - b.avg_min);

    const teamAvg =
      fahrerList.length > 0
        ? Math.round((fahrerList.reduce((s, f) => s + f.avg_min, 0) / fahrerList.length) * 10) / 10
        : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer: fahrerList,
      team_avg_min: teamAvg,
      alert_count: fahrerList.filter(f => f.alert).length,
      generiert_am: new Date().toISOString(),
    } satisfies FahrerReaktionsteitResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
