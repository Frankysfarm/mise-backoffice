'use client';

import React, { useEffect, useState } from 'react';
import { Activity, Clock, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

type Order = {
  id: string;
  status: string;
  bestellt_am: string | null;
  fertig_am: string | null;
  geschaetzte_zubereitung_min: number | null;
};

interface Props {
  orders: Order[];
}

function computeTakt(orders: Order[]) {
  const now = Date.now();
  const windowMs = 60 * 60_000; // letzte 60 min

  const completed = orders.filter(
    (o) =>
      ['fertig', 'geliefert', 'abgeholt', 'abgeschlossen'].includes(o.status) &&
      o.fertig_am &&
      now - new Date(o.fertig_am).getTime() < windowMs,
  );

  const throughput = completed.length; // Bestellungen/Stunde

  const pending = orders.filter((o) =>
    ['bestätigt', 'in_zubereitung'].includes(o.status),
  );

  const avgPrepMs =
    pending.length > 0
      ? (pending.reduce((s, o) => s + (o.geschaetzte_zubereitung_min ?? 15) * 60_000, 0) /
          pending.length)
      : 15 * 60_000;

  // Älteste offene Bestellung → Countdown bis Expected-Ready
  const oldest = pending
    .filter((o) => o.bestellt_am)
    .sort((a, b) => new Date(a.bestellt_am!).getTime() - new Date(b.bestellt_am!).getTime())[0];

  const countdownMs = oldest
    ? Math.max(
        0,
        new Date(oldest.bestellt_am!).getTime() + avgPrepMs - now,
      )
    : null;

  let status: 'green' | 'amber' | 'red' = 'green';
  if (pending.length >= 8) status = 'red';
  else if (pending.length >= 4) status = 'amber';
  if (countdownMs !== null && countdownMs === 0) status = 'red';

  return { throughput, pending: pending.length, countdownMs, status, avgPrepMin: Math.round(avgPrepMs / 60_000) };
}

export function KitchenPhase775SchichtTaktCockpit({ orders }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const { throughput, pending, countdownMs, status, avgPrepMin } = computeTakt(orders);

  const colorMap = {
    green: {
      ring: 'ring-matcha-400',
      bg: 'bg-matcha-50 border-matcha-200',
      dot: 'bg-matcha-500',
      label: 'Takt OK',
      labelColor: 'text-matcha-700',
      bar: 'bg-matcha-500',
    },
    amber: {
      ring: 'ring-amber-400',
      bg: 'bg-amber-50 border-amber-200',
      dot: 'bg-amber-400',
      label: 'Takt erhöht',
      labelColor: 'text-amber-700',
      bar: 'bg-amber-400',
    },
    red: {
      ring: 'ring-red-400',
      bg: 'bg-red-50 border-red-200',
      dot: 'bg-red-500',
      label: 'Takt kritisch',
      labelColor: 'text-red-700',
      bar: 'bg-red-500',
    },
  };

  const c = colorMap[status];

  const countdownSec = countdownMs !== null ? Math.floor(countdownMs / 1000) : null;
  const mm = countdownSec !== null ? Math.floor(countdownSec / 60) : null;
  const ss = countdownSec !== null ? String(countdownSec % 60).padStart(2, '0') : null;

  const fillPct = Math.min(100, (pending / 10) * 100);

  return (
    <div className={cn('rounded-xl border px-4 py-3 space-y-3', c.bg)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
          <span className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Phase 775 · Schicht-Takt-Cockpit
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full animate-pulse', c.dot)} />
          <span className={cn('text-[10px] font-black', c.labelColor)}>{c.label}</span>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-white/70 border border-black/5 px-2 py-2">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <TrendingUp className="h-3 w-3 text-matcha-600" />
          </div>
          <div className="font-black text-base tabular-nums text-foreground">{throughput}</div>
          <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-wide">Fertig/Std</div>
        </div>

        <div className="rounded-lg bg-white/70 border border-black/5 px-2 py-2">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Zap className="h-3 w-3 text-amber-500" />
          </div>
          <div className={cn('font-black text-base tabular-nums', pending >= 8 ? 'text-red-600' : pending >= 4 ? 'text-amber-600' : 'text-foreground')}>
            {pending}
          </div>
          <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-wide">In Queue</div>
        </div>

        <div className="rounded-lg bg-white/70 border border-black/5 px-2 py-2">
          <div className="flex items-center justify-center gap-1 mb-0.5">
            <Clock className="h-3 w-3 text-blue-500" />
          </div>
          <div className="font-black text-base tabular-nums text-blue-700">
            {avgPrepMin}m
          </div>
          <div className="text-[8px] font-bold text-muted-foreground uppercase tracking-wide">Ø Prep-Zeit</div>
        </div>
      </div>

      {/* Queue-Auslastungs-Balken */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wide">Queue-Auslastung</span>
          <span className="text-[9px] font-bold text-muted-foreground tabular-nums">{pending}/10</span>
        </div>
        <div className="h-2 rounded-full bg-black/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', c.bar)}
            style={{ width: `${fillPct}%` }}
          />
        </div>
      </div>

      {/* Countdown älteste offene Bestellung */}
      {countdownMs !== null && mm !== null && ss !== null && (
        <div className={cn(
          'flex items-center gap-2 rounded-lg px-3 py-2',
          countdownMs === 0
            ? 'bg-red-100 border border-red-300'
            : 'bg-white/60 border border-black/5',
        )}>
          <Clock className={cn('h-3.5 w-3.5 shrink-0', countdownMs === 0 ? 'text-red-600' : 'text-muted-foreground')} />
          <span className="text-[10px] text-muted-foreground">Älteste Bestellung fertig in</span>
          <span className={cn('ml-auto font-mono font-black tabular-nums', countdownMs === 0 ? 'text-red-600 animate-pulse' : 'text-foreground')}>
            {countdownMs === 0 ? 'ÜBERFÄLLIG' : `${mm}:${ss}`}
          </span>
        </div>
      )}
    </div>
  );
}
