'use client';

/**
 * TourStatusHeader — Kompaktes Tour-Überblick-Panel für die Fahrer-App.
 *
 * Zeigt beim aktiven Batch auf einen Blick:
 * - Fortschritt: X von Y Stopps erledigt
 * - Elapsed Zeit seit Tourstart
 * - Verbleibende ETA
 * - Durchschnittliche Zeit pro Stopp
 *
 * Positionierung: direkt unter dem Online-Button, über TourStopsPanel.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, Route, TrendingUp, Zap } from 'lucide-react';

type Stop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  angekommen_am: string | null;
  distanz_zum_vorgaenger_m?: number | null;
};

type ActiveBatch = {
  id: string;
  status: string;
  started_at: string | null;
  total_eta_min?: number | null;
  total_distance_km?: number | null;
  stops: Stop[];
};

function useTick(intervalMs = 1000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), intervalMs);
    return () => clearInterval(iv);
  }, [intervalMs]);
}

function fmtDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 60) return `${totalMin} Min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function TourStatusHeader({
  activeBatch,
}: {
  activeBatch: ActiveBatch | null;
}) {
  useTick(10_000);

  if (!activeBatch) return null;

  const now = Date.now();
  const stops = activeBatch.stops;
  const completed = stops.filter(s => !!s.geliefert_am);
  const pending = stops.filter(s => !s.geliefert_am);
  const total = stops.length;
  const completedCount = completed.length;
  const progressPct = total > 0 ? Math.round((completedCount / total) * 100) : 0;

  const startedMs = activeBatch.started_at ? new Date(activeBatch.started_at).getTime() : null;
  const elapsedMs = startedMs ? now - startedMs : null;
  const elapsedMin = elapsedMs ? Math.floor(elapsedMs / 60_000) : null;

  // ETA: if started + total_eta_min → when does it finish?
  const etaMs =
    startedMs && activeBatch.total_eta_min != null
      ? startedMs + activeBatch.total_eta_min * 60_000
      : null;
  const remainingMs = etaMs ? Math.max(0, etaMs - now) : null;

  // Avg time per completed stop
  const avgMinPerStop =
    completedCount >= 1 && elapsedMs != null
      ? Math.round(elapsedMs / 60_000 / completedCount)
      : null;

  const allDone = pending.length === 0 && total > 0;

  if (total === 0) return null;

  return (
    <div className={cn(
      'rounded-2xl border p-3 space-y-2 transition-all',
      allDone
        ? 'border-accent/50 bg-accent/10'
        : 'border-white/15 bg-white/5',
    )}>
      {/* Tour progress bar */}
      <div className="flex items-center gap-2">
        <Route className="h-3.5 w-3.5 text-accent shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-wider text-accent">
          Tour · {completedCount}/{total} Stopps
        </span>
        <span className="ml-auto text-[10px] text-matcha-400 tabular-nums">{progressPct}%</span>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700',
            allDone ? 'bg-accent' : progressPct >= 50 ? 'bg-accent/80' : 'bg-accent/50',
          )}
          style={{ width: `${progressPct}%` }}
        />
        {/* Stop markers */}
        {total > 1 && Array.from({ length: total - 1 }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-px bg-matcha-900/40"
            style={{ left: `${((i + 1) / total) * 100}%` }}
          />
        ))}
      </div>

      {/* KPI strip */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Elapsed */}
        {elapsedMin != null && (
          <div className="flex items-center gap-1 text-[10px]">
            <Clock className="h-3 w-3 text-matcha-400 shrink-0" />
            <span className="text-matcha-400">Aktiv seit</span>
            <span className="font-bold text-matcha-200 tabular-nums">{fmtDuration(elapsedMs!)}</span>
          </div>
        )}

        {/* Remaining */}
        {remainingMs != null && !allDone && (
          <div className="flex items-center gap-1 text-[10px]">
            <Zap className={cn(
              'h-3 w-3 shrink-0',
              remainingMs < 5 * 60_000 ? 'text-orange-400' : 'text-matcha-400',
            )} />
            <span className={cn(remainingMs < 5 * 60_000 ? 'text-orange-300' : 'text-matcha-400')}>
              noch ca.
            </span>
            <span className={cn(
              'font-bold tabular-nums',
              remainingMs < 5 * 60_000 ? 'text-orange-300' : 'text-matcha-200',
            )}>
              {fmtDuration(remainingMs)}
            </span>
          </div>
        )}

        {/* Avg per stop */}
        {avgMinPerStop != null && completedCount > 0 && (
          <div className="flex items-center gap-1 text-[10px]">
            <TrendingUp className="h-3 w-3 text-matcha-400 shrink-0" />
            <span className="text-matcha-400">Ø</span>
            <span className={cn(
              'font-bold tabular-nums',
              avgMinPerStop <= 12 ? 'text-accent' : avgMinPerStop <= 18 ? 'text-amber-300' : 'text-orange-400',
            )}>
              {avgMinPerStop} Min/Stopp
            </span>
          </div>
        )}

        {/* Distance */}
        {activeBatch.total_distance_km != null && activeBatch.total_distance_km > 0 && (
          <div className="flex items-center gap-1 text-[10px]">
            <span className="text-matcha-400">📍</span>
            <span className="font-bold text-matcha-200 tabular-nums">
              {activeBatch.total_distance_km.toFixed(1)} km
            </span>
          </div>
        )}

        {/* All done celebration */}
        {allDone && (
          <div className="ml-auto flex items-center gap-1.5 rounded-full bg-accent/20 border border-accent/40 px-2.5 py-1">
            <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
            <span className="text-[10px] font-black text-accent">Alle Stopps erledigt!</span>
          </div>
        )}
      </div>
    </div>
  );
}
