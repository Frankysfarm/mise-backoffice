'use client';

/**
 * Phase 1875 — Tour-Effizienz-Score-Board
 * Kompakter Score-Überblick aller aktiven Touren: Effizienz-Score je Tour
 * (basierend auf: Stopps abgeschlossen / ETA verbraucht × Pünktlichkeit).
 * Keine API nötig — berechnet aus Batch-Daten.
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, Target, Bike, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Stop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  angekommen_am?: string | null;
};

type Batch = {
  id: string;
  status: string;
  total_eta_min: number | null;
  startzeit?: string | null;
  started_at?: string | null;
  zone?: string | null;
  fahrer?: { vorname: string; nachname: string } | null;
  driver?: { name?: string } | null;
  stops: Stop[];
};

type TourScore = {
  batchId: string;
  driverName: string;
  zone: string | null;
  score: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D';
  completedStops: number;
  totalStops: number;
  usedPct: number;
  donePct: number;
  status: 'ahead' | 'on-time' | 'behind';
};

function calcScore(completed: number, total: number, usedPct: number): number {
  if (total === 0) return 0;
  const progressEfficiency = total > 0 ? completed / total : 0;
  const timeEfficiency = usedPct > 0 ? progressEfficiency / usedPct : 1;
  return Math.min(100, Math.round(timeEfficiency * 100));
}

function getGrade(score: number): TourScore['grade'] {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

const GRADE_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  S: { bg: 'bg-purple-500', text: 'text-white', border: 'border-purple-300' },
  A: { bg: 'bg-matcha-500', text: 'text-white', border: 'border-matcha-300' },
  B: { bg: 'bg-blue-500', text: 'text-white', border: 'border-blue-300' },
  C: { bg: 'bg-amber-400', text: 'text-white', border: 'border-amber-300' },
  D: { bg: 'bg-red-500', text: 'text-white', border: 'border-red-300' },
};

export function DispatchPhase1875TourEffizienzScoreBoard({ batches }: { batches: Batch[] }) {
  const now = Date.now();

  const scores = useMemo<TourScore[]>(() => {
    return batches
      .filter(b => b.status === 'unterwegs' || b.status === 'on_route' || b.status === 'aktiv')
      .map(b => {
        const startMs = b.started_at
          ? new Date(b.started_at).getTime()
          : b.startzeit
            ? new Date(b.startzeit).getTime()
            : null;
        const etaMin = b.total_eta_min ?? null;
        const elapsedMin = startMs ? (now - startMs) / 60_000 : 0;
        const usedPct = etaMin && etaMin > 0 ? Math.min(1, elapsedMin / etaMin) : 0;
        const completed = b.stops.filter(s => s.geliefert_am !== null).length;
        const total = b.stops.length;
        const donePct = total > 0 ? completed / total : 0;
        const score = calcScore(completed, total, usedPct);
        const grade = getGrade(score);

        let status: TourScore['status'];
        const delta = donePct - usedPct;
        if (delta > 0.1) status = 'ahead';
        else if (delta < -0.15) status = 'behind';
        else status = 'on-time';

        const driverName = b.fahrer
          ? `${b.fahrer.vorname} ${b.fahrer.nachname[0]}.`
          : b.driver?.name ?? 'Fahrer';

        return {
          batchId: b.id,
          driverName,
          zone: b.zone ?? null,
          score,
          grade,
          completedStops: completed,
          totalStops: total,
          usedPct,
          donePct,
          status,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [batches, now]);

  if (scores.length === 0) return null;

  const avgScore = Math.round(scores.reduce((s, r) => s + r.score, 0) / scores.length);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
        <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">
          Tour-Effizienz-Score · Aktive Touren
        </span>
        <div className="flex items-center gap-1 rounded-full bg-card border px-2.5 py-0.5">
          <Target className="h-3 w-3 text-matcha-600" />
          <span className="text-[11px] font-bold tabular-nums text-matcha-600">
            Ø {avgScore}
          </span>
        </div>
      </div>

      {/* Score rows */}
      <div className="divide-y">
        {scores.map((row, idx) => {
          const gs = GRADE_STYLE[row.grade];
          const StatusIcon = row.status === 'ahead'
            ? TrendingUp
            : row.status === 'behind'
              ? TrendingDown
              : Minus;
          const statusColor = row.status === 'ahead'
            ? 'text-matcha-600'
            : row.status === 'behind'
              ? 'text-red-500'
              : 'text-muted-foreground';

          return (
            <div key={row.batchId} className="flex items-center gap-3 px-4 py-2.5">
              {/* Rank */}
              <span className="text-[11px] font-bold text-muted-foreground w-4 shrink-0 text-right">
                {idx + 1}
              </span>

              {/* Grade Badge */}
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black',
                  gs.bg,
                  gs.text,
                )}
              >
                {row.grade}
              </div>

              {/* Driver + Zone */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Bike className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs font-bold truncate">{row.driverName}</span>
                  {row.zone && (
                    <span className="text-[9px] rounded-full bg-muted px-1.5 py-0.5 font-bold shrink-0">
                      {row.zone}
                    </span>
                  )}
                </div>
                {/* Progress bar */}
                <div className="mt-1 flex items-center gap-1.5">
                  <div className="relative flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    {/* ETA used (background) */}
                    <div
                      className="absolute left-0 top-0 h-full bg-muted-foreground/20 rounded-full"
                      style={{ width: `${Math.min(100, row.usedPct * 100)}%` }}
                    />
                    {/* Stops done (foreground) */}
                    <div
                      className={cn(
                        'absolute left-0 top-0 h-full rounded-full transition-all duration-700',
                        row.status === 'ahead' ? 'bg-matcha-500'
                          : row.status === 'behind' ? 'bg-red-400'
                          : 'bg-blue-500',
                      )}
                      style={{ width: `${Math.min(100, row.donePct * 100)}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-bold tabular-nums text-muted-foreground shrink-0">
                    {row.completedStops}/{row.totalStops}
                  </span>
                </div>
              </div>

              {/* Score + Status */}
              <div className="flex items-center gap-2 shrink-0">
                <StatusIcon className={cn('h-3.5 w-3.5', statusColor)} />
                <span className="text-sm font-black tabular-nums text-foreground">
                  {row.score}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer legend */}
      <div className="border-t px-4 py-2 flex items-center gap-4 flex-wrap">
        <span className="text-[9px] text-muted-foreground">Score = Stopps-Fortschritt ÷ Zeit-Fortschritt × 100</span>
        <div className="flex items-center gap-2 ml-auto">
          {(['S', 'A', 'B', 'C', 'D'] as const).map(g => (
            <span
              key={g}
              className={cn(
                'flex h-4 w-4 items-center justify-center rounded text-[9px] font-black',
                GRADE_STYLE[g].bg,
                GRADE_STYLE[g].text,
              )}
            >
              {g}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
