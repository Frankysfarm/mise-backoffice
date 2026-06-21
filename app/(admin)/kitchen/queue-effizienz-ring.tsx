'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Order = {
  id: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
};

type Timing = {
  order_id: string;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

interface Props {
  orders: Order[];
  timings: Timing[];
}

interface RingMetrics {
  onTime: number;
  late: number;
  total: number;
  pct: number;
  avgDelayMin: number;
}

function computeMetrics(orders: Order[], timings: Timing[], now: number): RingMetrics {
  const timingMap = new Map(timings.map((t) => [t.order_id, t]));
  let onTime = 0;
  let late = 0;
  let totalDelayMs = 0;

  for (const o of orders) {
    if (!['in_zubereitung', 'fertig'].includes(o.status)) continue;
    const t = timingMap.get(o.id);
    const targetMs = t?.ready_target
      ? new Date(t.ready_target).getTime()
      : o.bestellt_am
        ? new Date(o.bestellt_am).getTime() + (o.geschaetzte_zubereitung_min ?? 20) * 60_000
        : null;
    if (!targetMs) continue;
    const diff = now - targetMs;
    if (diff > 0) {
      late++;
      totalDelayMs += diff;
    } else {
      onTime++;
    }
  }

  const total = onTime + late;
  const pct = total > 0 ? Math.round((onTime / total) * 100) : 100;
  const avgDelayMin = late > 0 ? Math.round(totalDelayMs / late / 60_000) : 0;
  return { onTime, late, total, pct, avgDelayMin };
}

function Ring({ pct, size = 80 }: { pct: number; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const color = pct >= 80 ? '#4a7c59' : pct >= 60 ? '#d97706' : '#dc2626';
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={10} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={10}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
    </svg>
  );
}

export function KitchenQueueEffizienzRing({ orders, timings }: Props) {
  const [, setTick] = useState(0);
  const [prev, setPrev] = useState<number | null>(null);

  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 5_000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();
  const metrics = computeMetrics(orders, timings, now);

  useEffect(() => { setPrev(metrics.pct); }, [metrics.pct]);

  if (metrics.total === 0) return null;

  const trend = prev !== null && prev !== metrics.pct
    ? metrics.pct > prev ? 'up' : 'down'
    : 'flat';

  const ringColor = metrics.pct >= 80 ? 'text-matcha-700' : metrics.pct >= 60 ? 'text-amber-600' : 'text-red-600';
  const bg = metrics.pct >= 80 ? 'bg-matcha-50 border-matcha-200' : metrics.pct >= 60 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  return (
    <div className={cn('rounded-xl border p-3 flex items-center gap-4', bg)}>
      <div className="relative shrink-0">
        <Ring pct={metrics.pct} size={72} />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('text-sm font-black tabular-nums', ringColor)}>{metrics.pct}%</span>
        </div>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <Target className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Queue-Effizienz
          </span>
          {trend === 'up' && <TrendingUp className="h-3 w-3 text-matcha-600 ml-auto" />}
          {trend === 'down' && <TrendingDown className="h-3 w-3 text-red-500 ml-auto" />}
          {trend === 'flat' && <Minus className="h-3 w-3 text-muted-foreground ml-auto" />}
        </div>
        <div className="space-y-0.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">Pünktlich</span>
            <span className="font-bold text-matcha-700">{metrics.onTime}</span>
          </div>
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">Überfällig</span>
            <span className={cn('font-bold', metrics.late > 0 ? 'text-red-600' : 'text-muted-foreground')}>
              {metrics.late}
            </span>
          </div>
          {metrics.late > 0 && (
            <div className="flex justify-between text-[10px]">
              <span className="text-muted-foreground">Ø Verzögerung</span>
              <span className="font-bold text-amber-600">+{metrics.avgDelayMin} Min</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
