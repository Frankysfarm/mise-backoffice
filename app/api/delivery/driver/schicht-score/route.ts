/**
 * GET /api/delivery/driver/schicht-score?driver_id=<uuid>
 *
 * Phase 897 — Schicht-Score-API
 * Gesamtscore 0–100 aus Pünktlichkeit (40%) + Effizienz (35%) + Bewertung (25%).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const driverId = new URL(req.url).searchParams.get('driver_id');
  if (!driverId) return NextResponse.json({ error: 'driver_id required' }, { status: 400 });

  const sb = await createClient();
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86_400_000);

  // Today's completed stops for efficiency
  const { data: todayStops } = await sb
    .from('delivery_stops')
    .select('id, geliefert_am, eta_planned, pünktlich')
    .eq('driver_id', driverId)
    .gte('geliefert_am', todayStart.toISOString())
    .in('status', ['geliefert', 'delivered', 'abgeschlossen']);

  // Shift start time
  const { data: shiftData } = await sb
    .from('driver_shifts')
    .select('started_at')
    .eq('driver_id', driverId)
    .gte('started_at', todayStart.toISOString())
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Ratings from last 30 deliveries
  const { data: ratings } = await sb
    .from('customer_orders')
    .select('driver_rating')
    .eq('driver_id', driverId)
    .not('driver_rating', 'is', null)
    .order('created_at', { ascending: false })
    .limit(30);

  // Last week avg score for trend
  const { data: prevWeekStops } = await sb
    .from('delivery_stops')
    .select('id, pünktlich')
    .eq('driver_id', driverId)
    .gte('geliefert_am', weekAgo.toISOString())
    .lt('geliefert_am', todayStart.toISOString())
    .in('status', ['geliefert', 'delivered', 'abgeschlossen']);

  const stops = todayStops ?? [];
  const ratingList = (ratings ?? []).map(r => r.driver_rating as number).filter(Boolean);
  const prevStops = prevWeekStops ?? [];

  // Efficiency: stops / shift hours
  const shiftStartMs = shiftData?.started_at
    ? new Date(shiftData.started_at).getTime()
    : now.getTime() - 4 * 3_600_000;
  const shiftHours = Math.max(0.5, (now.getTime() - shiftStartMs) / 3_600_000);
  const stopsPh = stops.length / shiftHours;
  const effizienzScore = Math.min(100, Math.round((stopsPh / 4) * 100));

  // Punctuality: % of stops marked pünktlich
  const pünktlichAnzahl = stops.filter(s => s.pünktlich === true).length;
  const pünktlichkeitScore = stops.length > 0
    ? Math.round((pünktlichAnzahl / stops.length) * 100)
    : 70;

  // Ratings score
  const avgBewertung = ratingList.length > 0
    ? ratingList.reduce((a, b) => a + b, 0) / ratingList.length
    : 4.0;
  const bewertungsScore = Math.round(((avgBewertung - 1) / 4) * 100);

  const gesamtScore = Math.round(
    pünktlichkeitScore * 0.4 + effizienzScore * 0.35 + bewertungsScore * 0.25,
  );

  // Prev week score for trend
  const prevPünktlich = prevStops.filter(s => s.pünktlich === true).length;
  const prevPünktlichScore = prevStops.length > 0
    ? Math.round((prevPünktlich / prevStops.length) * 100)
    : null;
  const prevStopsPh = prevStops.length / (7 * 8);
  const prevEffizienzScore = Math.min(100, Math.round((prevStopsPh / 4) * 100));
  const vorwocheAvg = prevPünktlichScore !== null
    ? Math.round(prevPünktlichScore * 0.4 + prevEffizienzScore * 0.35 + bewertungsScore * 0.25)
    : null;

  const trend: 'steigend' | 'fallend' | 'stabil' =
    vorwocheAvg === null ? 'stabil' :
    gesamtScore > vorwocheAvg + 3 ? 'steigend' :
    gesamtScore < vorwocheAvg - 3 ? 'fallend' : 'stabil';

  return NextResponse.json({
    gesamt_score: gesamtScore,
    pünktlichkeit_score: pünktlichkeitScore,
    effizienz_score: effizienzScore,
    bewertungs_score: bewertungsScore,
    stopps_heute: stops.length,
    stopps_pro_h: Math.round(stopsPh * 10) / 10,
    avg_bewertung: Math.round(avgBewertung * 10) / 10,
    trend,
    vorwoche_avg: vorwocheAvg,
    generatedAt: now.toISOString(),
  });
}
