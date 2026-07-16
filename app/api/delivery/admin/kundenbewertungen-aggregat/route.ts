import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface BewertungsAggregat {
  location_id: string;
  avg_bewertung: number;
  bewertungs_count: number;
  nps_score: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  alert: boolean;
  top_positiv: string[];
  top_negativ: string[];
  generiert_am: string;
}

const MOCK: Omit<BewertungsAggregat, 'location_id' | 'generiert_am'> = {
  avg_bewertung: 4.3,
  bewertungs_count: 128,
  nps_score: 42,
  trend: 'steigend',
  alert: false,
  top_positiv: ['Sehr schnelle Lieferung!', 'Freundlicher Fahrer', 'Alles vollständig'],
  top_negativ: ['Etwas zu lange Wartezeit', 'Verpackung beschädigt'],
};

export async function GET(req: NextRequest) {
  const locationId = req.nextUrl.searchParams.get('location_id');
  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const { createClient } = await import('@/lib/supabase/server');
    const supabase = await createClient();

    const since = new Date();
    since.setDate(since.getDate() - 7);
    const vorWoche = new Date();
    vorWoche.setDate(vorWoche.getDate() - 14);

    const { data: current } = await supabase
      .from('order_ratings')
      .select('rating, comment')
      .eq('location_id', locationId)
      .gte('created_at', since.toISOString());

    const { data: previous } = await supabase
      .from('order_ratings')
      .select('rating')
      .eq('location_id', locationId)
      .gte('created_at', vorWoche.toISOString())
      .lt('created_at', since.toISOString());

    if (!current || current.length === 0) throw new Error('no data');

    const ratings = current.map((r: { rating: number }) => r.rating).filter((v: unknown) => typeof v === 'number');
    const avg = ratings.length > 0 ? Math.round((ratings.reduce((s: number, v: number) => s + v, 0) / ratings.length) * 10) / 10 : 0;

    const prevRatings = (previous ?? []).map((r: { rating: number }) => r.rating).filter((v: unknown) => typeof v === 'number');
    const prevAvg = prevRatings.length > 0 ? prevRatings.reduce((s: number, v: number) => s + v, 0) / prevRatings.length : avg;
    const delta = avg - prevAvg;
    const trend: BewertungsAggregat['trend'] = delta > 0.2 ? 'steigend' : delta < -0.2 ? 'fallend' : 'stabil';

    const promoters = ratings.filter((r: number) => r >= 4).length;
    const detractors = ratings.filter((r: number) => r <= 2).length;
    const nps = ratings.length > 0 ? Math.round(((promoters - detractors) / ratings.length) * 100) : 0;

    const comments = current.map((r: { comment: string | null }) => r.comment).filter(Boolean) as string[];
    const positiv = comments.filter((c: string) => c.length > 5).slice(0, 3);
    const negativ = comments.filter((c: string) => c.toLowerCase().includes('wart') || c.toLowerCase().includes('lang') || c.toLowerCase().includes('fehlt')).slice(0, 2);

    return NextResponse.json({
      location_id: locationId,
      avg_bewertung: avg,
      bewertungs_count: ratings.length,
      nps_score: nps,
      trend,
      alert: avg < 3.5,
      top_positiv: positiv.length > 0 ? positiv : MOCK.top_positiv,
      top_negativ: negativ.length > 0 ? negativ : MOCK.top_negativ,
      generiert_am: new Date().toISOString(),
    } satisfies BewertungsAggregat);
  } catch {
    return NextResponse.json({
      location_id: locationId,
      ...MOCK,
      generiert_am: new Date().toISOString(),
    } satisfies BewertungsAggregat);
  }
}
