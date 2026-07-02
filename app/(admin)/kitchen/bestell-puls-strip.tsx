'use client';

import { useEffect, useRef, useState } from 'react';
import { Activity, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  status: string;
  bestellt_am: string | null;
  lieferdatum?: string | null;
}

interface Props {
  orders: Order[];
}

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(iv);
  }, [intervalMs]);
  return now;
}

export function KitchenBestellungsPulsStrip({ orders }: Props) {
  const now = useNow(30_000);
  const prevRateRef = useRef<number | null>(null);

  // Orders in the last 5 minutes
  const window5m = orders.filter((o) => {
    if (!o.bestellt_am) return false;
    return (now - new Date(o.bestellt_am).getTime()) <= 5 * 60_000;
  });
  const ratePerHour = Math.round(window5m.length * 12); // 5min window → /h

  // Orders currently in preparation
  const inPrep = orders.filter((o) => o.status === 'in_zubereitung');

  // Average age of in-prep orders (in minutes)
  const prepAges = inPrep
    .map((o) => o.bestellt_am ? (now - new Date(o.bestellt_am).getTime()) / 60_000 : null)
    .filter((a): a is number => a !== null);
  const avgPrepMin = prepAges.length > 0
    ? Math.round(prepAges.reduce((s, v) => s + v, 0) / prepAges.length)
    : null;

  // Trend vs previous measurement
  const prevRate = prevRateRef.current;
  const trend = prevRate === null ? 'neutral' : ratePerHour > prevRate ? 'up' : ratePerHour < prevRate ? 'down' : 'neutral';
  useEffect(() => { prevRateRef.current = ratePerHour; }, [ratePerHour]);

  const urgencyLevel = ratePerHour >= 30 ? 'high' : ratePerHour >= 15 ? 'medium' : 'low';

  const levelStyle = {
    high:   { bar: 'bg-red-400',    text: 'text-red-700',    bg: 'bg-red-50',   label: 'Hochbetrieb' },
    medium: { bar: 'bg-amber-400',  text: 'text-amber-700',  bg: 'bg-amber-50', label: 'Normalbetrieb' },
    low:    { bar: 'bg-matcha-400', text: 'text-matcha-700', bg: 'bg-matcha-50',label: 'Ruhig' },
  }[urgencyLevel];

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <div className={cn('rounded-xl border flex items-center gap-3 px-3 py-2 overflow-hidden', levelStyle.bg)}>
      {/* Pulse dot */}
      <span className="relative flex h-2.5 w-2.5 shrink-0">
        <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-60', levelStyle.bar)} />
        <span className={cn('relative inline-flex rounded-full h-2.5 w-2.5', levelStyle.bar)} />
      </span>

      {/* Rate */}
      <div className="flex items-baseline gap-1">
        <span className={cn('text-sm font-black tabular-nums', levelStyle.text)}>{ratePerHour}</span>
        <span className="text-[9px] text-stone-500 font-semibold">Best/h</span>
      </div>

      <TrendIcon className={cn('w-3 h-3 shrink-0', levelStyle.text)} />

      {/* Separator */}
      <div className="w-px h-4 bg-black/10 shrink-0" />

      {/* In prep */}
      <div className="flex items-baseline gap-1">
        <Activity className="w-3 h-3 text-stone-400 shrink-0" />
        <span className="text-xs font-bold text-stone-700">{inPrep.length} in Zubereitung</span>
      </div>

      {avgPrepMin !== null && (
        <>
          <div className="w-px h-4 bg-black/10 shrink-0" />
          <div className="flex items-baseline gap-1">
            <span className={cn('text-xs font-bold tabular-nums', avgPrepMin > 20 ? 'text-red-600' : avgPrepMin > 12 ? 'text-amber-600' : 'text-matcha-600')}>
              Ø {avgPrepMin} Min
            </span>
          </div>
        </>
      )}

      {/* Status label */}
      <span className={cn('ml-auto text-[9px] font-black uppercase tracking-wider shrink-0', levelStyle.text)}>
        {levelStyle.label}
      </span>
    </div>
  );
}
