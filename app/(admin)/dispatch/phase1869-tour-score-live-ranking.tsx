'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronDown, ChevronUp, Star, TrendingDown, TrendingUp, Minus, AlertTriangle,
} from 'lucide-react';

/**
 * Phase 1869 — Tour-Score-Live-Ranking (Dispatch)
 *
 * Live-Rangliste aller aktiven Touren nach Dispatch-Score:
 *  - Score 0–100 als Fortschrittsring (Farb-kodiert)
 *  - Aufschlüsselung: Pünktlichkeit / Auslastung / Stopp-Fortschritt
 *  - Trend-Pfeil (↑ steigend / ↓ fallend / — stabil)
 *  - Alarm-Badge bei Score < 50
 * Rein client-seitig aus Batch-Props — kein API-Call.
 */

interface Stop {
  id: string;
  status: string;
  sequence?: number | null;
}

interface Batch {
  id: string;
  driver_id: string | null;
  driver_name?: string | null;
  zone?: string | null;
  state?: string;
  created_at?: string | null;
  estimated_return_at?: string | null;
  stops?: Stop[] | null;
  dispatch_score?: number | null;
  stops_count?: number | null;
}

interface TourRank {
  id: string;
  driverName: string;
  zone: string;
  score: number;
  stopsTotal: number;
  stopsDone: number;
  punctuality: number;
  trend: 'up' | 'down' | 'flat';
  isLate: boolean;
  isAlarm: boolean;
}

function calcScore(batch: Batch, now: number): TourRank | null {
  if (!['assigned', 'at_restaurant', 'on_route', 'pending_acceptance'].includes(batch.state ?? '')) {
    return null;
  }
  const stops = batch.stops ?? [];
  const stopsTotal = batch.stops_count ?? stops.length;
  const stopsDone = stops.filter((s) =>
    ['geliefert', 'abgeschlossen', 'delivered'].includes(s.status),
  ).length;
  const completionPct = stopsTotal > 0 ? stopsDone / stopsTotal : 0;

  let isLate = false;
  let punctuality = 90;
  if (batch.estimated_return_at) {
    const eta = new Date(batch.estimated_return_at).getTime();
    if (eta < now) {
      isLate = true;
      punctuality = Math.max(20, 90 - Math.round((now - eta) / 60_000) * 5);
    }
  }

  const rawScore = batch.dispatch_score != null
    ? batch.dispatch_score
    : Math.round(
        completionPct * 40 +
        punctuality * 0.4 +
        (stopsTotal >= 3 ? 20 : stopsTotal >= 2 ? 10 : 5),
      );
  const score = Math.min(100, Math.max(0, rawScore));

  return {
    id: batch.id,
    driverName: batch.driver_name ?? `Fahrer ${(batch.driver_id ?? batch.id).slice(-4)}`,
    zone: batch.zone ?? '—',
    score,
    stopsTotal,
    stopsDone,
    punctuality,
    trend: completionPct > 0.6 ? 'up' : isLate ? 'down' : 'flat',
    isLate,
    isAlarm: score < 50,
  };
}

function scoreColor(score: number) {
  if (score >= 75) return { ring: 'text-matcha-500', bar: 'bg-matcha-500', badge: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300', row: '' };
  if (score >= 50) return { ring: 'text-amber-500', bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', row: '' };
  return { ring: 'text-red-500', bar: 'bg-red-500', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', row: 'border-red-200 dark:border-red-800' };
}

const TrendIcon = ({ trend }: { trend: TourRank['trend'] }) => {
  if (trend === 'up') return <TrendingUp className="h-3 w-3 text-matcha-500" />;
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
};

interface Props {
  batches: Batch[];
  className?: string;
}

export function DispatchPhase1869TourScoreLiveRanking({ batches, className }: Props) {
  const [open, setOpen] = useState(true);
  const now = Date.now();

  const ranks = useMemo(() => {
    return batches
      .map((b) => calcScore(b, now))
      .filter((r): r is TourRank => r !== null)
      .sort((a, b) => b.score - a.score);
  }, [batches]);

  if (ranks.length === 0) return null;

  const alarmCount = ranks.filter((r) => r.isAlarm).length;
  const avgScore = Math.round(ranks.reduce((s, r) => s + r.score, 0) / ranks.length);

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Tour-Score-Ranking
          </span>
          <span className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-bold',
            scoreColor(avgScore).badge,
          )}>
            Ø {avgScore} · {ranks.length} Touren
          </span>
          {alarmCount > 0 && (
            <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-bold animate-pulse">
              {alarmCount} Alarm
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Live-Rangliste · Score 0–100 · Grün ≥75 · Gelb 50–74 · Rot &lt;50
          </div>
          {ranks.map((r, idx) => {
            const c = scoreColor(r.score);
            return (
              <div
                key={r.id}
                className={cn(
                  'flex items-center gap-3 rounded-xl border px-3 py-2.5',
                  r.isAlarm ? c.row : 'border-border',
                )}
              >
                <span className="text-xs font-black text-muted-foreground w-5 text-right shrink-0">
                  #{idx + 1}
                </span>

                {/* Score ring */}
                <div className="relative shrink-0 w-11 h-11">
                  <svg viewBox="0 0 36 36" className="w-11 h-11 -rotate-90">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="currentColor" strokeWidth="3" className="text-muted/30" />
                    <circle
                      cx="18" cy="18" r="14"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray={`${(r.score / 100) * 87.96} 87.96`}
                      strokeLinecap="round"
                      className={c.ring}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[11px] font-black">
                    {r.score}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold truncate">{r.driverName}</span>
                    <TrendIcon trend={r.trend} />
                    {r.isLate && (
                      <span className="text-[9px] font-bold text-red-600 uppercase">Verspätet</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[80px]">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', c.bar)}
                        style={{ width: `${r.score}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                      {r.stopsDone}/{r.stopsTotal} Stopps
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      Zone {r.zone}
                    </span>
                  </div>
                </div>

                {r.isAlarm && (
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                )}
              </div>
            );
          })}

          {alarmCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 px-4 py-2 mt-1">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0" />
              <span className="text-xs font-bold text-red-700 dark:text-red-300">
                {alarmCount} Tour{alarmCount !== 1 ? 'en' : ''} unter Score 50 — Eingriff empfohlen
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
