'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Order = {
  id: string;
  bestellt_am: string | null;
};

interface Props {
  orders: Order[];
}

function ordersPerHourInWindow(orders: Order[], windowMs: number, now: number): number {
  const cutoff = now - windowMs;
  const count = orders.filter((o) => {
    if (!o.bestellt_am) return false;
    const t = new Date(o.bestellt_am).getTime();
    return t >= cutoff && t <= now;
  }).length;
  return Math.round((count / (windowMs / 3_600_000)) * 10) / 10;
}

function Arc({ rate, max = 12 }: { rate: number; max?: number }) {
  const pct = Math.min(1, rate / max);
  const r = 34;
  const cx = 44;
  const cy = 44;
  const startAngle = 210;
  const sweepDeg = 120;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const endAngle = startAngle + sweepDeg * pct;

  const arcPath = (from: number, to: number, radius: number) => {
    const x1 = cx + radius * Math.cos(toRad(from));
    const y1 = cy + radius * Math.sin(toRad(from));
    const x2 = cx + radius * Math.cos(toRad(to));
    const y2 = cy + radius * Math.sin(toRad(to));
    const large = to - from > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2}`;
  };

  const color = rate >= 8 ? '#dc2626' : rate >= 5 ? '#d97706' : '#4a7c59';

  return (
    <svg width={88} height={60} viewBox="0 0 88 60">
      <path
        d={arcPath(startAngle, startAngle + sweepDeg, r)}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth={9}
        strokeLinecap="round"
      />
      {pct > 0 && (
        <path
          d={arcPath(startAngle, endAngle, r)}
          fill="none"
          stroke={color}
          strokeWidth={9}
          strokeLinecap="round"
          style={{ transition: 'all 0.9s ease' }}
        />
      )}
      <text x={cx} y={cy - 2} textAnchor="middle" className="font-black" fontSize={14} fontWeight={900} fill={color}>
        {rate.toFixed(1)}
      </text>
      <text x={cx} y={cy + 11} textAnchor="middle" fontSize={8} fill="#9ca3af">
        /Std
      </text>
    </svg>
  );
}

export function KitchenBestellTaktMeter({ orders }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(iv);
  }, []);

  void tick;

  const now = Date.now();
  const current = ordersPerHourInWindow(orders, 60 * 60_000, now);
  const prev = ordersPerHourInWindow(orders, 60 * 60_000, now - 60 * 60_000);

  if (orders.length === 0) return null;

  const trend = current > prev + 0.5 ? 'up' : current < prev - 0.5 ? 'down' : 'flat';
  const bg =
    current >= 8 ? 'bg-red-50 border-red-200' : current >= 5 ? 'bg-amber-50 border-amber-200' : 'bg-matcha-50 border-matcha-200';
  const label = current >= 8 ? 'Hohe Auslastung' : current >= 5 ? 'Mittlere Auslastung' : 'Ruhige Phase';

  return (
    <div className={cn('rounded-xl border p-3 flex items-center gap-3', bg)}>
      <div className="shrink-0">
        <Arc rate={current} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <Activity className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Bestell-Takt
          </span>
          {trend === 'up' && <TrendingUp className="h-3 w-3 text-red-500 ml-auto" />}
          {trend === 'down' && <TrendingDown className="h-3 w-3 text-matcha-600 ml-auto" />}
          {trend === 'flat' && <Minus className="h-3 w-3 text-muted-foreground ml-auto" />}
        </div>
        <div className="text-xs font-bold text-foreground">{label}</div>
        <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
          <span>Letzte Std: <span className="font-bold text-foreground">{current.toFixed(1)}/h</span></span>
          <span>Vorherige: <span className="font-bold">{prev.toFixed(1)}/h</span></span>
        </div>
      </div>
    </div>
  );
}
