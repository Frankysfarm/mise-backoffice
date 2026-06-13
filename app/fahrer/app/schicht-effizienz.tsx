'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, Zap, Target } from 'lucide-react';

type Props = {
  deliveries: number;
  onlineMin: number;
  estEarnings: number;
};

const TARGET_PER_HOUR = 4;

export function SchichtEffizienzMeter({ deliveries, onlineMin, estEarnings }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  if (onlineMin < 5 || deliveries === 0) return null;

  const hoursOnline = onlineMin / 60;
  const ratePerHour = deliveries / hoursOnline;
  const efficiency = Math.min(ratePerHour / TARGET_PER_HOUR, 1.5); // cap bar at 150%
  const pct = Math.min(efficiency * 100, 100);

  const isGreat = ratePerHour >= TARGET_PER_HOUR;
  const isOk = ratePerHour >= TARGET_PER_HOUR * 0.7;

  const projectedEarnings8h = (estEarnings / hoursOnline) * 8;

  const statusLabel = isGreat
    ? 'Top-Tempo!'
    : isOk
    ? 'Gutes Tempo'
    : 'Unter Ziel';

  const barColor = isGreat
    ? 'bg-accent'
    : isOk
    ? 'bg-amber-400'
    : 'bg-red-400';

  const textColor = isGreat
    ? 'text-accent'
    : isOk
    ? 'text-amber-300'
    : 'text-red-300';

  return (
    <div className="mt-3 rounded-xl bg-white/5 border border-white/10 px-3 py-2.5 space-y-2">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-matcha-300 shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-matcha-300">Schicht-Tempo</span>
        </div>
        <span className={cn('text-[10px] font-black uppercase tracking-wide', textColor)}>
          {statusLabel}
        </span>
      </div>

      {/* Rate vs target */}
      <div className="flex items-end gap-1.5">
        <span className={cn('font-display font-black text-xl leading-none tabular-nums', textColor)}>
          {ratePerHour.toFixed(1)}
        </span>
        <span className="text-[10px] text-matcha-400 pb-0.5">/h</span>
        <span className="text-[10px] text-matcha-500 pb-0.5 ml-1">
          Ziel: {TARGET_PER_HOUR}/h
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Target className="h-3 w-3 text-matcha-400 shrink-0" />
          <span className="text-[10px] font-bold tabular-nums text-matcha-300">
            {Math.round(pct)}%
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-white/10 overflow-hidden relative">
        <div
          className={cn('h-full rounded-full transition-all duration-700', barColor)}
          style={{ width: `${pct}%` }}
        />
        {/* Target marker at 100% / 66.7% */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-white/30" style={{ left: '100%', transform: 'translateX(-1px)' }} />
      </div>

      {/* Projection row */}
      {projectedEarnings8h > 0 && (
        <div className="flex items-center gap-1.5 text-[9px] text-matcha-400">
          <Zap className="h-2.5 w-2.5 shrink-0" />
          <span>
            Hochgerechnet auf 8h:{' '}
            <span className={cn('font-bold tabular-nums', textColor)}>
              {projectedEarnings8h.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 })}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
