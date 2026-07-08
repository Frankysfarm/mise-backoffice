'use client';

/**
 * Phase 684 — Tour-Score Live-Anzeige
 * Zeigt den Live-Score aktiver Touren als farbkodierte Kacheln.
 * Score = Kombination aus Pünktlichkeit, Stoppanzahl und ETA-Genauigkeit.
 * Props: batches[], drivers[], stops[]
 */

import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, ChevronDown, ChevronUp, Bike, MapPin } from 'lucide-react';

type Batch = {
  id: string;
  driver_id?: string | null;
  status?: string;
  started_at?: string | null;
  total_eta_min?: number | null;
  zone?: string | null;
};
type Stop = {
  id: string;
  batch_id?: string;
  geliefert_am?: string | null;
};
type Driver = {
  id: string;
  name?: string;
  score?: number | null;
};

type ScoreLevel = 'excellent' | 'good' | 'ok' | 'poor';

function getScoreLevel(score: number): ScoreLevel {
  if (score >= 90) return 'excellent';
  if (score >= 75) return 'good';
  if (score >= 55) return 'ok';
  return 'poor';
}

const SCORE_STYLE: Record<ScoreLevel, { bg: string; border: string; text: string; badge: string; stars: number }> = {
  excellent: { bg: 'bg-matcha-50 dark:bg-matcha-950/20', border: 'border-matcha-200 dark:border-matcha-800', text: 'text-matcha-700 dark:text-matcha-300', badge: 'bg-matcha-500 text-white', stars: 5 },
  good:      { bg: 'bg-blue-50 dark:bg-blue-950/20',     border: 'border-blue-200 dark:border-blue-800',     text: 'text-blue-700 dark:text-blue-300',     badge: 'bg-blue-500 text-white',  stars: 4 },
  ok:        { bg: 'bg-amber-50 dark:bg-amber-950/20',   border: 'border-amber-200 dark:border-amber-800',   text: 'text-amber-700 dark:text-amber-300',   badge: 'bg-amber-400 text-white', stars: 3 },
  poor:      { bg: 'bg-red-50 dark:bg-red-950/20',       border: 'border-red-200 dark:border-red-800',       text: 'text-red-700 dark:text-red-300',       badge: 'bg-red-500 text-white',   stars: 1 },
};

function computeScore(batch: Batch, stops: Stop[]): number {
  const now = Date.now();
  const batchStops = stops.filter((s) => s.batch_id === batch.id);
  const delivered = batchStops.filter((s) => s.geliefert_am).length;
  const total = batchStops.length || 1;
  const progressPct = (delivered / total) * 100;

  let score = 60 + progressPct * 0.3;

  if (batch.started_at && batch.total_eta_min) {
    const startedMs = new Date(batch.started_at).getTime();
    const targetMs = startedMs + batch.total_eta_min * 60_000;
    const remainMs = targetMs - now;
    const totalMs = batch.total_eta_min * 60_000;
    const usedPct = ((totalMs - remainMs) / totalMs) * 100;
    const lead = progressPct - usedPct;
    if (lead > 10) score += 10;
    else if (lead < -15) score -= 15;
    else if (lead < -5) score -= 5;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function DispatchPhase684TourScoreLiveAnzeige({
  batches,
  drivers,
  stops,
}: {
  batches: Batch[];
  drivers: Driver[];
  stops: Stop[];
}) {
  const [open, setOpen] = useState(true);

  const activeBatches = useMemo(
    () => batches.filter((b) => b.status === 'unterwegs' || b.status === 'on_route' || b.status === 'active'),
    [batches],
  );

  const rows = useMemo(
    () =>
      activeBatches.map((batch) => {
        const driver = drivers.find((d) => d.id === batch.driver_id);
        const batchStops = stops.filter((s) => s.batch_id === batch.id);
        const delivered = batchStops.filter((s) => s.geliefert_am).length;
        const score = computeScore(batch, stops);
        const level = getScoreLevel(score);
        return { batch, driver, delivered, totalStops: batchStops.length, score, level };
      })
      .sort((a, b) => b.score - a.score),
    [activeBatches, drivers, stops],
  );

  const avgScore = rows.length
    ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length)
    : null;

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="font-semibold text-sm">Tour-Score Live</span>
          <span className="text-xs text-muted-foreground">
            {rows.length} aktive Tour{rows.length !== 1 ? 'en' : ''}
            {avgScore !== null && ` · Ø ${avgScore} Punkte`}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {rows.map(({ batch, driver, delivered, totalStops, score, level }) => {
            const s = SCORE_STYLE[level];
            return (
              <div
                key={batch.id}
                className={cn('rounded-lg border p-3 flex flex-col gap-1.5', s.bg, s.border)}
              >
                {/* Fahrername */}
                <div className="flex items-center gap-1">
                  <Bike className={cn('h-3 w-3 shrink-0', s.text)} />
                  <span className="text-xs font-bold truncate" title={driver?.name ?? '—'}>
                    {driver?.name ?? '—'}
                  </span>
                </div>

                {/* Zone */}
                {batch.zone && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-[10px] text-muted-foreground">Zone {batch.zone}</span>
                  </div>
                )}

                {/* Score */}
                <div className={cn('text-3xl font-black tabular-nums text-center leading-none mt-1', s.text)}>
                  {score}
                </div>
                <div className="text-[10px] text-center text-muted-foreground">Punkte</div>

                {/* Stars */}
                <div className="flex items-center justify-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'h-2.5 w-2.5',
                        i < SCORE_STYLE[level].stars ? 'text-amber-400 fill-amber-400' : 'text-muted-foreground/30',
                      )}
                    />
                  ))}
                </div>

                {/* Fortschritt */}
                <div className="text-[10px] text-center text-muted-foreground">
                  {delivered}/{totalStops} Stopps
                </div>

                {/* Fortschrittsbalken */}
                <div className="h-1 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700',
                      level === 'excellent' ? 'bg-matcha-500' : level === 'good' ? 'bg-blue-500' : level === 'ok' ? 'bg-amber-400' : 'bg-red-500',
                    )}
                    style={{ width: totalStops ? `${(delivered / totalStops) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
