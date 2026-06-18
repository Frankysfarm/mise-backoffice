'use client';

import { cn } from '@/lib/utils';
import { Navigation, Route, Zap, Clock, TrendingUp, Leaf } from 'lucide-react';

interface Stop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  angekommen_am: string | null;
  order: {
    kunde_lat: number | null;
    kunde_lng: number | null;
    eta_earliest: string | null;
    eta_latest: string | null;
  };
}

interface Props {
  stops: Stop[];
  batchStartedAt: string | null;
  totalEtaMin: number | null;
  totalDistanceKm: number | null;
}

function calcOnTimeRate(stops: Stop[]): number | null {
  const completed = stops.filter(s => s.geliefert_am !== null);
  if (completed.length === 0) return null;
  const onTime = completed.filter(s => {
    if (!s.geliefert_am || !s.order.eta_latest) return false;
    return new Date(s.geliefert_am) <= new Date(s.order.eta_latest);
  });
  return (onTime.length / completed.length) * 100;
}

function calcAvgMinPerStop(stops: Stop[], batchStartedAt: string | null): number | null {
  const completed = stops.filter(s => s.geliefert_am !== null);
  if (completed.length === 0 || !batchStartedAt) return null;
  const lastDelivery = completed.reduce<string | null>((latest, s) => {
    if (!s.geliefert_am) return latest;
    if (!latest) return s.geliefert_am;
    return new Date(s.geliefert_am) > new Date(latest) ? s.geliefert_am : latest;
  }, null);
  if (!lastDelivery) return null;
  const elapsedMin = (new Date(lastDelivery).getTime() - new Date(batchStartedAt).getTime()) / 60_000;
  return elapsedMin > 0 ? elapsedMin / completed.length : null;
}

export function FahrerRouteQualitaet({ stops, batchStartedAt, totalEtaMin, totalDistanceKm }: Props) {
  if (stops.length === 0) return null;

  const completedCount = stops.filter(s => s.geliefert_am !== null).length;
  const tourEfficiency = Math.round((completedCount / stops.length) * 100);
  const onTimeRate = calcOnTimeRate(stops);
  const avgMinPerStop = calcAvgMinPerStop(stops, batchStartedAt);
  const isEco = totalDistanceKm !== null && totalDistanceKm < 5;

  const scoreColor =
    tourEfficiency >= 80 ? 'bg-matcha-500' :
    tourEfficiency >= 50 ? 'bg-amber-400' :
    'bg-red-400';

  const scoreLabelColor =
    tourEfficiency >= 80 ? 'text-matcha-400' :
    tourEfficiency >= 50 ? 'text-amber-300' :
    'text-red-300';

  return (
    <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Route className="h-3.5 w-3.5 text-matcha-300 shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-matcha-300">
            Routen-Qualität
          </span>
          {isEco && (
            <span className="flex items-center gap-0.5 ml-1 rounded-full bg-matcha-900/60 px-1.5 py-0.5">
              <Leaf className="h-2.5 w-2.5 text-matcha-400" />
              <span className="text-[9px] text-matcha-400 font-bold">Öko</span>
            </span>
          )}
        </div>
        <span className={cn('text-[10px] font-black uppercase tracking-wide tabular-nums', scoreLabelColor)}>
          {tourEfficiency}%
        </span>
      </div>

      {/* Efficiency progress bar */}
      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', scoreColor)}
          style={{ width: `${tourEfficiency}%` }}
        />
      </div>

      {/* Metrics strip */}
      <div className="grid grid-cols-3 divide-x divide-white/10">
        {/* Pünktlich */}
        <div className="flex flex-col items-center gap-0.5 pr-2">
          <TrendingUp className="h-3 w-3 text-matcha-400" />
          <span className="text-[13px] font-black tabular-nums text-white/90 leading-none">
            {onTimeRate !== null ? `${Math.round(onTimeRate)}%` : '--'}
          </span>
          <span className="text-[9px] text-white/40 uppercase tracking-wide">Pünktlich</span>
        </div>

        {/* Distanz */}
        <div className="flex flex-col items-center gap-0.5 px-2">
          <Navigation className="h-3 w-3 text-matcha-400" />
          <span className="text-[13px] font-black tabular-nums text-white/90 leading-none">
            {totalDistanceKm !== null ? `${totalDistanceKm.toFixed(1)}` : '--'}
          </span>
          <span className="text-[9px] text-white/40 uppercase tracking-wide">Distanz km</span>
        </div>

        {/* Ø Zeit/Stop */}
        <div className="flex flex-col items-center gap-0.5 pl-2">
          <Clock className="h-3 w-3 text-matcha-400" />
          <span className="text-[13px] font-black tabular-nums text-white/90 leading-none">
            {avgMinPerStop !== null ? `${Math.round(avgMinPerStop)}` : '--'}
          </span>
          <span className="text-[9px] text-white/40 uppercase tracking-wide">Ø Zeit/Stop</span>
        </div>
      </div>
    </div>
  );
}
