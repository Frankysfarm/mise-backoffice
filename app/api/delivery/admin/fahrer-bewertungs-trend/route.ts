import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerBewertungsTrend {
  driver_id: string;
  name: string;
  avg_bewertung: number;
  bewertungs_count: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  trend_delta: number;
  alert_niedrig: boolean;
}

interface BewertungsTrendResponse {
  location_id: string;
  fahrer: FahrerBewertungsTrend[];
  team_avg: number;
  alert_count: number;
  generiert_am: string;
}

const MOCK: BewertungsTrendResponse = {
  location_id: 'mock',
  fahrer: [
    { driver_id: 'd1', name: 'Max M.', avg_bewertung: 4.8, bewertungs_count: 42, trend: 'steigend', trend_delta: 0.2, alert_niedrig: false },
    { driver_id: 'd2', name: 'Sarah K.', avg_bewertung: 4.5, bewertungs_count: 31, trend: 'stabil', trend_delta: 0.0, alert_niedrig: false },
    { driver_id: 'd3', name: 'Tom B.', avg_bewertung: 3.2, bewertungs_count: 18, trend: 'fallend', trend_delta: -0.4, alert_niedrig: true },
    { driver_id: 'd4', name: 'Anna L.', avg_bewertung: 4.1, bewertungs_count: 27, trend: 'steigend', trend_delta: 0.1, alert_niedrig: false },
  ],
  team_avg: 4.15,
  alert_count: 1,
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const since15 = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();

    const { data: drivers } = await sb
      .from('drivers')
      .select('id, vorname, nachname')
      .eq('location_id', locationId);

    const { data: ratings } = await sb
      .from('driver_ratings')
      .select('driver_id, rating, created_at')
      .eq('location_id', locationId)
      .gte('created_at', since30);

    if (!drivers || !ratings) return NextResponse.json(MOCK);

    const fahrerList: FahrerBewertungsTrend[] = [];

    for (const d of drivers) {
      const all = (ratings ?? []).filter(r => r.driver_id === d.id);
      if (all.length === 0) continue;

      const recent = all.filter(r => r.created_at >= since15);
      const older = all.filter(r => r.created_at < since15);

      const avg = (arr: { rating: number }[]) =>
        arr.length > 0 ? arr.reduce((s, r) => s + Number(r.rating), 0) / arr.length : null;

      const avgAll = avg(all) ?? 0;
      const avgRecent = avg(recent);
      const avgOlder = avg(older);

      let trend: FahrerBewertungsTrend['trend'] = 'stabil';
      let delta = 0;
      if (avgRecent !== null && avgOlder !== null) {
        delta = Math.round((avgRecent - avgOlder) * 10) / 10;
        if (delta > 0.1) trend = 'steigend';
        else if (delta < -0.1) trend = 'fallend';
      }

      fahrerList.push({
        driver_id: d.id,
        name: `${d.vorname ?? ''} ${d.nachname ?? ''}`.trim() || 'Fahrer',
        avg_bewertung: Math.round(avgAll * 10) / 10,
        bewertungs_count: all.length,
        trend,
        trend_delta: delta,
        alert_niedrig: avgAll < 3.5,
      });
    }

    fahrerList.sort((a, b) => b.avg_bewertung - a.avg_bewertung);

    const teamAvg =
      fahrerList.length > 0
        ? Math.round((fahrerList.reduce((s, f) => s + f.avg_bewertung, 0) / fahrerList.length) * 10) / 10
        : 0;

    const result: BewertungsTrendResponse = {
      location_id: locationId,
      fahrer: fahrerList,
      team_avg: teamAvg,
      alert_count: fahrerList.filter(f => f.alert_niedrig).length,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(MOCK);
  }
}
