'use client';

/**
 * PrepAnalyticsCard — Tagesübersicht Küchen-Performance.
 * Zeigt avg Zubereitungszeit, Abweichung von Zielvorgabe, Pünktlichkeitsquote.
 * Nutzt kitchen_timings die heute abgeschlossen wurden (status=ready|picked_up).
 * Kein API-Call notwendig — rechnet direkt aus den übergebenen Daten.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { ChefHat, Clock, Target, TrendingUp, TrendingDown } from 'lucide-react';

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type Order = {
  id: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
};

type HourBucket = { h: number; label: string; count: number; avgMin: number | null };

function buildHourBuckets(timings: KitchenTiming[]): HourBucket[] {
  const done = timings.filter(
    (t) => (t.status === 'ready' || t.status === 'picked_up') && t.cook_start_at && t.prep_min,
  );

  const byHour: Record<number, { sum: number; count: number }> = {};
  for (const t of done) {
    const h = new Date(t.cook_start_at!).getHours();
    if (!byHour[h]) byHour[h] = { sum: 0, count: 0 };
    byHour[h].sum += t.prep_min!;
    byHour[h].count += 1;
  }

  const nowH = new Date().getHours();
  const buckets: HourBucket[] = [];
  for (let h = 10; h <= Math.max(nowH, 21); h++) {
    const d = byHour[h];
    buckets.push({
      h,
      label: `${h}`,
      count: d?.count ?? 0,
      avgMin: d && d.count > 0 ? Math.round(d.sum / d.count) : null,
    });
  }
  return buckets;
}

export function PrepAnalyticsCard({
  timings,
  orders,
}: {
  timings: KitchenTiming[];
  orders: Order[];
}) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(iv);
  }, []);

  const done = timings.filter(
    (t) => (t.status === 'ready' || t.status === 'picked_up') && t.cook_start_at && t.prep_min,
  );

  if (done.length < 2) return null;

  const avgMin =
    Math.round((done.reduce((s, t) => s + t.prep_min!, 0) / done.length) * 10) / 10;

  // On-time: actual prep_min within ±2 min of (ready_target - cook_start)
  const withTarget = done.filter((t) => t.ready_target);
  const onTime = withTarget.filter((t) => {
    const scheduledMin =
      (new Date(t.ready_target!).getTime() - new Date(t.cook_start_at!).getTime()) / 60_000;
    return Math.abs(t.prep_min! - scheduledMin) <= 2;
  });
  const onTimePct = withTarget.length > 0 ? Math.round((onTime.length / withTarget.length) * 100) : null;

  // Current "in_zubereitung" orders
  const cooking = orders.filter((o) => o.status === 'in_zubereitung').length;

  const hourBuckets = buildHourBuckets(timings);
  const maxBar = Math.max(...hourBuckets.map((b) => b.avgMin ?? 0), 1);

  const scoreColor =
    onTimePct == null ? 'text-stone-400'
    : onTimePct >= 85 ? 'text-matcha-600'
    : onTimePct >= 70 ? 'text-amber-600'
    : 'text-red-600';

  const avgColor =
    avgMin <= 15 ? 'text-matcha-600'
    : avgMin <= 22 ? 'text-amber-600'
    : 'text-red-600';

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <ChefHat className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          Küchen-Performance heute · {done.length} abgeschlossen
        </span>
        {cooking > 0 && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-orange-100 border border-orange-200 px-2 py-0.5 text-[10px] font-bold text-orange-700">
            🔥 {cooking} kocht
          </span>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border bg-muted/30 px-2.5 py-2 text-center">
          <div className="flex items-center justify-center gap-1 text-[9px] text-muted-foreground mb-1">
            <Clock className="h-2.5 w-2.5" /> Ø Zeit
          </div>
          <div className={cn('font-display text-xl font-black tabular-nums', avgColor)}>
            {avgMin}m
          </div>
        </div>
        {onTimePct != null && (
          <div className="rounded-lg border bg-muted/30 px-2.5 py-2 text-center">
            <div className="flex items-center justify-center gap-1 text-[9px] text-muted-foreground mb-1">
              <Target className="h-2.5 w-2.5" /> Pünktlich
            </div>
            <div className={cn('font-display text-xl font-black tabular-nums', scoreColor)}>
              {onTimePct}%
            </div>
          </div>
        )}
        <div className="rounded-lg border bg-muted/30 px-2.5 py-2 text-center">
          <div className="flex items-center justify-center gap-1 text-[9px] text-muted-foreground mb-1">
            <TrendingUp className="h-2.5 w-2.5" /> Fertig
          </div>
          <div className="font-display text-xl font-black tabular-nums text-matcha-600">
            {done.length}
          </div>
        </div>
      </div>

      {/* Hourly avg prep time bar chart */}
      {hourBuckets.filter((b) => b.avgMin !== null).length >= 2 && (
        <div>
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
            Ø Zubereitungszeit je Stunde (Min)
          </div>
          <div style={{ height: 56 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourBuckets} margin={{ top: 0, right: 0, left: 0, bottom: 0 }} barSize={14}>
                <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#999' }} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: number) => [`${v} Min`, 'Ø Zeit']}
                  contentStyle={{ fontSize: 10, padding: '2px 6px', borderRadius: 6 }}
                />
                <Bar dataKey="avgMin">
                  {hourBuckets.map((b, i) => (
                    <Cell
                      key={i}
                      fill={
                        b.avgMin == null ? '#e5e7eb'
                        : b.avgMin <= 15 ? '#16a34a'
                        : b.avgMin <= 22 ? '#d97706'
                        : '#dc2626'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-3 mt-1 text-[9px] text-muted-foreground justify-center">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-matcha-600 inline-block" /> ≤15m</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> ≤22m</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> &gt;22m</span>
          </div>
        </div>
      )}
    </div>
  );
}
