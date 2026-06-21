'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Timer, TrendingUp, TrendingDown } from 'lucide-react';

type Stop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  angekommen_am: string | null;
};

interface Props {
  stops: Stop[];
  startedAt: string | null;
}

function computeRhythmus(stops: Stop[], startedAt: string | null) {
  const delivered = stops.filter((s) => s.geliefert_am).sort((a, b) => a.reihenfolge - b.reihenfolge);
  if (delivered.length === 0 || !startedAt) return null;

  const startMs = new Date(startedAt).getTime();
  const lastDelivered = delivered[delivered.length - 1];
  const lastMs = new Date(lastDelivered.geliefert_am!).getTime();
  const elapsedMin = (lastMs - startMs) / 60_000;
  const avgMinPerStop = delivered.length > 0 ? elapsedMin / delivered.length : null;

  const remaining = stops.filter((s) => !s.geliefert_am).length;

  return {
    delivered: delivered.length,
    remaining,
    total: stops.length,
    avgMinPerStop: avgMinPerStop !== null ? Math.round(avgMinPerStop * 10) / 10 : null,
    etaFinishMin:
      avgMinPerStop !== null && remaining > 0 ? Math.round(avgMinPerStop * remaining) : null,
  };
}

export function FahrerStopRhythmusMeter({ stops, startedAt }: Props) {
  const data = useMemo(() => computeRhythmus(stops, startedAt), [stops, startedAt]);

  if (!data || data.delivered === 0) return null;

  const { delivered, remaining, total, avgMinPerStop, etaFinishMin } = data;
  const pct = Math.round((delivered / total) * 100);

  const pace =
    avgMinPerStop === null
      ? 'neutral'
      : avgMinPerStop <= 10
        ? 'fast'
        : avgMinPerStop <= 16
          ? 'normal'
          : 'slow';

  const paceColor =
    pace === 'fast' ? 'text-matcha-700' : pace === 'normal' ? 'text-amber-600' : 'text-red-600';
  const bg =
    pace === 'fast' ? 'bg-matcha-50 border-matcha-200' : pace === 'normal' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  return (
    <div className={cn('rounded-xl border p-3 space-y-2', bg)}>
      <div className="flex items-center gap-2">
        <Timer className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex-1">
          Stop-Rhythmus
        </span>
        {pace === 'fast' && <TrendingUp className="h-3 w-3 text-matcha-600" />}
        {pace === 'slow' && <TrendingDown className="h-3 w-3 text-red-500" />}
      </div>

      <div className="flex items-center gap-3">
        <div className="text-center shrink-0">
          {avgMinPerStop !== null ? (
            <>
              <div className={cn('text-2xl font-black tabular-nums', paceColor)}>
                {avgMinPerStop.toFixed(1)}
              </div>
              <div className="text-[9px] text-muted-foreground font-semibold">Min/Stopp</div>
            </>
          ) : (
            <div className="text-sm text-muted-foreground">—</div>
          )}
        </div>

        <div className="flex-1 space-y-1.5">
          <div className="flex justify-between text-[11px]">
            <span className="text-muted-foreground">Geliefert</span>
            <span className="font-bold">{delivered}/{total}</span>
          </div>
          <div className="h-2 rounded-full bg-black/10 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                pace === 'fast' ? 'bg-matcha-500' : pace === 'normal' ? 'bg-amber-400' : 'bg-red-400',
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          {etaFinishMin !== null && remaining > 0 && (
            <div className="text-[10px] text-muted-foreground">
              Noch ca.{' '}
              <span className={cn('font-bold', paceColor)}>{etaFinishMin} Min</span> bis Tourende
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
