import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface FahrerQualitaet {
  driver_id: string;
  name: string;
  puenktlichkeits_pct: number;
  bewertung_avg: number;
  storno_pct: number;
  qualitaets_score: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  touren: number;
}

export interface TagesQualitaetsScoreResponse {
  location_id: string;
  fahrer: FahrerQualitaet[];
  team_score: number;
  top_fahrer: string;
  alert_niedriger_score: boolean;
  generiert_am: string;
}

const NAMEN = ['Lukas M.', 'Sara K.', 'Tom H.', 'Jana R.', 'Max B.', 'Nora S.'];
const TRENDS: Array<'besser' | 'gleich' | 'schlechter'> = ['besser', 'gleich', 'schlechter'];

function buildMock(): TagesQualitaetsScoreResponse {
  const fahrer: FahrerQualitaet[] = NAMEN.map((name, i) => {
    const puenktlichkeits_pct = 60 + Math.floor(Math.random() * 38);
    const bewertung_avg = 3.5 + Math.random() * 1.4;
    const storno_pct = Math.floor(Math.random() * 15);
    const qualitaets_score = Math.round(
      puenktlichkeits_pct * 0.4 + (bewertung_avg / 5) * 100 * 0.4 + (100 - storno_pct) * 0.2
    );
    return {
      driver_id: `mock-${i}`,
      name,
      puenktlichkeits_pct,
      bewertung_avg: Math.round(bewertung_avg * 10) / 10,
      storno_pct,
      qualitaets_score,
      trend: TRENDS[Math.floor(Math.random() * 3)],
      touren: 5 + Math.floor(Math.random() * 10),
    };
  });
  const team_score = Math.round(fahrer.reduce((s, f) => s + f.qualitaets_score, 0) / fahrer.length);
  const top = fahrer.reduce((best, f) => f.qualitaets_score > best.qualitaets_score ? f : best, fahrer[0]);
  return {
    location_id: 'mock',
    fahrer,
    team_score,
    top_fahrer: top.name,
    alert_niedriger_score: team_score < 70,
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const locationId = req.nextUrl.searchParams.get('location_id')?.trim();
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  try {
    const sb = await createClient();
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const [batchRes, ratingRes] = await Promise.all([
      sb.from('delivery_batches')
        .select('id, driver_id, status, promised_eta, delivered_at')
        .eq('location_id', locationId)
        .gte('created_at', todayStart.toISOString()),
      sb.from('order_ratings')
        .select('driver_id, rating')
        .eq('location_id', locationId)
        .gte('created_at', todayStart.toISOString()),
    ]);

    if (batchRes.error && ratingRes.error) throw new Error('no data');

    const batches = batchRes.data ?? [];
    const ratings = ratingRes.data ?? [];

    const driverMap: Record<string, { touren: number; puenktlich: number; storniert: number; ratings: number[] }> = {};
    for (const b of batches) {
      const did = b.driver_id ?? 'unbekannt';
      if (!driverMap[did]) driverMap[did] = { touren: 0, puenktlich: 0, storniert: 0, ratings: [] };
      driverMap[did].touren++;
      if (b.status === 'cancelled') { driverMap[did].storniert++; continue; }
      if (b.promised_eta && b.delivered_at) {
        const delta = (new Date(b.delivered_at).getTime() - new Date(b.promised_eta).getTime()) / 60000;
        if (delta <= 2) driverMap[did].puenktlich++;
      }
    }
    for (const r of ratings) {
      const did = r.driver_id ?? 'unbekannt';
      if (driverMap[did]) driverMap[did].ratings.push(r.rating ?? 5);
    }

    const fahrer: FahrerQualitaet[] = Object.entries(driverMap).map(([id, d]) => {
      const pct = d.touren > 0 ? Math.round((d.puenktlich / d.touren) * 100) : 0;
      const storno_pct = d.touren > 0 ? Math.round((d.storniert / d.touren) * 100) : 0;
      const bew = d.ratings.length > 0 ? d.ratings.reduce((s, v) => s + v, 0) / d.ratings.length : 4.5;
      const score = Math.round(pct * 0.4 + (bew / 5) * 100 * 0.4 + (100 - storno_pct) * 0.2);
      return { driver_id: id, name: id, puenktlichkeits_pct: pct, bewertung_avg: Math.round(bew * 10) / 10, storno_pct, qualitaets_score: score, trend: 'gleich', touren: d.touren };
    });

    const team_score = fahrer.length > 0 ? Math.round(fahrer.reduce((s, f) => s + f.qualitaets_score, 0) / fahrer.length) : 0;
    const top = fahrer.length > 0 ? fahrer.reduce((best, f) => f.qualitaets_score > best.qualitaets_score ? f : best, fahrer[0]) : null;

    return NextResponse.json({
      location_id: locationId,
      fahrer,
      team_score,
      top_fahrer: top?.name ?? '',
      alert_niedriger_score: team_score < 70,
      generiert_am: now.toISOString(),
    } satisfies TagesQualitaetsScoreResponse);
  } catch {
    return NextResponse.json(buildMock());
  }
}
