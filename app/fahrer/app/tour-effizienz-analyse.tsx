'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { BarChart2, TrendingUp, Zap } from 'lucide-react';

interface TourData {
  stops: number;
  completedStops: number;
  startedAt: string | null;
  totalEarnings?: number;
  distanceKm?: number;
}

interface Props {
  tour: TourData | null;
  driverAvgStopsPerHour?: number;
  driverBestEarningsPerKm?: number;
}

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function TourEffizienzAnalyse({ tour, driverAvgStopsPerHour = 4.2, driverBestEarningsPerKm = 2.1 }: Props) {
  const analysis = useMemo(() => {
    if (!tour || !tour.startedAt || tour.completedStops === 0) return null;
    const elapsedH = (Date.now() - new Date(tour.startedAt).getTime()) / 3600000;
    if (elapsedH < 0.01) return null;

    const stopsPerHour = tour.completedStops / elapsedH;
    const earningsPerKm = tour.distanceKm && tour.totalEarnings
      ? tour.totalEarnings / tour.distanceKm
      : null;

    const stopsRatio = stopsPerHour / driverAvgStopsPerHour;
    const earningsRatio = earningsPerKm ? earningsPerKm / driverBestEarningsPerKm : null;

    const score = Math.min(100, Math.round(stopsRatio * 80 + (earningsRatio ?? stopsRatio) * 20));

    return { stopsPerHour, earningsPerKm, stopsRatio, earningsRatio, score, elapsedH };
  }, [tour, driverAvgStopsPerHour, driverBestEarningsPerKm]);

  if (!analysis) return null;

  const { stopsPerHour, earningsPerKm, stopsRatio, score } = analysis;

  const scoreColor =
    score >= 80 ? 'text-matcha-400' :
    score >= 60 ? 'text-blue-400' :
    score >= 40 ? 'text-amber-400' :
                  'text-red-400';

  const scoreLabel = score >= 80 ? '🔥 Top' : score >= 60 ? '👍 Gut' : score >= 40 ? '😐 Okay' : '⚠ Langsam';

  return (
    <section className="bg-gradient-to-br from-indigo-900/80 to-indigo-800/80 border border-indigo-700/50 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-indigo-300" />
          <span className="text-xs font-semibold text-indigo-200 uppercase tracking-wide">Effizienz-Analyse</span>
        </div>
        <div className={cn('text-2xl font-black tabular-nums', scoreColor)}>
          {score}
          <span className="text-xs font-bold text-indigo-300 ml-0.5">/100</span>
        </div>
      </div>

      <div className="text-center">
        <div className="text-sm font-bold text-white">{scoreLabel}</div>
        <div className="text-[10px] text-indigo-400 mt-0.5">Vergleich mit deinem Durchschnitt</div>
      </div>

      {/* Score-Balken */}
      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700',
            score >= 80 ? 'bg-matcha-400' :
            score >= 60 ? 'bg-blue-400' :
            score >= 40 ? 'bg-amber-400' : 'bg-red-400',
          )}
          style={{ width: `${score}%` }}
        />
      </div>

      {/* KPI-Kacheln */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/10 p-2.5 text-center">
          <div className="text-lg font-black tabular-nums text-white">
            {stopsPerHour.toFixed(1)}
          </div>
          <div className="text-[10px] text-indigo-300">Stops/Std</div>
          <div className={cn('text-[10px] font-bold mt-0.5', stopsRatio >= 1 ? 'text-matcha-400' : 'text-amber-400')}>
            {stopsRatio >= 1 ? '+' : ''}{Math.round((stopsRatio - 1) * 100)}% vs. Ø
          </div>
        </div>

        {earningsPerKm !== null ? (
          <div className="rounded-xl bg-white/10 p-2.5 text-center">
            <div className="text-lg font-black tabular-nums text-white">
              {fmtEur(earningsPerKm)}
            </div>
            <div className="text-[10px] text-indigo-300">pro km</div>
            <div className="text-[10px] font-bold mt-0.5 text-matcha-400">
              Best: {fmtEur(driverBestEarningsPerKm)}
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-white/10 p-2.5 text-center">
            <div className="text-lg font-black tabular-nums text-white">
              {tour?.completedStops ?? 0}
            </div>
            <div className="text-[10px] text-indigo-300">Stops erledigt</div>
            <div className="text-[10px] font-bold mt-0.5 text-indigo-300">
              von {tour?.stops ?? 0}
            </div>
          </div>
        )}
      </div>

      <div className="text-[10px] text-indigo-400 text-center">
        <TrendingUp className="inline h-3 w-3 mr-0.5" />
        Weiter so — du bist auf gutem Weg!
      </div>
    </section>
  );
}
