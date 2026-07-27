'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Clock, Target, TrendingUp, MapPin, CheckCircle2, AlertTriangle } from 'lucide-react';

interface TourStop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order?: { bestellnummer?: string; status?: string } | null;
}

interface Batch {
  id: string;
  status: string;
  fahrer_id?: string | null;
  startzeit?: string | null;
  total_distance_km?: number | null;
  total_eta_min?: number | null;
  zone?: string | null;
  fahrer?: { vorname?: string; nachname?: string } | null;
  stops?: TourStop[];
  _source?: string;
}

interface Props {
  batches: Batch[];
}

function scoreColor(score: number) {
  if (score >= 85) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 65) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBg(score: number) {
  if (score >= 85) return 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800';
  if (score >= 65) return 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800';
  return 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800';
}

function tourScore(batch: Batch, now: number): number {
  let score = 70;
  const stops = batch.stops ?? [];
  const delivered = stops.filter(s => s.geliefert_am).length;
  const total = stops.length;

  if (total > 0) {
    score += Math.round((delivered / total) * 20);
  }

  if (batch.startzeit) {
    const elapsedMin = (now - new Date(batch.startzeit).getTime()) / 60_000;
    const expected = (batch.total_eta_min ?? 45);
    if (elapsedMin < expected * 0.8) score += 10;
    else if (elapsedMin > expected * 1.2) score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}

function driverName(batch: Batch) {
  if (!batch.fahrer) return 'Fahrer';
  return [batch.fahrer.vorname, batch.fahrer.nachname].filter(Boolean).join(' ').trim() || 'Fahrer';
}

function elapsedLabel(startzeit: string | null | undefined, now: number) {
  if (!startzeit) return '—';
  const min = Math.round((now - new Date(startzeit).getTime()) / 60_000);
  if (min < 60) return `${min} Min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function TourScoreKompakt({ batches }: Props) {
  const now = Date.now();

  const activeBatches = useMemo(() =>
    batches.filter(b => ['aktiv', 'unterwegs', 'in_progress', 'active'].includes(b.status)),
    [batches]
  );

  if (activeBatches.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-4 flex items-center gap-3 text-muted-foreground text-sm">
        <Bike className="h-4 w-4 shrink-0" />
        Keine aktiven Touren
      </div>
    );
  }

  const avgScore = Math.round(activeBatches.reduce((sum, b) => sum + tourScore(b, now), 0) / activeBatches.length);
  const below65 = activeBatches.filter(b => tourScore(b, now) < 65).length;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-matcha-600" />
          <span className="text-xs font-bold uppercase tracking-wider">Tour-Scores</span>
          <span className={cn('text-xs font-black tabular-nums', scoreColor(avgScore))}>
            Ø {avgScore}
          </span>
        </div>
        {below65 > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/50 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
            <AlertTriangle className="h-3 w-3" />
            {below65} niedrig
          </span>
        )}
      </div>

      {/* Tour cards */}
      <div className="divide-y">
        {activeBatches.map(batch => {
          const score = tourScore(batch, now);
          const stops = batch.stops ?? [];
          const delivered = stops.filter(s => s.geliefert_am).length;
          const total = stops.length;
          const pct = total > 0 ? Math.round((delivered / total) * 100) : 0;

          return (
            <div key={batch.id} className="px-4 py-2.5 flex items-center gap-3">
              {/* Score badge */}
              <div className={cn('flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl border text-center', scoreBg(score))}>
                <span className={cn('text-[13px] font-black leading-none tabular-nums', scoreColor(score))}>
                  {score}
                </span>
                <span className="text-[8px] opacity-70 leading-none">Score</span>
              </div>

              {/* Tour info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Bike className="h-3 w-3 shrink-0 text-muted-foreground" />
                  <span className="text-xs font-semibold truncate">{driverName(batch)}</span>
                  {batch.zone && (
                    <span className="rounded bg-muted px-1 py-0.5 text-[9px] font-mono text-muted-foreground">
                      {batch.zone}
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div className="mt-1 flex items-center gap-2">
                  <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn('h-full rounded-full transition-all', score >= 85 ? 'bg-emerald-500' : score >= 65 ? 'bg-amber-500' : 'bg-red-500')}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono tabular-nums text-muted-foreground">
                    {delivered}/{total}
                  </span>
                </div>
              </div>

              {/* Right stats */}
              <div className="flex flex-col items-end gap-0.5 shrink-0">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span className="tabular-nums">{elapsedLabel(batch.startzeit, now)}</span>
                </div>
                {batch.total_distance_km != null && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    <span className="tabular-nums">{batch.total_distance_km.toFixed(1)} km</span>
                  </div>
                )}
                {delivered === total && total > 0 && (
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t px-4 py-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{activeBatches.length} aktive Tour{activeBatches.length !== 1 ? 'en' : ''}</span>
        <div className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-matcha-500" />
          <span>Live</span>
        </div>
      </div>
    </div>
  );
}
