'use client';

import { useMemo, useEffect, useState } from 'react';
import { BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  status: string;
  bestellt_am: string | null;
  fertig_am: string | null;
  geschaetzte_zubereitung_min: number | null;
};

type KitchenTiming = {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  status: string;
};

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
}

const BUCKETS = [
  { label: '<5 Min', max: 5, color: 'bg-matcha-500', text: 'text-matcha-700' },
  { label: '5–10', max: 10, color: 'bg-blue-500', text: 'text-blue-700' },
  { label: '10–15', max: 15, color: 'bg-amber-500', text: 'text-amber-700' },
  { label: '15–20', max: 20, color: 'bg-orange-500', text: 'text-orange-700' },
  { label: '20+ Min', max: Infinity, color: 'bg-red-500', text: 'text-red-700' },
];

function getPrepMin(order: Order, timing?: KitchenTiming): number | null {
  if (order.fertig_am && order.bestellt_am) {
    return (new Date(order.fertig_am).getTime() - new Date(order.bestellt_am).getTime()) / 60_000;
  }
  if (timing?.cook_start_at && timing?.ready_target) {
    return (new Date(timing.ready_target).getTime() - new Date(timing.cook_start_at).getTime()) / 60_000;
  }
  return order.geschaetzte_zubereitung_min ?? null;
}

export function KitchenKochzeitVerteilungsChart({ orders, timings }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const stats = useMemo(() => {
    const timingMap = new Map(timings.map(t => [t.order_id, t]));
    const DONE = ['fertig', 'in_zustellung', 'geliefert', 'abgeholt'];
    const relevant = orders.filter(o => DONE.includes(o.status) || ['in_zubereitung', 'bestätigt'].includes(o.status));
    if (relevant.length === 0) return null;

    const counts = new Array(BUCKETS.length).fill(0);
    let total = 0;
    for (const order of relevant) {
      const min = getPrepMin(order, timingMap.get(order.id));
      if (min == null || min < 0) continue;
      total++;
      for (let i = 0; i < BUCKETS.length; i++) {
        if (min < BUCKETS[i].max) { counts[i]++; break; }
      }
    }
    if (total === 0) return null;
    const avg = relevant.reduce((sum, o) => {
      const m = getPrepMin(o, timingMap.get(o.id));
      return m != null && m >= 0 ? sum + m : sum;
    }, 0) / total;

    return { counts, total, avg };
  }, [orders, timings]);

  if (!stats) return null;

  const maxCount = Math.max(...stats.counts, 1);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-stone-100">
        <BarChart2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-stone-700">Kochzeit-Verteilung</span>
        <span className="ml-auto font-mono text-xs font-black tabular-nums text-stone-500">
          Ø {stats.avg.toFixed(1)} Min · n={stats.total}
        </span>
      </div>

      <div className="px-4 py-3">
        <div className="flex items-end gap-2 h-20">
          {BUCKETS.map((bucket, i) => {
            const count = stats.counts[i];
            const pct = (count / maxCount) * 100;
            return (
              <div key={bucket.label} className="flex-1 flex flex-col items-center gap-1">
                <span className={cn('text-[9px] font-black tabular-nums', bucket.text)}>
                  {count > 0 ? count : ''}
                </span>
                <div className="w-full flex flex-col justify-end" style={{ height: 52 }}>
                  <div
                    className={cn('w-full rounded-t transition-all duration-500', bucket.color, count === 0 && 'opacity-20')}
                    style={{ height: `${Math.max(count > 0 ? 8 : 2, pct * 0.52)}px` }}
                  />
                </div>
                <span className="text-[8px] text-stone-500 text-center leading-tight">{bucket.label}</span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[9px] text-stone-400">
          <span>{stats.total} Bestellungen ausgewertet</span>
          <span className={cn(
            'font-semibold',
            stats.avg < 10 ? 'text-matcha-600' : stats.avg < 15 ? 'text-amber-600' : 'text-red-600',
          )}>
            {stats.avg < 10 ? 'Schnelle Küche' : stats.avg < 15 ? 'Im Normbereich' : 'Küche unter Druck'}
          </span>
        </div>
      </div>
    </div>
  );
}
