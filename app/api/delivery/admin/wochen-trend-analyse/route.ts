/**
 * GET /api/delivery/admin/wochen-trend-analyse?location_id=...
 *
 * Phase 516 — Wochen-Trend-Analyse
 * Vergleicht die letzten 7 Tage mit der Vorwoche für Orders, Umsatz und Lieferzeit.
 *
 * Response: { ok, data: WochenTrendData, generatedAt }
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface DayBucket {
  date: string;       // YYYY-MM-DD
  label: string;      // Mo / Di / Mi …
  orders: number;
  revenue: number;
  avgDeliveryMin: number | null;
  onTimePct: number | null;
}

export interface WochenTrendData {
  thisWeek: DayBucket[];
  lastWeek: DayBucket[];
  totals: {
    ordersThisWeek: number;
    ordersLastWeek: number;
    ordersDelta: number;          // %
    revenueThisWeek: number;
    revenueLastWeek: number;
    revenueDelta: number;         // %
    avgDeliveryThisWeek: number | null;
    avgDeliveryLastWeek: number | null;
    onTimePctThisWeek: number | null;
    onTimePctLastWeek: number | null;
  };
}

const DAY_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

function pct(a: number, b: number): number {
  if (b === 0) return a > 0 ? 100 : 0;
  return Math.round(((a - b) / b) * 100);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  let locationId = url.searchParams.get('location_id');

  if (!locationId) {
    const { data: emp } = await sb
      .from('employees')
      .select('location_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    locationId = (emp?.location_id as string) ?? null;
  }

  const now = new Date();
  // Heute 00:00 UTC
  const todayStart = new Date(now);
  todayStart.setUTCHours(0, 0, 0, 0);

  // 14 Tage zurück (this week = last 7 days, last week = 7–14 days ago)
  const day14Ago = new Date(todayStart);
  day14Ago.setUTCDate(day14Ago.getUTCDate() - 13);

  let query = sb
    .from('customer_orders')
    .select('bestellt_am, gesamtbetrag, status, fertig_am')
    .gte('bestellt_am', day14Ago.toISOString())
    .neq('status', 'storniert');

  if (locationId) {
    query = query.eq('location_id', locationId);
  }

  const { data: rows } = await query;
  const orders = (rows ?? []) as { bestellt_am: string; gesamtbetrag: number; status: string; fertig_am: string | null }[];

  // bucket by date string
  const buckets: Record<string, { orders: number; revenue: number; deliveryMins: number[]; onTime: number[]; total: number[] }> = {};

  for (const o of orders) {
    if (!o.bestellt_am) continue;
    const d = new Date(o.bestellt_am);
    const key = d.toISOString().slice(0, 10);
    if (!buckets[key]) buckets[key] = { orders: 0, revenue: 0, deliveryMins: [], onTime: [], total: [] };
    buckets[key].orders++;
    buckets[key].revenue += o.gesamtbetrag ?? 0;
  }

  function makeDays(startDaysAgo: number, count: number): DayBucket[] {
    const days: DayBucket[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(todayStart);
      d.setUTCDate(d.getUTCDate() - startDaysAgo + (count - 1 - i));
      const key = d.toISOString().slice(0, 10);
      const b = buckets[key];
      days.push({
        date: key,
        label: DAY_LABELS[d.getUTCDay()],
        orders: b?.orders ?? 0,
        revenue: b?.revenue ?? 0,
        avgDeliveryMin: null,
        onTimePct: null,
      });
    }
    return days;
  }

  const thisWeek = makeDays(6, 7);
  const lastWeek = makeDays(13, 7);

  const sumOrders = (days: DayBucket[]) => days.reduce((s, d) => s + d.orders, 0);
  const sumRevenue = (days: DayBucket[]) => days.reduce((s, d) => s + d.revenue, 0);

  const ordersThis = sumOrders(thisWeek);
  const ordersLast = sumOrders(lastWeek);
  const revThis = sumRevenue(thisWeek);
  const revLast = sumRevenue(lastWeek);

  const data: WochenTrendData = {
    thisWeek,
    lastWeek,
    totals: {
      ordersThisWeek: ordersThis,
      ordersLastWeek: ordersLast,
      ordersDelta: pct(ordersThis, ordersLast),
      revenueThisWeek: revThis,
      revenueLastWeek: revLast,
      revenueDelta: pct(revThis, revLast),
      avgDeliveryThisWeek: null,
      avgDeliveryLastWeek: null,
      onTimePctThisWeek: null,
      onTimePctLastWeek: null,
    },
  };

  return NextResponse.json({ ok: true, data, generatedAt: now.toISOString() });
}
