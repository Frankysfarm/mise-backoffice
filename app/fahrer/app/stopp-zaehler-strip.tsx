'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Package } from 'lucide-react';

type Stop = { id: string; reihenfolge: number; geliefert_am: string | null };

interface Props { stops: Stop[] }

export function FahrerStoppZaehlerStrip({ stops }: Props) {
  const { done, total, nextReihenfolge } = useMemo(() => {
    const d   = stops.filter(s => s.geliefert_am).length;
    const t   = stops.length;
    const nxt = stops.find(s => !s.geliefert_am)?.reihenfolge ?? null;
    return { done: d, total: t, nextReihenfolge: nxt };
  }, [stops]);

  if (total === 0) return null;

  const allDone = done === total;

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl px-4 py-2.5',
      allDone
        ? 'bg-matcha-900/60 border border-matcha-700/50'
        : 'bg-matcha-900/40 border border-matcha-800/40',
    )}>
      <Package className="h-4 w-4 shrink-0 text-matcha-400" />

      <div className="flex flex-1 items-center gap-1 overflow-hidden">
        {stops
          .slice()
          .sort((a, b) => a.reihenfolge - b.reihenfolge)
          .map(s => {
            const isNext = !allDone && s.reihenfolge === nextReihenfolge;
            const isDone = s.geliefert_am !== null;
            return (
              <div
                key={s.id}
                className={cn(
                  'h-2 max-w-[28px] flex-1 rounded-full transition-all duration-400',
                  isDone  ? 'bg-matcha-400'
                    : isNext ? 'animate-pulse bg-accent'
                    : 'bg-matcha-700/50',
                )}
              />
            );
          })}
      </div>

      <div className="shrink-0 text-right">
        <span className={cn(
          'text-sm font-black tabular-nums',
          allDone ? 'text-matcha-400' : 'text-white',
        )}>
          {done}
          <span className="text-[10px] font-bold text-matcha-500">/{total}</span>
        </span>
        <div className="text-[8px] font-semibold leading-none text-matcha-500">
          {allDone ? 'Fertig!' : nextReihenfolge ? `Stopp ${nextReihenfolge}` : 'aktiv'}
        </div>
      </div>
    </div>
  );
}
