'use client';

import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react';

interface Order {
  id: string;
  status?: string | null;
  estimated_prep_min?: number | null;
  angenommen_am?: string | null;
  fertig_am?: string | null;
}

interface Props {
  orders: Order[];
}

interface HourBucket {
  label: string;
  avgMin: number;
  count: number;
}

function buildHourBuckets(orders: Order[]): HourBucket[] {
  const now = new Date();
  const buckets: Record<number, { total: number; count: number }> = {};
  for (let h = 5; h >= 0; h--) {
    const hour = now.getHours() - h;
    if (hour >= 0) buckets[hour] = { total: 0, count: 0 };
  }
  for (const o of orders) {
    if (!o.fertig_am || !o.angenommen_am) continue;
    const start = new Date(o.angenommen_am).getTime();
    const end = new Date(o.fertig_am).getTime();
    const diffMin = (end - start) / 60_000;
    if (diffMin <= 0 || diffMin > 90) continue;
    const hour = new Date(o.angenommen_am).getHours();
    if (buckets[hour]) {
      buckets[hour].total += diffMin;
      buckets[hour].count += 1;
    }
  }
  return Object.entries(buckets).map(([h, d]) => ({
    label: `${h}:00`,
    avgMin: d.count > 0 ? Math.round(d.total / d.count) : 0,
    count: d.count,
  }));
}

export function KitchenPhase1717SchichtKochzeitTrend({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const { buckets, currentAvg, targetMin, trend } = useMemo(() => {
    const done = orders.filter(
      (o) => ['ready', 'fertig', 'delivered'].includes(o.status ?? '') && o.fertig_am && o.angenommen_am,
    );
    const bkts = buildHourBuckets(done);
    const withData = bkts.filter((b) => b.count > 0);
    const last = withData.length > 0 ? withData[withData.length - 1].avgMin : 0;
    const prev = withData.length > 1 ? withData[withData.length - 2].avgMin : last;
    const tgt = 15;
    const trendDir = last < prev - 1 ? 'down' : last > prev + 1 ? 'up' : 'flat';
    return { buckets: bkts, currentAvg: last, targetMin: tgt, trend: trendDir };
  }, [orders]);

  const maxVal = Math.max(...buckets.map((b) => b.avgMin), targetMin, 1);
  const statusColor =
    currentAvg === 0 ? 'text-muted-foreground' : currentAvg <= targetMin ? 'text-matcha-700' : currentAvg <= targetMin * 1.3 ? 'text-amber-600' : 'text-red-600';
  const hasData = buckets.some((b) => b.count > 0);

  if (!hasData) return null;

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <BarChart3 className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">Kochzeit-Trend (Schicht)</span>
          {currentAvg > 0 && (
            <span className={cn('text-[10px] font-black tabular-nums px-2 py-0.5 rounded-full bg-muted', statusColor)}>
              Ø {currentAvg} Min
            </span>
          )}
          {trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-matcha-600" />}
          {trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-red-500" />}
          {trend === 'flat' && <Minus className="h-3.5 w-3.5 text-amber-500" />}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="border-t px-4 py-3">
          {/* Zielwert-Info */}
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-8 rounded-full bg-matcha-500" />
              <span className="text-[10px] text-muted-foreground font-semibold">Ziel: {targetMin} Min</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-8 rounded-full bg-amber-400" />
              <span className="text-[10px] text-muted-foreground font-semibold">Tatsächlich</span>
            </div>
          </div>

          {/* Bar chart */}
          <div className="flex items-end gap-1.5 h-20">
            {/* Target line */}
            <div className="absolute" style={{ pointerEvents: 'none' }} />
            {buckets.map((b, i) => {
              const pct = b.avgMin > 0 ? (b.avgMin / maxVal) * 100 : 0;
              const tgtPct = (targetMin / maxVal) * 100;
              const over = b.avgMin > targetMin;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5 relative">
                  {/* Target line marker */}
                  <div
                    className="absolute w-full border-t-2 border-dashed border-matcha-400/60"
                    style={{ bottom: `${tgtPct}%` }}
                  />
                  {/* Bar */}
                  <div className="w-full flex flex-col justify-end" style={{ height: '72px' }}>
                    {b.count > 0 ? (
                      <div
                        className={cn(
                          'w-full rounded-t transition-all duration-500',
                          over ? 'bg-amber-400' : 'bg-matcha-400',
                        )}
                        style={{ height: `${pct}%` }}
                        title={`${b.label}: Ø ${b.avgMin} Min (${b.count} Best.)`}
                      />
                    ) : (
                      <div className="w-full h-1 rounded bg-muted" />
                    )}
                  </div>
                  <span className="text-[8px] text-muted-foreground font-mono">{b.label}</span>
                  {b.count > 0 && (
                    <span className={cn('text-[8px] font-bold tabular-nums', over ? 'text-amber-600' : 'text-matcha-700')}>
                      {b.avgMin}m
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}
