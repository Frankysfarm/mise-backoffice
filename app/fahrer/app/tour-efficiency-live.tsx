'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Zap, Clock, TrendingUp, CheckCircle2, Target, Trophy, Timer } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Stop = {
  id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
};

type Batch = {
  id: string;
  status: string;
  started_at: string | null;
  total_eta_min: number | null;
  total_distance_km: number | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h > 0) return `${h}h ${m}min`;
  return `${m} Min`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TourEffizienzLive({ batch, stops }: { batch: Batch | null; stops: Stop[] }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  if (!batch || stops.length === 0) return null;
  if (!batch.started_at) return null;

  // Core metrics
  const totalStops = stops.length;
  const completedStops = stops.filter((s) => s.geliefert_am != null).length;
  const remainingStops = totalStops - completedStops;

  const elapsedMin = (Date.now() - new Date(batch.started_at).getTime()) / 60_000;
  const targetMin = batch.total_eta_min;

  const progressPct = (completedStops / totalStops) * 100;
  const timePct = targetMin ? Math.min((elapsedMin / targetMin) * 100, 100) : 0;

  // Positive = ahead of schedule, negative = behind
  const efficiency = progressPct - timePct;

  const avgMinPerStop = completedStops > 0 ? elapsedMin / completedStops : null;

  const onTrack = efficiency >= -10;
  const isAhead = efficiency > 5;

  // Badge label + colors
  const badgeLabel = isAhead ? 'Voraus' : onTrack ? 'Im Plan' : 'Hinter Plan';
  const badgeBg = isAhead ? 'bg-accent/20' : onTrack ? 'bg-blue-500/20' : 'bg-red-500/20';
  const badgeText = isAhead ? 'text-accent' : onTrack ? 'text-blue-300' : 'text-red-300';

  // Motivational delta
  const deltaMin = targetMin ? Math.abs((efficiency / 100) * targetMin) : null;

  // Bar widths (capped at 100%)
  const timeBarPct = Math.min(timePct, 100);
  const progressBarPct = Math.min(progressPct, 100);

  // Race bar: which is wider tells the story
  const progressLeads = progressBarPct >= timeBarPct;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-matcha-300 shrink-0" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-matcha-300">
            Tour-Effizienz
          </span>
        </div>
        <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide', badgeBg, badgeText)}>
          {badgeLabel}
        </span>
      </div>

      {/* Race bar */}
      <div className="space-y-1.5">
        {/* Progress bar (Stopps abgeschlossen) */}
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-3 w-3 text-matcha-400 shrink-0" />
          <div className="flex-1 h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                progressLeads ? 'bg-accent' : 'bg-matcha-600',
              )}
              style={{ width: `${progressBarPct}%` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-matcha-300 w-8 text-right">
            {Math.round(progressPct)}%
          </span>
        </div>

        {/* Time bar (Zeit verstrichen) */}
        <div className="flex items-center gap-2">
          <Timer className="h-3 w-3 text-matcha-400 shrink-0" />
          <div className="flex-1 h-2.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                progressLeads ? 'bg-white/30' : 'bg-red-400',
              )}
              style={{ width: `${timeBarPct}%` }}
            />
          </div>
          <span className="text-[10px] tabular-nums text-matcha-400 w-8 text-right">
            {targetMin ? `${Math.round(timePct)}%` : '—'}
          </span>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 pt-0.5">
          <div className="flex items-center gap-1">
            <div className={cn('h-1.5 w-3 rounded-full', progressLeads ? 'bg-accent' : 'bg-matcha-600')} />
            <span className="text-[9px] text-matcha-500">Stopps</span>
          </div>
          <div className="flex items-center gap-1">
            <div className={cn('h-1.5 w-3 rounded-full', progressLeads ? 'bg-white/30' : 'bg-red-400')} />
            <span className="text-[9px] text-matcha-500">Zeit</span>
          </div>
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-2">
        {/* Ø Zeit/Stopp */}
        <div className="rounded-xl bg-white/5 border border-white/10 px-2 py-2 flex flex-col items-center gap-0.5">
          <Clock className="h-3 w-3 text-matcha-400 shrink-0" />
          <span className="text-[11px] font-bold tabular-nums text-matcha-100 leading-tight">
            {avgMinPerStop != null ? `${Math.round(avgMinPerStop)} Min` : '—'}
          </span>
          <span className="text-[9px] text-matcha-500 text-center leading-tight">Ø/Stopp</span>
        </div>

        {/* Stopps erledigt */}
        <div className="rounded-xl bg-white/5 border border-white/10 px-2 py-2 flex flex-col items-center gap-0.5">
          <Target className="h-3 w-3 text-matcha-400 shrink-0" />
          <span className="text-[11px] font-bold tabular-nums text-matcha-100 leading-tight">
            {completedStops}/{totalStops}
          </span>
          <span className="text-[9px] text-matcha-500 text-center leading-tight">Erledigt</span>
        </div>

        {/* Verbleibend */}
        <div className="rounded-xl bg-white/5 border border-white/10 px-2 py-2 flex flex-col items-center gap-0.5">
          <Zap className="h-3 w-3 text-matcha-400 shrink-0" />
          <span className="text-[11px] font-bold tabular-nums text-matcha-100 leading-tight">
            {remainingStops}
          </span>
          <span className="text-[9px] text-matcha-500 text-center leading-tight">Verbleibend</span>
        </div>
      </div>

      {/* Motivational message */}
      {deltaMin != null && deltaMin >= 1 && (
        <div
          className={cn(
            'flex items-center gap-1.5 rounded-xl px-2.5 py-2',
            isAhead ? 'bg-accent/10 border border-accent/20' : 'bg-red-500/10 border border-red-500/20',
          )}
        >
          {isAhead ? (
            <Trophy className="h-3.5 w-3.5 text-accent shrink-0" />
          ) : (
            <Clock className="h-3.5 w-3.5 text-red-400 shrink-0" />
          )}
          <span
            className={cn(
              'text-[11px] font-bold',
              isAhead ? 'text-accent' : 'text-red-300',
            )}
          >
            {isAhead
              ? `Super Tempo! +${formatMin(deltaMin)} Vorsprung`
              : `${formatMin(deltaMin)} hinter Plan`}
          </span>
        </div>
      )}
    </div>
  );
}
