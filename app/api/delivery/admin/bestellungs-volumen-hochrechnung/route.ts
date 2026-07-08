/**
 * GET /api/delivery/admin/bestellungs-volumen-hochrechnung?location_id=<uuid>
 *
 * Phase 791 — Bestellungs-Volumen-Hochrechnung-API
 * Prognose: Wieviele Bestellungen werden bis Schichtende erwartet?
 * Basis: heutiger Stunden-Verlauf + 7-Tage-Ø je Stunde.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('location_id');
  if (!locationId) return NextResponse.json({ error: 'location_id required' }, { status: 400 });

  const sb = await createClient();
  const now = new Date();
  const currentHour = now.getUTCHours();

  // Today's orders (UTC midnight)
  const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
  const { data: todayOrders } = await sb
    .from('orders')
    .select('id, created_at, status')
    .eq('location_id', locationId)
    .gte('created_at', todayStart)
    .neq('status', 'cancelled');

  // Last 7 days for historical average per hour
  const seit7d = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data: histOrders } = await sb
    .from('orders')
    .select('id, created_at')
    .eq('location_id', locationId)
    .gte('created_at', seit7d)
    .lt('created_at', todayStart)
    .neq('status', 'cancelled');

  // Build hourly histogram for today
  const todayByHour = new Map<number, number>();
  for (const o of todayOrders ?? []) {
    const h = new Date(o.created_at as string).getUTCHours();
    todayByHour.set(h, (todayByHour.get(h) ?? 0) + 1);
  }

  // Build 7-day average by hour
  const histByHour = new Map<number, number[]>();
  for (const o of histOrders ?? []) {
    const h = new Date(o.created_at as string).getUTCHours();
    const arr = histByHour.get(h) ?? [];
    arr.push(1);
    histByHour.set(h, arr);
  }

  // Average per hour across 7 days
  const avgByHour = new Map<number, number>();
  for (const [h, counts] of histByHour) {
    // counts is actually raw entries, group by day first
    avgByHour.set(h, counts.length / 7);
  }

  // Schichtende: assume 22:00 UTC (22h) or current hour + remaining hours
  const SCHICHT_ENDE = 22;
  const heuteBisher = Array.from(todayByHour.values()).reduce((s, v) => s + v, 0);

  // Prognose: for each remaining hour, use historical average
  let prognoseRestlich = 0;
  const stundenPrognose: { h: number; label: string; istHeute: number | null; avgHistorisch: number }[] = [];

  for (let h = 0; h <= Math.max(currentHour, SCHICHT_ENDE); h++) {
    const avg = avgByHour.get(h) ?? 0;
    const isToday = h <= currentHour;
    stundenPrognose.push({
      h,
      label: `${String(h).padStart(2, '0')}:00`,
      istHeute: isToday ? (todayByHour.get(h) ?? 0) : null,
      avgHistorisch: Math.round(avg * 10) / 10,
    });
    if (h > currentHour && h <= SCHICHT_ENDE) {
      prognoseRestlich += avg;
    }
  }

  const prognoseGesamt = heuteBisher + prognoseRestlich;
  const verbleibendeStunden = Math.max(0, SCHICHT_ENDE - currentHour);

  return NextResponse.json({
    ok: true,
    heuteBisher,
    prognoseRestlich: Math.round(prognoseRestlich),
    prognoseGesamt: Math.round(prognoseGesamt),
    verbleibendeStunden,
    currentHour,
    schichtEnde: SCHICHT_ENDE,
    stundenPrognose,
    generatedAt: now.toISOString(),
  });
}
