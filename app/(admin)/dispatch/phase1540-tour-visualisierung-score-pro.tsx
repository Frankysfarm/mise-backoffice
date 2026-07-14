'use client';

import { useState, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import {
  Trophy,
  MapPin,
  ChevronDown,
  ChevronUp,
  Bike,
  Clock,
  CheckCircle2,
  Circle,
} from 'lucide-react';

interface Props {
  batches: Array<{
    id: string;
    driver_id?: string | null;
    status?: string | null;
    total_eta_min?: number | null;
    started_at?: string | null;
    stops?: Array<{
      id: string;
      reihenfolge?: number | null;
      angekommen_am?: string | null;
      geliefert_am?: string | null;
    }> | null;
  }>;
  drivers: Array<{
    id: string;
    vorname?: string | null;
    nachname?: string | null;
    status?: { ist_online?: boolean; score?: number | null } | null;
  }>;
  stops?: Array<{
    id: string;
    batch_id?: string | null;
    reihenfolge?: number | null;
    angekommen_am?: string | null;
    geliefert_am?: string | null;
  }>;
}

const ACTIVE_STATUSES = new Set([
  'aktiv',
  'active',
  'pickup',
  'unterwegs',
  'on_route',
  'assigned',
]);

function getScoreColor(score: number | null | undefined): string {
  if (score == null) return 'bg-stone-100 text-stone-400';
  if (score >= 80) return 'bg-matcha-100 text-matcha-700';
  if (score >= 60) return 'bg-yellow-100 text-yellow-700';
  if (score >= 40) return 'bg-orange-100 text-orange-700';
  return 'bg-red-100 text-red-700';
}

function formatElapsed(startedAt: string | null | undefined): string {
  if (!startedAt) return '—';
  const diffMs = Date.now() - new Date(startedAt).getTime();
  const totalMin = Math.max(0, Math.floor(diffMs / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getElapsedMin(startedAt: string | null | undefined): number {
  if (!startedAt) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
}

function formatEta(totalEtaMin: number | null | undefined, startedAt: string | null | undefined): string {
  if (totalEtaMin == null) return '—';
  const elapsed = getElapsedMin(startedAt);
  const remaining = totalEtaMin - elapsed;
  if (remaining <= 0) return 'überfällig';
  const h = Math.floor(remaining / 60);
  const m = remaining % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

interface StopDot {
  id: string;
  reihenfolge: number;
  done: boolean;
  arrived: boolean;
}

function StopTimeline({ dots }: { dots: StopDot[] }) {
  const sorted = [...dots].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const firstPendingIdx = sorted.findIndex((d) => !d.done);

  return (
    <div className="flex items-center gap-0 mt-1.5 flex-wrap">
      {sorted.map((dot, idx) => {
        const isCurrent = idx === firstPendingIdx;
        const isDone = dot.done;

        return (
          <div key={dot.id} className="flex items-center">
            {/* connector line */}
            {idx > 0 && (
              <div
                className={cn(
                  'h-px w-4 shrink-0',
                  sorted[idx - 1].done ? 'bg-matcha-400' : 'bg-stone-200',
                )}
              />
            )}
            {/* dot */}
            {isDone ? (
              <CheckCircle2 className="h-4 w-4 text-matcha-500 shrink-0" />
            ) : isCurrent ? (
              <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-60" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-yellow-400" />
              </span>
            ) : (
              <Circle className="h-4 w-4 text-stone-300 shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );
}

interface BatchRow {
  batch: Props['batches'][number];
  driver: Props['drivers'][number] | null;
  dots: StopDot[];
  score: number | null;
  completedCount: number;
  totalCount: number;
}

export function DispatchPhase1540TourVisualisierungScorePro({ batches, drivers, stops }: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  // Re-render every 30s to update elapsed/ETA display
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const driverMap = useMemo(() => {
    const m = new Map<string, Props['drivers'][number]>();
    for (const d of drivers) m.set(d.id, d);
    return m;
  }, [drivers]);

  // Build a stops lookup by batch_id from the top-level stops prop
  const stopsByBatch = useMemo(() => {
    const m = new Map<string, Props['stops']>();
    if (stops) {
      for (const s of stops) {
        if (!s.batch_id) continue;
        if (!m.has(s.batch_id)) m.set(s.batch_id, []);
        m.get(s.batch_id)!.push(s);
      }
    }
    return m;
  }, [stops]);

  const activeRows = useMemo<BatchRow[]>(() => {
    return batches
      .filter((b) => b.status && ACTIVE_STATUSES.has(b.status))
      .map((b) => {
        const driver = b.driver_id ? (driverMap.get(b.driver_id) ?? null) : null;
        const score = driver?.status?.score ?? null;

        // Prefer top-level stops prop, fall back to batch.stops
        const rawStops: Array<{
          id: string;
          reihenfolge?: number | null;
          angekommen_am?: string | null;
          geliefert_am?: string | null;
        }> = stopsByBatch.get(b.id) ?? b.stops ?? [];

        const dots: StopDot[] = rawStops.map((s) => ({
          id: s.id,
          reihenfolge: s.reihenfolge ?? 0,
          done: Boolean(s.geliefert_am),
          arrived: Boolean(s.angekommen_am),
        }));

        const completedCount = dots.filter((d) => d.done).length;

        return { batch: b, driver, dots, score, completedCount, totalCount: dots.length };
      });
  }, [batches, driverMap, stopsByBatch, tick]); // tick keeps elapsed fresh

  return (
    <div className="rounded-xl border border-matcha-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-matcha-600 text-white hover:bg-matcha-700 transition-colors"
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0" />
          <span className="text-sm font-bold tracking-wide">Tour-Visualisierung & Score</span>
          <span className="ml-1 rounded-full bg-matcha-500 px-2 py-0.5 text-[10px] font-black">
            {activeRows.length} aktiv
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0" />
        )}
      </button>

      {/* Body */}
      {open && (
        <div className="divide-y divide-stone-100">
          {activeRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-stone-400">
              <Bike className="h-8 w-8 opacity-30" />
              <span className="text-sm">Keine aktiven Touren</span>
            </div>
          ) : (
            activeRows.map(({ batch, driver, dots, score, completedCount, totalCount }) => {
              const driverName = driver
                ? `${driver.vorname ?? ''} ${driver.nachname ?? ''}`.trim() || 'Fahrer'
                : 'Unbekannt';

              return (
                <div key={batch.id} className="px-4 py-3 hover:bg-stone-50 transition-colors">
                  {/* Row top: driver + badges */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Bike className="h-4 w-4 text-matcha-500 shrink-0" />
                      <span className="text-sm font-bold text-stone-800 truncate">{driverName}</span>
                      {/* Score badge */}
                      <span
                        className={cn(
                          'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-black',
                          getScoreColor(score),
                        )}
                      >
                        <Trophy className="h-3 w-3 shrink-0" />
                        {score != null ? score : '—'}
                      </span>
                    </div>

                    {/* Stop progress text */}
                    <div className="flex items-center gap-1 text-xs text-stone-500 shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-matcha-500" />
                      <span className="tabular-nums font-semibold">
                        {completedCount}/{totalCount}
                      </span>
                    </div>
                  </div>

                  {/* Stop timeline */}
                  {dots.length > 0 ? (
                    <StopTimeline dots={dots} />
                  ) : (
                    <p className="text-[11px] text-stone-300 mt-1">Keine Stops verfügbar</p>
                  )}

                  {/* Time row */}
                  <div className="mt-1.5 flex items-center gap-3 text-[11px] text-stone-500">
                    <span className="flex items-center gap-0.5">
                      <Clock className="h-3 w-3" />
                      <span>Gestartet vor {formatElapsed(batch.started_at)}</span>
                    </span>
                    <span className="flex items-center gap-0.5 font-medium text-stone-600">
                      <Clock className="h-3 w-3 text-matcha-500" />
                      <span>ETA: {formatEta(batch.total_eta_min, batch.started_at)}</span>
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
