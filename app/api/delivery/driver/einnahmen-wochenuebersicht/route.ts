import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type TagEinnahmen = {
  datum: string;
  wochentag: string;
  umsatz_eur: number;
  stopps: number;
  vorwoche_eur: number;
};

type ApiResponse = {
  tage: TagEinnahmen[];
  gesamt_eur: number;
  vorwoche_gesamt_eur: number;
  trend_pct: number;
  bester_tag: string;
  generiert_am: string;
};

const WOCHENTAGE_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

const MOCK: ApiResponse = {
  tage: [
    { datum: '2026-07-06', wochentag: 'Mo', umsatz_eur: 82,  stopps: 9,  vorwoche_eur: 74 },
    { datum: '2026-07-07', wochentag: 'Di', umsatz_eur: 91,  stopps: 10, vorwoche_eur: 88 },
    { datum: '2026-07-08', wochentag: 'Mi', umsatz_eur: 67,  stopps: 7,  vorwoche_eur: 79 },
    { datum: '2026-07-09', wochentag: 'Do', umsatz_eur: 105, stopps: 12, vorwoche_eur: 95 },
    { datum: '2026-07-10', wochentag: 'Fr', umsatz_eur: 134, stopps: 15, vorwoche_eur: 120 },
    { datum: '2026-07-11', wochentag: 'Sa', umsatz_eur: 156, stopps: 18, vorwoche_eur: 142 },
    { datum: '2026-07-12', wochentag: 'So', umsatz_eur: 48,  stopps: 5,  vorwoche_eur: 130 },
  ],
  gesamt_eur: 683,
  vorwoche_gesamt_eur: 728,
  trend_pct: -6,
  bester_tag: 'Sa',
  generiert_am: new Date().toISOString(),
};

export async function GET(req: NextRequest) {
  const driverId = req.nextUrl.searchParams.get('driver_id');
  if (!driverId) return NextResponse.json(MOCK);

  try {
    const supabase = await createClient();
    const now = new Date();

    // Monday of current week
    const dayOfWeek = now.getDay(); // 0=Sun
    const daysToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - daysToMon);
    weekStart.setUTCHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart.getTime() + 7 * 86400_000);

    // Previous week
    const prevWeekStart = new Date(weekStart.getTime() - 7 * 86400_000);
    const prevWeekEnd = new Date(weekStart.getTime());

    const [{ data: thisWeek }, { data: prevWeek }] = await Promise.all([
      supabase
        .from('customer_orders')
        .select('created_at, total_amount, status')
        .eq('driver_id', driverId)
        .gte('created_at', weekStart.toISOString())
        .lt('created_at', weekEnd.toISOString())
        .in('status', ['geliefert', 'delivered', 'completed']),
      supabase
        .from('customer_orders')
        .select('created_at, total_amount, status')
        .eq('driver_id', driverId)
        .gte('created_at', prevWeekStart.toISOString())
        .lt('created_at', prevWeekEnd.toISOString())
        .in('status', ['geliefert', 'delivered', 'completed']),
    ]);

    // Aggregate by day
    const byDay = new Map<string, { umsatz: number; stopps: number }>();
    const byDayPrev = new Map<string, { umsatz: number }>();

    for (const o of thisWeek ?? []) {
      const d = new Date(o.created_at as string);
      const key = d.toISOString().slice(0, 10);
      const existing = byDay.get(key) ?? { umsatz: 0, stopps: 0 };
      existing.umsatz += Number(o.total_amount ?? 0);
      existing.stopps += 1;
      byDay.set(key, existing);
    }

    for (const o of prevWeek ?? []) {
      const d = new Date(o.created_at as string);
      const key = d.toISOString().slice(0, 10);
      const existing = byDayPrev.get(key) ?? { umsatz: 0 };
      existing.umsatz += Number(o.total_amount ?? 0);
      byDayPrev.set(key, existing);
    }

    const tage: TagEinnahmen[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart.getTime() + i * 86400_000);
      const key = d.toISOString().slice(0, 10);
      const prevKey = new Date(prevWeekStart.getTime() + i * 86400_000).toISOString().slice(0, 10);
      const cur = byDay.get(key) ?? { umsatz: 0, stopps: 0 };
      const prev = byDayPrev.get(prevKey) ?? { umsatz: 0 };
      tage.push({
        datum: key,
        wochentag: WOCHENTAGE_SHORT[d.getDay()],
        umsatz_eur: Math.round(cur.umsatz * 100) / 100,
        stopps: cur.stopps,
        vorwoche_eur: Math.round(prev.umsatz * 100) / 100,
      });
    }

    const gesamt = tage.reduce((s, t) => s + t.umsatz_eur, 0);
    const vorwocheGesamt = tage.reduce((s, t) => s + t.vorwoche_eur, 0);
    const trendPct = vorwocheGesamt > 0 ? Math.round(((gesamt - vorwocheGesamt) / vorwocheGesamt) * 100) : 0;
    const besterTag = tage.reduce((max, t) => t.umsatz_eur > max.umsatz_eur ? t : max, tage[0]);

    return NextResponse.json({
      tage,
      gesamt_eur: Math.round(gesamt * 100) / 100,
      vorwoche_gesamt_eur: Math.round(vorwocheGesamt * 100) / 100,
      trend_pct: trendPct,
      bester_tag: besterTag?.wochentag ?? 'Mo',
      generiert_am: new Date().toISOString(),
    } satisfies ApiResponse);
  } catch {
    return NextResponse.json(MOCK);
  }
}
