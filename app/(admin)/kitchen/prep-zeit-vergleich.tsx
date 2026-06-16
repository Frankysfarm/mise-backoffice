'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Clock, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface OrderMin {
  id: string;
  status: string;
  bestellt_am: string | null;
  fertig_am: string | null;
  geschaetzte_zubereitung_min: number | null;
}

interface Props {
  orders: OrderMin[];
  targetMin?: number;
}

function ArcGauge({ ratio, color }: { ratio: number; color: string }) {
  const r = 32;
  const cx = 36;
  const cy = 36;
  const circumference = 2 * Math.PI * r;
  const arcFraction = 0.75;
  const filled = Math.min(ratio, 1) * arcFraction;

  return (
    <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-[135deg]">
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke="#e5e7eb" strokeWidth="6"
        strokeDasharray={`${circumference * arcFraction} ${circumference * (1 - arcFraction)}`}
        strokeLinecap="round"
      />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke={color} strokeWidth="6"
        strokeDasharray={`${circumference * filled} ${circumference * (1 - filled)}`}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
    </svg>
  );
}

export function KitchenPrepZeitVergleich({ orders, targetMin = 20 }: Props) {
  const stats = useMemo(() => {
    const done = orders.filter(
      (o) =>
        ['fertig', 'unterwegs', 'geliefert'].includes(o.status) &&
        o.bestellt_am &&
        o.fertig_am,
    );
    if (done.length === 0) return null;

    const times = done
      .map((o) => (new Date(o.fertig_am!).getTime() - new Date(o.bestellt_am!).getTime()) / 60_000)
      .filter((t) => t > 0 && t < 90);

    if (times.length === 0) return null;

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);
    const fast = times.filter((t) => t <= targetMin).length;
    const fastPct = Math.round((fast / times.length) * 100);

    return { avg, min, max, count: times.length, fastPct };
  }, [orders, targetMin]);

  if (!stats) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="h-4 w-4 text-stone-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-stone-400">
            Ø Zubereitungszeit
          </span>
        </div>
        <p className="text-sm text-stone-400">Noch keine fertigen Bestellungen heute.</p>
      </div>
    );
  }

  const delta = stats.avg - targetMin;
  const ratio = stats.avg / (targetMin * 1.6);

  const tier =
    delta <= 0
      ? { stroke: '#22c55e', text: 'text-matcha-700', bg: 'bg-matcha-50 border-matcha-200', label: 'Im Zielbereich' }
      : delta <= 5
      ? { stroke: '#f59e0b', text: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', label: 'Leicht überzogen' }
      : { stroke: '#ef4444', text: 'text-red-700', bg: 'bg-red-50 border-red-200', label: 'Überzogen' };

  return (
    <div className={cn('rounded-2xl border p-4', tier.bg)}>
      <div className="flex items-start gap-3">
        <div className="relative shrink-0">
          <ArcGauge ratio={ratio} color={tier.stroke} />
          <div className="absolute inset-0 flex items-center justify-center">
            <Clock className={cn('h-5 w-5', tier.text)} />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-0.5">
            Ø Zubereitungszeit
          </div>
          <div className={cn('text-2xl font-black tabular-nums leading-tight', tier.text)}>
            {stats.avg.toFixed(0)} Min
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            {delta <= 0
              ? <TrendingDown className="h-3 w-3 text-matcha-600" />
              : delta <= 5
              ? <Minus className="h-3 w-3 text-amber-600" />
              : <TrendingUp className="h-3 w-3 text-red-600" />}
            <span className={cn('text-[11px] font-semibold', tier.text)}>
              {delta > 0 ? '+' : ''}{delta.toFixed(0)} Min vs. Ziel {targetMin} Min
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${stats.fastPct}%`, backgroundColor: tier.stroke }}
              />
            </div>
            <span className="text-[10px] font-bold tabular-nums" style={{ color: tier.stroke }}>
              {stats.fastPct}% pünktlich
            </span>
          </div>
          <div className="mt-1 text-[10px] text-stone-400">
            {tier.label} · Min {stats.min.toFixed(0)} · Max {stats.max.toFixed(0)} · n={stats.count}
          </div>
        </div>
      </div>
    </div>
  );
}
