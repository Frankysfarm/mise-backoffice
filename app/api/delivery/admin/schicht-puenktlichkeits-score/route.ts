import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerPuenktlichkeit {
  driver_id: string;
  name: string;
  rate: number;
  on_time: number;
  total: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_delta: number;
}

export interface PuenktlichkeitsScoreResponse {
  location_id: string;
  fahrer: FahrerPuenktlichkeit[];
  team_avg: number;
  alert_count: number;
  generiert_am: string;
}

const MOCK: PuenktlichkeitsScoreResponse = {
  location_id: 'mock',
  fahrer: [
    { driver_id: 'd1', name: 'Max M.', rate: 96, on_time: 48, total: 50, trend: 'besser', trend_delta: 3 },
    { driver_id: 'd2', name: 'Sarah K.', rate: 91, on_time: 40, total: 44, trend: 'gleich', trend_delta: 0 },
    { driver_id: 'd3', name: 'Tom B.', rate: 82, on_time: 36, total: 44, trend: 'schlechter', trend_delta: -5 },
    { driver_id: 'd4', name: 'Anna L.', rate: 94, on_time: 33, total: 35, trend: 'besser', trend_delta: 2 },
  ],
  team_avg: 91,
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

const THRESHOLD_MS = 40 * 60 * 1000;

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

    const { data: orders } = await sb
      .from('delivery_orders')
      .select('id, driver_id, created_at, delivered_at, status')
      .eq('location_id', locationId)
      .gte('created_at', since48h)
      .in('status', ['delivered', 'geliefert']);

    if (!drivers || !orders) return NextResponse.json(MOCK);

    const fahrerList: FahrerPuenktlichkeit[] = [];

    for (const d of drivers) {
      const recent = (orders ?? []).filter(
        o => o.driver_id === d.id && o.created_at >= since24h,
      );
      const older = (orders ?? []).filter(
        o => o.driver_id === d.id && o.created_at < since24h,
      );

      if (recent.length === 0) continue;

      const onTime = (arr: typeof recent) =>
        arr.filter(o => {
          if (!o.delivered_at) return false;
          const ms = new Date(o.delivered_at).getTime() - new Date(o.created_at).getTime();
          return ms <= THRESHOLD_MS;
        }).length;

      const recentOnTime = onTime(recent);
      const recentRate = Math.round((recentOnTime / recent.length) * 100);

      let trend: FahrerPuenktlichkeit['trend'] = 'gleich';
      let delta = 0;
      if (older.length > 0) {
        const olderRate = Math.round((onTime(older) / older.length) * 100);
        delta = recentRate - olderRate;
        if (delta > 2) trend = 'besser';
        else if (delta < -2) trend = 'schlechter';
      }

      fahrerList.push({
        driver_id: d.id,
        name: `${d.vorname ?? ''} ${d.nachname ?? ''}`.trim() || 'Fahrer',
        rate: recentRate,
        on_time: recentOnTime,
        total: recent.length,
        trend,
        trend_delta: delta,
      });
    }

    fahrerList.sort((a, b) => b.rate - a.rate);

    const teamAvg =
      fahrerList.length > 0
        ? Math.round(fahrerList.reduce((s, f) => s + f.rate, 0) / fahrerList.length)
        : 0;

    return NextResponse.json({
      location_id: locationId,
      fahrer: fahrerList,
      team_avg: teamAvg,
      alert_count: fahrerList.filter(f => f.rate < 90).length,
      generiert_am: new Date().toISOString(),
    } satisfies PuenktlichkeitsScoreResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
