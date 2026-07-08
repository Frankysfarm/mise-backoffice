/**
 * GET /api/delivery/admin/kundenbewertungs-aggregation?location_id=<uuid>&days=30
 *
 * Phase 646 — Kundenbewertungs-Aggregations-API
 * Schnell-Aggregat der Kundenbewertungen für ein Location:
 * Ø-Note, Verteilung (1–5 Sterne), 7-Tage-Trend.
 *
 * Verwendet von: Phase 650 Storefront Kundenbewertungs-Widget
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export interface BewertungsAggregat {
  avg_rating: number;
  total_count: number;
  verteilung: Record<1 | 2 | 3 | 4 | 5, number>;
  positive_pct: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  trend_delta: number;
  letzte_30_tage: number;
  generiert_am: string;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  const days = Math.min(parseInt(searchParams.get('days') ?? '30', 10), 90);

  if (!locationId) {
    return NextResponse.json({ error: 'location_id required' }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const prev = new Date(Date.now() - days * 2 * 86_400_000).toISOString();

    const [currentRes, prevRes] = await Promise.all([
      supabase
        .from('customer_delivery_ratings')
        .select('rating')
        .eq('location_id', locationId)
        .gte('created_at', since),
      supabase
        .from('customer_delivery_ratings')
        .select('rating')
        .eq('location_id', locationId)
        .gte('created_at', prev)
        .lt('created_at', since),
    ]);

    const current = (currentRes.data ?? []) as Array<{ rating: number }>;
    const prev30 = (prevRes.data ?? []) as Array<{ rating: number }>;

    const verteilung: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sumRating = 0;
    for (const r of current) {
      const s = Math.round(r.rating);
      if (s >= 1 && s <= 5) verteilung[s] = (verteilung[s] ?? 0) + 1;
      sumRating += r.rating;
    }

    const totalCount = current.length;
    const avgRating = totalCount > 0 ? sumRating / totalCount : 0;
    const positiveCount = (verteilung[4] ?? 0) + (verteilung[5] ?? 0);
    const positivePct = totalCount > 0 ? (positiveCount / totalCount) * 100 : 0;

    const prevAvg =
      prev30.length > 0
        ? prev30.reduce((s, r) => s + r.rating, 0) / prev30.length
        : null;

    let trend: 'steigend' | 'stabil' | 'fallend' = 'stabil';
    let trendDelta = 0;
    if (prevAvg !== null && totalCount > 0) {
      trendDelta = Math.round((avgRating - prevAvg) * 100) / 100;
      if (trendDelta >= 0.1) trend = 'steigend';
      else if (trendDelta <= -0.1) trend = 'fallend';
    }

    const aggregat: BewertungsAggregat = {
      avg_rating: Math.round(avgRating * 10) / 10,
      total_count: totalCount,
      verteilung: verteilung as Record<1 | 2 | 3 | 4 | 5, number>,
      positive_pct: Math.round(positivePct),
      trend,
      trend_delta: trendDelta,
      letzte_30_tage: days,
      generiert_am: new Date().toISOString(),
    };

    return NextResponse.json(aggregat);
  } catch (err) {
    console.error('[kundenbewertungs-aggregation]', err);
    return NextResponse.json({ error: 'Datenbankfehler' }, { status: 500 });
  }
}
