'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, MapPin, Zap, TrendingUp } from 'lucide-react';

interface Stop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  angekommen_am: string | null;
  distanz_zum_vorgaenger_m?: number | null;
  order: {
    gesamtbetrag: number;
    eta_earliest?: string | null;
  };
}

interface Props {
  stops: Stop[];
  batchStartedAt?: string | null;
  totalDistanceKm?: number | null;
}

function useSecTick() {
  const [, set] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => set(n => n + 1), 5000);
    return () => clearInterval(iv);
  }, []);
}

export function TourKpiSummary({ stops, batchStartedAt, totalDistanceKm }: Props) {
  useSecTick();

  if (!stops || stops.length === 0) return null;

  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const completed = sorted.filter(s => !!s.geliefert_am);
  const pending = sorted.filter(s => !s.geliefert_am);
  const completedCount = completed.length;
  const totalCount = sorted.length;

  const totalRevenue = sorted.reduce((sum, s) => sum + (s.order.gesamtbetrag ?? 0), 0);
  const completedRevenue = completed.reduce((sum, s) => sum + (s.order.gesamtbetrag ?? 0), 0);

  const elapsedMin = batchStartedAt
    ? Math.floor((Date.now() - new Date(batchStartedAt).getTime()) / 60_000)
    : null;

  const deliveriesPerHour = elapsedMin && elapsedMin > 0 && completedCount > 0
    ? ((completedCount / elapsedMin) * 60).toFixed(1)
    : null;

  const nextStop = pending[0];
  const nextEtaMin = nextStop?.order.eta_earliest
    ? Math.max(0, Math.ceil((new Date(nextStop.order.eta_earliest).getTime() - Date.now()) / 60_000))
    : null;

  const onTimeCount = completed.filter(s => {
    if (!s.geliefert_am || !s.order.eta_earliest) return true;
    return new Date(s.geliefert_am) <= new Date(s.order.eta_earliest);
  }).length;
  const onTimeRate = completedCount > 0 ? Math.round((onTimeCount / completedCount) * 100) : null;

  return (
    <div className="rounded-2xl border border-accent/20 bg-matcha-800/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/5">
        <Zap size={11} className="text-accent shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-accent">
          Tour KPIs
        </span>
        <div className="ml-auto flex items-center gap-1">
          <span className={cn(
            'text-[10px] font-black tabular-nums px-1.5 py-0.5 rounded-full',
            completedCount === totalCount
              ? 'bg-accent/20 text-accent'
              : 'bg-white/10 text-matcha-300',
          )}>
            {completedCount}/{totalCount}
          </span>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-px bg-white/5">
        {/* Progress */}
        <div className="bg-matcha-900/40 px-3 py-2">
          <div className="flex items-center gap-1 text-[9px] text-matcha-400 mb-0.5">
            <CheckCircle2 size={8} />
            Fortschritt
          </div>
          <div className="text-sm font-black text-matcha-50 tabular-nums">
            {totalCount > 0 ? `${Math.round((completedCount / totalCount) * 100)}%` : '–'}
          </div>
          {/* Mini progress bar */}
          <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-accent transition-all duration-500"
              style={{ width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Next ETA */}
        <div className="bg-matcha-900/40 px-3 py-2">
          <div className="flex items-center gap-1 text-[9px] text-matcha-400 mb-0.5">
            <Clock size={8} />
            Nächster Stopp
          </div>
          <div className={cn(
            'text-sm font-black tabular-nums',
            nextEtaMin != null && nextEtaMin < 5 ? 'text-orange-400' : 'text-matcha-50',
          )}>
            {nextEtaMin != null
              ? nextEtaMin <= 0 ? 'Jetzt!' : `~${nextEtaMin} Min`
              : pending.length > 0 ? `${pending.length} offen` : 'Fertig!'}
          </div>
          <div className="text-[9px] text-matcha-500 mt-0.5">ETA</div>
        </div>

        {/* Distance */}
        <div className="bg-matcha-900/40 px-3 py-2">
          <div className="flex items-center gap-1 text-[9px] text-matcha-400 mb-0.5">
            <MapPin size={8} />
            Strecke
          </div>
          <div className="text-sm font-black text-matcha-50 tabular-nums">
            {totalDistanceKm != null ? `${totalDistanceKm.toFixed(1)} km` : '–'}
          </div>
          {elapsedMin != null && (
            <div className="text-[9px] text-matcha-500 mt-0.5">{elapsedMin} Min unterwegs</div>
          )}
        </div>

        {/* On-Time Rate or Revenue */}
        <div className="bg-matcha-900/40 px-3 py-2">
          <div className="flex items-center gap-1 text-[9px] text-matcha-400 mb-0.5">
            <TrendingUp size={8} />
            Pünktlichkeit
          </div>
          <div className={cn(
            'text-sm font-black tabular-nums',
            onTimeRate == null ? 'text-matcha-500'
              : onTimeRate >= 80 ? 'text-accent'
              : onTimeRate >= 60 ? 'text-amber-400'
              : 'text-red-400',
          )}>
            {onTimeRate != null ? `${onTimeRate}%` : '–'}
          </div>
          <div className="text-[9px] text-matcha-500 mt-0.5">
            {completedCount > 0 ? `${onTimeCount}/${completedCount} pünktlich` : 'keine Daten'}
          </div>
        </div>
      </div>

      {/* Revenue footer */}
      {totalRevenue > 0 && (
        <div className="px-3 py-2 border-t border-white/5 flex items-center justify-between">
          <span className="text-[10px] text-matcha-400">Tour-Wert</span>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-matcha-400 tabular-nums">
              {completedCount > 0 && `€${completedRevenue.toFixed(2)} kassiert`}
            </span>
            <span className="text-xs font-black text-accent tabular-nums">
              €{totalRevenue.toFixed(2)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
