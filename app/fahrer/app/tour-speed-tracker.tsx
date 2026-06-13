'use client';

/**
 * TourSpeedTracker — Echtzeit-Tempo-Anzeige während einer aktiven Tour.
 * Zeigt dem Fahrer seinen aktuellen Pace (Stops/h) vs. benötigtes Tempo,
 * die verbleibende Zeit und eine motivierende Prognose.
 * Ergänzt SchichtPuls (schichtweite KPIs) mit tourenspezifischen Live-Daten.
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, Target, TrendingUp, Zap } from 'lucide-react';

type Stop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  angekommen_am: string | null;
};

type PaceLevel = 'ahead' | 'on-track' | 'behind' | 'at-risk';

const PACE_META: Record<PaceLevel, { label: string; color: string; bg: string; bar: string; emoji: string }> = {
  ahead:    { label: 'Sehr schnell!',  color: 'text-matcha-700', bg: 'bg-matcha-50',  bar: 'bg-matcha-500', emoji: '🚀' },
  'on-track': { label: 'Im Zeitplan', color: 'text-blue-700',   bg: 'bg-blue-50',    bar: 'bg-blue-500',   emoji: '✅' },
  behind:   { label: 'Leicht hinter Plan', color: 'text-amber-700', bg: 'bg-amber-50', bar: 'bg-amber-500', emoji: '⚡' },
  'at-risk': { label: 'ETA gefährdet!', color: 'text-red-700',  bg: 'bg-red-50',     bar: 'bg-red-500',    emoji: '⚠️' },
};

function useLiveTick(intervalMs = 10_000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((n) => n + 1), intervalMs);
    return () => clearInterval(iv);
  }, [intervalMs]);
}

export function TourSpeedTracker({
  stops,
  batchStartedAt,
  totalEtaMin,
}: {
  stops: Stop[];
  batchStartedAt: string | null;
  totalEtaMin: number | null;
}) {
  useLiveTick(5_000);

  const stats = useMemo(() => {
    if (!batchStartedAt || stops.length === 0) return null;

    const now = Date.now();
    const startMs = new Date(batchStartedAt).getTime();
    const elapsedMs = now - startMs;
    const elapsedMin = elapsedMs / 60_000;
    const elapsedH = elapsedMin / 60;

    const completedStops = stops.filter((s) => !!s.geliefert_am);
    const remainingStops = stops.filter((s) => !s.geliefert_am);
    const totalStops = stops.length;

    // Time per completed stop (avg)
    const avgTimePerStop = completedStops.length > 0
      ? elapsedMin / completedStops.length
      : null;

    // Current pace: stops/h
    const currentPacePerH = elapsedH > 0.05 && completedStops.length > 0
      ? completedStops.length / elapsedH
      : null;

    // Required pace to finish on time
    const etaEndMs = totalEtaMin != null ? startMs + totalEtaMin * 60_000 : null;
    const timeRemainingMin = etaEndMs != null ? Math.max(0, (etaEndMs - now) / 60_000) : null;
    const requiredPacePerH = timeRemainingMin != null && timeRemainingMin > 0 && remainingStops.length > 0
      ? (remainingStops.length / timeRemainingMin) * 60
      : null;

    // Projected finish based on current pace
    const projectedFinishMin = avgTimePerStop != null && remainingStops.length > 0
      ? avgTimePerStop * remainingStops.length
      : null;

    const projectedAheadMin = timeRemainingMin != null && projectedFinishMin != null
      ? timeRemainingMin - projectedFinishMin
      : null;

    // Pace level
    let paceLevel: PaceLevel = 'on-track';
    if (projectedAheadMin != null) {
      if (projectedAheadMin > 5) paceLevel = 'ahead';
      else if (projectedAheadMin >= -3) paceLevel = 'on-track';
      else if (projectedAheadMin >= -8) paceLevel = 'behind';
      else paceLevel = 'at-risk';
    } else if (currentPacePerH != null && requiredPacePerH != null) {
      const ratio = currentPacePerH / requiredPacePerH;
      if (ratio > 1.2) paceLevel = 'ahead';
      else if (ratio >= 0.85) paceLevel = 'on-track';
      else if (ratio >= 0.6) paceLevel = 'behind';
      else paceLevel = 'at-risk';
    }

    // Progress bar pct (by stops, not time)
    const progressPct = totalStops > 0 ? (completedStops.length / totalStops) * 100 : 0;

    // Time bar pct (elapsed vs total)
    const timePct = totalEtaMin != null ? Math.min(100, (elapsedMin / totalEtaMin) * 100) : null;

    return {
      completedStops: completedStops.length,
      remainingStops: remainingStops.length,
      totalStops,
      elapsedMin: Math.round(elapsedMin),
      currentPacePerH: currentPacePerH != null ? Math.round(currentPacePerH * 10) / 10 : null,
      requiredPacePerH: requiredPacePerH != null ? Math.round(requiredPacePerH * 10) / 10 : null,
      avgTimePerStop: avgTimePerStop != null ? Math.round(avgTimePerStop) : null,
      timeRemainingMin: timeRemainingMin != null ? Math.round(timeRemainingMin) : null,
      projectedAheadMin: projectedAheadMin != null ? Math.round(projectedAheadMin) : null,
      paceLevel,
      progressPct,
      timePct,
    };
  }, [stops, batchStartedAt, totalEtaMin]);

  if (!stats || stats.totalStops === 0) return null;

  const meta = PACE_META[stats.paceLevel];
  const allDone = stats.remainingStops === 0;

  if (allDone) {
    return (
      <div className="rounded-2xl border border-accent/40 bg-accent/10 px-4 py-3 flex items-center gap-3">
        <CheckCircle2 className="h-6 w-6 text-accent shrink-0" />
        <div>
          <div className="font-bold text-accent text-sm">Tour abgeschlossen</div>
          <div className="text-[10px] text-matcha-400">
            {stats.totalStops} Stopps in {stats.elapsedMin} Minuten
            {stats.avgTimePerStop != null && ` · Ø ${stats.avgTimePerStop} Min/Stopp`}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-2xl border px-4 py-3 space-y-3', meta.bg, 'border-current/20')}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{meta.emoji}</span>
          <div>
            <div className={cn('font-black text-sm', meta.color)}>{meta.label}</div>
            <div className="text-[10px] text-muted-foreground">
              {stats.completedStops}/{stats.totalStops} Stopps · {stats.elapsedMin} Min vergangen
            </div>
          </div>
        </div>
        {stats.timeRemainingMin != null && (
          <div className="text-right">
            <div className={cn('font-mono font-black text-lg tabular-nums', meta.color)}>
              {stats.timeRemainingMin}m
            </div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wide">verbleibend</div>
          </div>
        )}
      </div>

      {/* Progress bars */}
      <div className="space-y-1.5">
        {/* Stop progress */}
        <div>
          <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
            <span>Stopps: {stats.completedStops}/{stats.totalStops}</span>
            <span>{stats.progressPct.toFixed(0)}%</span>
          </div>
          <div className="h-2 rounded-full bg-black/10 overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-700', meta.bar)}
              style={{ width: `${stats.progressPct}%` }}
            />
          </div>
        </div>

        {/* Time progress */}
        {stats.timePct != null && (
          <div>
            <div className="flex justify-between text-[9px] text-muted-foreground mb-0.5">
              <span>Zeit: {stats.elapsedMin}m / {totalEtaMin}m</span>
              <span>{stats.timePct.toFixed(0)}% der ETA</span>
            </div>
            <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-700',
                  stats.timePct > stats.progressPct + 10 ? 'bg-red-500' : 'bg-black/30',
                )}
                style={{ width: `${Math.min(100, stats.timePct)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* KPI chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {stats.currentPacePerH != null && (
          <div className="flex items-center gap-1 rounded-full bg-white/60 border border-white/80 px-2.5 py-1">
            <Zap className={cn('h-3 w-3', meta.color)} />
            <span className={cn('text-[10px] font-black tabular-nums', meta.color)}>
              {stats.currentPacePerH}/h
            </span>
            <span className="text-[9px] text-muted-foreground">aktuell</span>
          </div>
        )}
        {stats.requiredPacePerH != null && (
          <div className="flex items-center gap-1 rounded-full bg-white/60 border border-white/80 px-2.5 py-1">
            <Target className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-black tabular-nums text-muted-foreground">
              {stats.requiredPacePerH}/h
            </span>
            <span className="text-[9px] text-muted-foreground">benötigt</span>
          </div>
        )}
        {stats.avgTimePerStop != null && (
          <div className="flex items-center gap-1 rounded-full bg-white/60 border border-white/80 px-2.5 py-1">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <span className="text-[10px] font-black tabular-nums text-muted-foreground">
              Ø {stats.avgTimePerStop} Min
            </span>
            <span className="text-[9px] text-muted-foreground">/Stopp</span>
          </div>
        )}
        {stats.projectedAheadMin != null && Math.abs(stats.projectedAheadMin) > 1 && (
          <div className={cn(
            'flex items-center gap-1 rounded-full px-2.5 py-1',
            stats.projectedAheadMin > 0 ? 'bg-matcha-100 text-matcha-700' : 'bg-red-100 text-red-700',
          )}>
            <TrendingUp className="h-3 w-3" />
            <span className="text-[10px] font-black tabular-nums">
              {stats.projectedAheadMin > 0 ? '+' : ''}{stats.projectedAheadMin}m
            </span>
            <span className="text-[9px]">
              {stats.projectedAheadMin > 0 ? 'voraus' : 'hinter Plan'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
