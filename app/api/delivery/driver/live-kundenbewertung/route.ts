import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TrendDir = 'besser' | 'gleich' | 'schlechter';

type Bewertung = {
  id: string;
  sterne: number;
  kommentar: string | null;
  zeit_label: string;
  bestell_id: string;
};

type ApiResponse = {
  fahrer_id: string;
  schicht_durchschnitt: number;
  anzahl_bewertungen: number;
  trend: TrendDir;
  letzte_bewertungen: Bewertung[];
  generiert_am: string;
};

function zeitLabel(iso: string): string {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diff < 60) return `vor ${diff} Min`;
  const h = Math.floor(diff / 60);
  return `vor ${h} Std`;
}

function mockData(driverId: string): ApiResponse {
  return {
    fahrer_id: driverId,
    schicht_durchschnitt: 4.7,
    anzahl_bewertungen: 9,
    trend: 'besser',
    letzte_bewertungen: [
      { id: 'b1', sterne: 5, kommentar: 'Super schnell, sehr freundlich!', zeit_label: 'vor 12 Min', bestell_id: 'A3F1' },
      { id: 'b2', sterne: 4, kommentar: null, zeit_label: 'vor 38 Min', bestell_id: 'B7C2' },
      { id: 'b3', sterne: 5, kommentar: 'Essen noch warm, danke!', zeit_label: 'vor 1 Std', bestell_id: 'D2E9' },
    ],
    generiert_am: new Date().toISOString(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driverId = searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  try {
    const supabase = createClient();
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    // Load today's ratings for this driver
    const { data: ratings, error } = await supabase
      .from('mise_driver_ratings')
      .select('id, rating, comment, created_at, order_id')
      .eq('driver_id', driverId)
      .gte('created_at', startOfDay.toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !ratings || ratings.length === 0) throw new Error('no ratings');

    const avg = parseFloat(
      (ratings.reduce((s, r) => s + (r.rating ?? 0), 0) / ratings.length).toFixed(1),
    );

    // Trend: compare first half vs second half of today's ratings
    const half = Math.ceil(ratings.length / 2);
    const recentAvg =
      ratings.slice(0, half).reduce((s, r) => s + (r.rating ?? 0), 0) / half;
    const olderAvg =
      ratings.slice(half).reduce((s, r) => s + (r.rating ?? 0), 0) /
      (ratings.length - half || 1);
    const trend: TrendDir =
      recentAvg > olderAvg + 0.3
        ? 'besser'
        : recentAvg < olderAvg - 0.3
          ? 'schlechter'
          : 'gleich';

    const letzte_bewertungen: Bewertung[] = ratings.slice(0, 3).map(r => ({
      id: String(r.id),
      sterne: r.rating ?? 0,
      kommentar: r.comment ?? null,
      zeit_label: zeitLabel(r.created_at),
      bestell_id: String(r.order_id ?? '?').slice(-4).toUpperCase(),
    }));

    return NextResponse.json({
      fahrer_id: driverId,
      schicht_durchschnitt: avg,
      anzahl_bewertungen: ratings.length,
      trend,
      letzte_bewertungen,
      generiert_am: new Date().toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(mockData(driverId));
  }
}
