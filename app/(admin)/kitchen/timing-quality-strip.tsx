'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2, Clock, Target } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
};

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

export function KitchenTimingQualityStrip({
  timings,
  orders,
}: {
  timings: KitchenTiming[];
  orders: Order[];
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 5_000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();
  const cookingTimings = timings.filter((t) => t.status === 'cooking' && t.ready_target);

  // Untracked active orders (cooking but no timing)
  const activeCooking = orders.filter((o) => o.status === 'in_zubereitung');
  const untrackedCount = activeCooking.filter(
    (o) => !timings.find((t) => t.order_id === o.id && t.ready_target),
  ).length;

  if (cookingTimings.length === 0 && untrackedCount === 0) return null;

  let onSchedule = 0;
  let atRisk = 0;
  let late = 0;

  for (const t of cookingTimings) {
    const readyMs = new Date(t.ready_target!).getTime();
    const secLeft = (readyMs - now) / 1000;
    if (secLeft > 120) onSchedule++;
    else if (secLeft > -60) atRisk++;
    else late++;
  }

  const total = cookingTimings.length;
  const qualityPct = total > 0 ? Math.round((onSchedule / total) * 100) : null;

  const stripBg =
    qualityPct === null
      ? 'bg-stone-50 border-stone-200'
      : qualityPct >= 80
      ? 'bg-matcha-50 border-matcha-200'
      : qualityPct >= 55
      ? 'bg-amber-50 border-amber-200'
      : 'bg-red-50 border-red-200';

  const qualityColor =
    qualityPct === null
      ? 'text-stone-600'
      : qualityPct >= 80
      ? 'text-matcha-700'
      : qualityPct >= 55
      ? 'text-amber-700'
      : 'text-red-700';

  return (
    <div className={cn('rounded-xl border px-4 py-2.5 flex flex-wrap items-center gap-x-5 gap-y-2', stripBg)}>
      {/* Quality label */}
      <div className="flex items-center gap-2 shrink-0">
        <Target className={cn('h-4 w-4 shrink-0', qualityColor)} />
        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          Timing-Qualität
        </span>
        {qualityPct !== null && (
          <span className={cn('text-xl font-black tabular-nums leading-none', qualityColor)}>
            {qualityPct}%
          </span>
        )}
      </div>

      {/* Breakdown badges */}
      <div className="flex items-center gap-2.5 text-[11px] flex-wrap">
        {onSchedule > 0 && (
          <span className="flex items-center gap-1 text-matcha-600 font-bold">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {onSchedule} im Plan
          </span>
        )}
        {atRisk > 0 && (
          <span className="flex items-center gap-1 text-amber-600 font-bold animate-pulse">
            <Clock className="h-3.5 w-3.5" />
            {atRisk} knapp
          </span>
        )}
        {late > 0 && (
          <span className="flex items-center gap-1 text-red-600 font-bold">
            <AlertTriangle className="h-3.5 w-3.5" />
            {late} überfällig
          </span>
        )}
        {untrackedCount > 0 && (
          <span className="flex items-center gap-1 text-stone-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-stone-300 inline-block" />
            {untrackedCount} ohne Timing
          </span>
        )}
      </div>

      {/* Visual bar */}
      {total > 0 && (
        <div className="flex-1 min-w-24 flex items-center gap-2 ml-auto">
          <div className="flex-1 h-2 rounded-full overflow-hidden flex bg-stone-100">
            {onSchedule > 0 && (
              <div
                className="h-full bg-matcha-500 transition-all duration-700"
                style={{ width: `${(onSchedule / total) * 100}%` }}
              />
            )}
            {atRisk > 0 && (
              <div
                className="h-full bg-amber-400 transition-all duration-700"
                style={{ width: `${(atRisk / total) * 100}%` }}
              />
            )}
            {late > 0 && (
              <div
                className="h-full bg-red-500 transition-all duration-700"
                style={{ width: `${(late / total) * 100}%` }}
              />
            )}
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
            {total} getrackt
          </span>
        </div>
      )}
    </div>
  );
}
