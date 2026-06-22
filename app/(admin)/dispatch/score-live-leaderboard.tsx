'use client';

/**
 * Phase 423 – DispatchScoreLiveLeaderboard
 * Live ranking of all active drivers by tour efficiency score.
 * Shows score breakdown, stops progress, and ETA status.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, Bike, Clock, CheckCircle2, AlertTriangle, TrendingUp, Target, Navigation2 } from 'lucide-react';

type BatchStop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
};

type Batch = {
  id: string;
  status: string;
  dispatch_score?: number | null;
  total_eta_min: number | null;
  total_distance_km: number | null;
  stop_count?: number | null;
  started_at?: string | null;
  startzeit?: string | null;
  zone: string | null;
  fahrer: {
    id?: string;
    vorname: string;
    nachname: string;
  } | null;
  stops: BatchStop[];
};

interface Props {
  batches: Batch[];
}

type LeaderRow = {
  batchId: string;
  driverName: string;
  zone: string | null;
  score: number;
  scoreTier: 'S' | 'A' | 'B' | 'C' | 'D';
  stopsTotal: number;
  stopsDone: number;
  progressPct: number;
  elapsedMin: number;
  remainMin: number | null;
  onTrack: boolean;
};

function scoreTier(score: number): LeaderRow['scoreTier'] {
  if (score >= 90) return 'S';
  if (score >= 75) return 'A';
  if (score >= 60) return 'B';
  if (score >= 45) return 'C';
  return 'D';
}

const tierStyle: Record<LeaderRow['scoreTier'], { bg: string; text: string; border: string }> = {
  S: { bg: 'bg-matcha-500', text: 'text-white', border: 'border-matcha-400' },
  A: { bg: 'bg-matcha-400', text: 'text-white', border: 'border-matcha-300' },
  B: { bg: 'bg-amber-400', text: 'text-white', border: 'border-amber-300' },
  C: { bg: 'bg-orange-400', text: 'text-white', border: 'border-orange-300' },
  D: { bg: 'bg-red-500', text: 'text-white', border: 'border-red-400' },
};

const tierBarColor: Record<LeaderRow['scoreTier'], string> = {
  S: 'bg-matcha-500',
  A: 'bg-matcha-400',
  B: 'bg-amber-400',
  C: 'bg-orange-400',
  D: 'bg-red-500',
};

export function DispatchScoreLiveLeaderboard({ batches }: Props) {
  const [tick, setTick] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const activeBatches = batches.filter((b) =>
    ['assigned', 'at_restaurant', 'on_route', 'active'].includes(b.status),
  );

  if (activeBatches.length === 0) return null;

  const rows: LeaderRow[] = activeBatches
    .map((b) => {
      const stopsTotal = b.stops?.length ?? b.stop_count ?? 0;
      const stopsDone = b.stops?.filter((s) => s.geliefert_am !== null).length ?? 0;
      const progressPct = stopsTotal > 0 ? Math.round((stopsDone / stopsTotal) * 100) : 0;

      const batchStart = b.started_at ?? b.startzeit ?? null;
      const elapsedMin = batchStart
        ? Math.round((Date.now() - new Date(batchStart).getTime()) / 60_000)
        : 0;

      const remainMin =
        b.total_eta_min && batchStart
          ? Math.max(0, Math.round(b.total_eta_min - elapsedMin))
          : null;

      const rawScore = b.dispatch_score ?? 50;
      const driverName = b.fahrer
        ? `${b.fahrer.vorname} ${b.fahrer.nachname.charAt(0)}.`
        : 'Unbekannt';

      const onTrack = remainMin !== null && progressPct >= (100 - (remainMin / (b.total_eta_min ?? 60)) * 100) - 15;
      const tier = scoreTier(rawScore);

      return {
        batchId: b.id,
        driverName,
        zone: b.zone,
        score: rawScore,
        scoreTier: tier,
        stopsTotal,
        stopsDone,
        progressPct,
        elapsedMin,
        remainMin,
        onTrack,
      } satisfies LeaderRow;
    })
    .sort((a, b) => b.score - a.score);

  const best = rows[0];
  const worst = rows[rows.length - 1];

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors"
        onClick={() => setCollapsed((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100">
            <Trophy className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <span className="text-sm font-bold text-gray-900">Fahrer Score-Rangliste</span>
          <span className="text-xs text-gray-400">({activeBatches.length} aktiv)</span>
          {best && (
            <span className="hidden sm:inline text-[10px] text-matcha-700 font-semibold">
              Beste: {best.driverName} ({best.score})
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{collapsed ? '▼' : '▲'}</span>
      </button>

      {!collapsed && (
        <div className="border-t border-stone-100">
          {/* Summary strip */}
          <div className="flex gap-4 px-4 py-2 bg-stone-50 text-xs text-gray-600 border-b border-stone-100">
            <span className="flex items-center gap-1">
              <Target className="h-3 w-3 text-matcha-600" />
              Ø Score: <strong className="ml-0.5">{Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length)}</strong>
            </span>
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              Top: <strong className="ml-0.5 text-matcha-700">{best?.driverName}</strong>
            </span>
            {rows.length > 1 && (
              <span className="flex items-center gap-1 text-orange-600">
                <AlertTriangle className="h-3 w-3" />
                Schlusslicht: <strong className="ml-0.5">{worst?.driverName}</strong>
              </span>
            )}
          </div>

          {/* Leaderboard rows */}
          <div className="divide-y divide-stone-50">
            {rows.map((row, idx) => {
              const ts = tierStyle[row.scoreTier];
              const barColor = tierBarColor[row.scoreTier];

              return (
                <div key={row.batchId} className="flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors">
                  {/* Rank */}
                  <div className="shrink-0 w-6 text-center">
                    {idx === 0 ? (
                      <span className="text-base">🥇</span>
                    ) : idx === 1 ? (
                      <span className="text-base">🥈</span>
                    ) : idx === 2 ? (
                      <span className="text-base">🥉</span>
                    ) : (
                      <span className="text-xs font-bold text-gray-400">#{idx + 1}</span>
                    )}
                  </div>

                  {/* Score badge */}
                  <div
                    className={cn(
                      'shrink-0 w-10 h-10 rounded-xl flex flex-col items-center justify-center border',
                      ts.bg, ts.text, ts.border,
                    )}
                  >
                    <span className="text-xs font-black leading-none">{row.score}</span>
                    <span className="text-[8px] font-bold leading-none mt-0.5 opacity-80">{row.scoreTier}</span>
                  </div>

                  {/* Driver + progress */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-gray-900 truncate">{row.driverName}</span>
                      {row.zone && (
                        <span className="text-[9px] rounded-full bg-stone-100 border px-1.5 py-0.5 font-semibold text-stone-600">
                          Zone {row.zone}
                        </span>
                      )}
                      {!row.onTrack && row.remainMin !== null && (
                        <span className="text-[9px] text-orange-600 font-semibold flex items-center gap-0.5">
                          <AlertTriangle className="h-2.5 w-2.5" /> verzögert
                        </span>
                      )}
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-700', barColor)}
                          style={{ width: `${row.progressPct}%` }}
                        />
                      </div>
                      <span className="shrink-0 text-[9px] font-bold text-gray-500 tabular-nums">
                        {row.stopsDone}/{row.stopsTotal}
                      </span>
                    </div>
                  </div>

                  {/* Time info */}
                  <div className="shrink-0 text-right space-y-0.5">
                    <div className="flex items-center justify-end gap-1 text-xs text-gray-700 font-semibold tabular-nums">
                      <Clock className="h-3 w-3 text-gray-400" />
                      {row.elapsedMin}m
                    </div>
                    {row.remainMin !== null && (
                      <div className={cn(
                        'text-[10px] font-bold tabular-nums',
                        row.remainMin <= 5 ? 'text-red-500' : row.remainMin <= 15 ? 'text-amber-600' : 'text-matcha-600',
                      )}>
                        ~{row.remainMin}m rest
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
