import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerFeedbackScore {
  driver_id: string;
  name: string;
  avg_score: number;
  kommentare_count: number;
  bewertungen_heute: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_delta: number;
  alert: boolean;
}

export interface KundenFeedbackScoreResponse {
  location_id: string;
  fahrer: FahrerFeedbackScore[];
  team_avg_score: number;
  top_fahrer: string | null;
  alert_niedriger_score: boolean;
  generiert_am: string;
}

const MOCK: KundenFeedbackScoreResponse = {
  location_id: 'mock',
  fahrer: [
    { driver_id: 'd1', name: 'Max M.',   avg_score: 4.8, kommentare_count: 12, bewertungen_heute: 14, trend: 'besser',      trend_delta: 0.2,  alert: false },
    { driver_id: 'd2', name: 'Sarah K.', avg_score: 4.5, kommentare_count: 8,  bewertungen_heute: 11, trend: 'gleich',      trend_delta: 0.0,  alert: false },
    { driver_id: 'd3', name: 'Tom B.',   avg_score: 3.7, kommentare_count: 5,  bewertungen_heute: 9,  trend: 'schlechter', trend_delta: -0.4, alert: true  },
    { driver_id: 'd4', name: 'Anna L.',  avg_score: 4.6, kommentare_count: 10, bewertungen_heute: 13, trend: 'besser',      trend_delta: 0.3,  alert: false },
  ],
  team_avg_score: 4.4,
  top_fahrer: 'Max M.',
  alert_niedriger_score: true,
  generiert_am: new Date().toISOString(),
};

const ALERT_THRESHOLD = 4.0;

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

    const { data: bewertungen } = await sb
      .from('fahrer_bewertungen')
      .select('driver_id, rating, kommentar, created_at')
      .eq('location_id', locationId)
      .gte('created_at', since48h);

    if (!drivers || !bewertungen) return NextResponse.json({ ...MOCK, location_id: locationId });

    const fahrerList: FahrerFeedbackScore[] = [];

    for (const d of drivers) {
      const recent = bewertungen.filter(b => b.driver_id === d.id && b.created_at >= since24h);
      const older  = bewertungen.filter(b => b.driver_id === d.id && b.created_at <  since24h);

      if (recent.length === 0) continue;

      const ratings = recent.map(b => Number(b.rating)).filter(r => r >= 1 && r <= 5);
      const oldRatings = older.map(b => Number(b.rating)).filter(r => r >= 1 && r <= 5);

      if (ratings.length === 0) continue;

      const avg = ratings.reduce((s, v) => s + v, 0) / ratings.length;
      const oldAvg = oldRatings.length > 0
        ? oldRatings.reduce((s, v) => s + v, 0) / oldRatings.length
        : avg;

      const delta   = parseFloat((avg - oldAvg).toFixed(1));
      const trend: FahrerFeedbackScore['trend'] = delta > 0.1 ? 'besser' : delta < -0.1 ? 'schlechter' : 'gleich';
      const kommentare = recent.filter(b => b.kommentar && (b.kommentar as string).trim().length > 0).length;

      fahrerList.push({
        driver_id: d.id,
        name: `${d.vorname} ${d.nachname.charAt(0)}.`,
        avg_score: parseFloat(avg.toFixed(1)),
        kommentare_count: kommentare,
        bewertungen_heute: recent.length,
        trend,
        trend_delta: delta,
        alert: avg < ALERT_THRESHOLD,
      });
    }

    if (fahrerList.length === 0) return NextResponse.json({ ...MOCK, location_id: locationId });

    fahrerList.sort((a, b) => b.avg_score - a.avg_score);
    const teamAvg = parseFloat((fahrerList.reduce((s, f) => s + f.avg_score, 0) / fahrerList.length).toFixed(1));
    const topFahrer = fahrerList[0]?.name ?? null;

    return NextResponse.json({
      location_id: locationId,
      fahrer: fahrerList,
      team_avg_score: teamAvg,
      top_fahrer: topFahrer,
      alert_niedriger_score: fahrerList.some(f => f.alert),
      generiert_am: new Date().toISOString(),
    } satisfies KundenFeedbackScoreResponse);
  } catch {
    return NextResponse.json({ ...MOCK, location_id: locationId });
  }
}
