'use client';

// Phase 1311 — Tour-Score-Visualisierung-Hub (Dispatch)
// Visuelles Score-Board aller aktiven Touren mit Gesundheits-Score + Farbkodierung
// 30-Sek-Polling · batches/drivers/stops Props · nach Phase1310

import { useEffect, useState, useCallback } from 'react';
import { Route, TrendingUp, Clock, CheckCircle2, AlertTriangle, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

type ScoreLevel = 'green' | 'amber' | 'red';

interface TourCard {
  tourId: string;
  driverName: string;
  stopsCompleted: number;
  stopsTotal: number;
  elapsedMin: number;
  etaMin: number;
  healthScore: number;
  scoreLevel: ScoreLevel;
}

interface HubData {
  tours: TourCard[];
  avgScore: number;
  bestTourId: string | null;
  worstTourId: string | null;
  generiert_am: string;
}

const MOCK_TOURS: TourCard[] = [
  { tourId: 'T-001', driverName: 'Max Müller',    stopsCompleted: 7,  stopsTotal: 10, elapsedMin: 45, etaMin: 20, healthScore: 87, scoreLevel: 'green' },
  { tourId: 'T-002', driverName: 'Anna Schmidt',  stopsCompleted: 4,  stopsTotal: 12, elapsedMin: 55, etaMin: 75, healthScore: 62, scoreLevel: 'amber' },
  { tourId: 'T-003', driverName: 'Tom Weber',     stopsCompleted: 2,  stopsTotal: 8,  elapsedMin: 40, etaMin: 90, healthScore: 38, scoreLevel: 'red'   },
  { tourId: 'T-004', driverName: 'Lisa Fischer',  stopsCompleted: 9,  stopsTotal: 11, elapsedMin: 60, etaMin: 15, healthScore: 91, scoreLevel: 'green' },
  { tourId: 'T-005', driverName: 'Klaus Braun',   stopsCompleted: 5,  stopsTotal: 9,  elapsedMin: 50, etaMin: 40, healthScore: 72, scoreLevel: 'amber' },
  { tourId: 'T-006', driverName: 'Sara Klein',    stopsCompleted: 1,  stopsTotal: 14, elapsedMin: 30, etaMin: 110, healthScore: 41, scoreLevel: 'red'  },
];

function buildMock(): HubData {
  const tours = MOCK_TOURS;
  const avgScore = Math.round(tours.reduce((s, t) => s + t.healthScore, 0) / tours.length);
  const sorted = [...tours].sort((a, b) => b.healthScore - a.healthScore);
  return {
    tours,
    avgScore,
    bestTourId: sorted[0]?.tourId ?? null,
    worstTourId: sorted[sorted.length - 1]?.tourId ?? null,
    generiert_am: new Date().toISOString(),
  };
}

function scoreLevel(score: number): ScoreLevel {
  if (score > 80) return 'green';
  if (score >= 50) return 'amber';
  return 'red';
}

function computeHealthScore(stopsCompleted: number, stopsTotal: number, elapsedMin: number, etaMin: number): number {
  const progress = stopsTotal > 0 ? stopsCompleted / stopsTotal : 0;
  const progressScore = Math.round(progress * 50); // 0–50

  // time efficiency: if ETA <= elapsed/progress remainder → good
  const expectedRemainingMin = stopsTotal > 0 && progress > 0 ? (elapsedMin / progress) * (1 - progress) : etaMin;
  const timeEfficiency = expectedRemainingMin > 0 ? Math.min(1, expectedRemainingMin / Math.max(etaMin, 1)) : 1;
  const timeScore = Math.round(timeEfficiency * 30); // 0–30

  // punctuality: bonus if ETA < 30 min
  const punctualityScore = etaMin < 30 ? 20 : etaMin < 60 ? 10 : 0; // 0–20

  return Math.min(100, progressScore + timeScore + punctualityScore);
}

function computeFromProps(batches: any[], drivers: any[], stops: any[]): HubData | null {
  if (!batches || batches.length === 0) return null;

  const driverMap: Record<string, string> = {};
  for (const d of drivers ?? []) {
    const name = [d.first_name, d.last_name].filter(Boolean).join(' ') || d.name || d.employee_id || 'Fahrer';
    driverMap[d.employee_id ?? d.id] = name;
  }

  const stopsByBatch: Record<string, any[]> = {};
  for (const s of stops ?? []) {
    const bid = s.batch_id ?? s.batchId;
    if (!bid) continue;
    if (!stopsByBatch[bid]) stopsByBatch[bid] = [];
    stopsByBatch[bid].push(s);
  }

  const tours: TourCard[] = batches
    .filter((b) => b.status === 'active' || b.status === 'in_progress' || b.status === 'started')
    .map((b) => {
      const bid = b.id ?? b.batch_id;
      const batchStops = stopsByBatch[bid] ?? [];
      const stopsTotal = batchStops.length || (b.stop_count ?? b.stops_count ?? 0);
      const stopsCompleted = batchStops.filter((s: any) => s.status === 'delivered' || s.status === 'completed').length;
      const elapsedMin = b.started_at
        ? Math.round((Date.now() - new Date(b.started_at).getTime()) / 60000)
        : 0;
      const etaMin = b.eta_min ?? b.eta_minutes ?? Math.max(10, (stopsTotal - stopsCompleted) * 8);
      const driverId = b.driver_id ?? b.employee_id;
      const driverName = driverMap[driverId] ?? 'Unbekannt';
      const score = computeHealthScore(stopsCompleted, stopsTotal, elapsedMin, etaMin);
      return {
        tourId: bid ?? 'T-?',
        driverName,
        stopsCompleted,
        stopsTotal,
        elapsedMin,
        etaMin,
        healthScore: score,
        scoreLevel: scoreLevel(score),
      };
    });

  if (tours.length === 0) return null;

  const avgScore = Math.round(tours.reduce((s, t) => s + t.healthScore, 0) / tours.length);
  const sorted = [...tours].sort((a, b) => b.healthScore - a.healthScore);
  return {
    tours,
    avgScore,
    bestTourId: sorted[0]?.tourId ?? null,
    worstTourId: sorted[sorted.length - 1]?.tourId ?? null,
    generiert_am: new Date().toISOString(),
  };
}

const POLL_MS = 30_000;

const SCORE_CFG: Record<ScoreLevel, { bg: string; border: string; text: string; bar: string; badge: string; dot: string }> = {
  green: {
    bg:     'bg-emerald-50 dark:bg-emerald-950/20',
    border: 'border-emerald-200 dark:border-emerald-800',
    text:   'text-emerald-700 dark:text-emerald-300',
    bar:    'bg-emerald-500',
    badge:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
    dot:    'bg-emerald-500',
  },
  amber: {
    bg:     'bg-amber-50 dark:bg-amber-950/20',
    border: 'border-amber-200 dark:border-amber-800',
    text:   'text-amber-700 dark:text-amber-300',
    bar:    'bg-amber-400',
    badge:  'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
    dot:    'bg-amber-400',
  },
  red: {
    bg:     'bg-red-50 dark:bg-red-950/20',
    border: 'border-red-200 dark:border-red-800',
    text:   'text-red-700 dark:text-red-300',
    bar:    'bg-red-500',
    badge:  'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
    dot:    'bg-red-500',
  },
};

interface Props {
  batches: any[];
  drivers: any[];
  stops: any[];
  locationId: string | null;
}

export function DispatchPhase1311TourScoreVisualisierungHub({ batches, drivers, stops, locationId }: Props) {
  const [data, setData] = useState<HubData | null>(null);

  const refresh = useCallback(() => {
    const computed = computeFromProps(batches, drivers, stops);
    setData(computed ?? buildMock());
  }, [batches, drivers, stops]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  if (!locationId) return null;

  const avgLevel: ScoreLevel = data ? scoreLevel(data.avgScore) : 'green';
  const avgCfg = SCORE_CFG[avgLevel];

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-primary" />
          <span className="text-xs font-bold text-foreground">Tour-Score-Visualisierung-Hub</span>
          {data && (
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full', avgCfg.badge)}>
              Ø {data.avgScore}
            </span>
          )}
        </div>
        <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
      </div>

      {/* Summary bar */}
      {data && (
        <div className="flex items-center gap-3 mb-3 pb-2 border-b border-border">
          <div className="flex items-center gap-1">
            <Route className="h-3 w-3 text-muted-foreground" />
            <span className="text-[11px] text-muted-foreground">{data.tours.length} Touren</span>
          </div>
          {data.bestTourId && (
            <div className="flex items-center gap-1">
              <Star className="h-3 w-3 text-emerald-500" />
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                Best: {data.tours.find((t) => t.tourId === data.bestTourId)?.driverName ?? data.bestTourId}
              </span>
            </div>
          )}
          {data.worstTourId && data.worstTourId !== data.bestTourId && (
            <div className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-red-500" />
              <span className="text-[11px] text-red-600 dark:text-red-400 font-semibold">
                Kritisch: {data.tours.find((t) => t.tourId === data.worstTourId)?.driverName ?? data.worstTourId}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Tour cards grid */}
      {data && (
        <div className="grid grid-cols-2 gap-1.5">
          {data.tours.map((tour) => {
            const cfg = SCORE_CFG[tour.scoreLevel];
            const progressPct = tour.stopsTotal > 0 ? Math.round((tour.stopsCompleted / tour.stopsTotal) * 100) : 0;
            const isBest = tour.tourId === data.bestTourId;
            const isWorst = tour.tourId === data.worstTourId && data.tours.length > 1;
            return (
              <div key={tour.tourId} className={cn('rounded-lg border px-2.5 py-2', cfg.bg, cfg.border)}>
                {/* Tour header */}
                <div className="flex items-center justify-between mb-1">
                  <span className={cn('text-[10px] font-bold truncate max-w-[70%]', cfg.text)}>
                    {tour.driverName}
                  </span>
                  <div className="flex items-center gap-1">
                    {isBest && <Star className="h-2.5 w-2.5 text-emerald-500 shrink-0" />}
                    {isWorst && <AlertTriangle className="h-2.5 w-2.5 text-red-500 shrink-0" />}
                    <span className={cn('inline-flex h-1.5 w-1.5 rounded-full shrink-0', cfg.dot)} />
                  </div>
                </div>

                {/* Score */}
                <p className={cn('text-base font-black tabular-nums', cfg.text)}>
                  {tour.healthScore}
                  <span className="text-[10px] font-medium ml-0.5">/ 100</span>
                </p>

                {/* Progress bar */}
                <div className="mt-1 mb-1">
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1">
                      <CheckCircle2 className="h-2.5 w-2.5 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {tour.stopsCompleted}/{tour.stopsTotal}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{progressPct}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all', cfg.bar)}
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                </div>

                {/* Time row */}
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground tabular-nums">{tour.elapsedMin}′</span>
                  </div>
                  <div className="flex items-center gap-0.5">
                    <TrendingUp className="h-2.5 w-2.5 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground tabular-nums">ETA {tour.etaMin}′</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!data && (
        <div className="grid grid-cols-2 gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      )}

      {data && (
        <p className="text-[10px] text-muted-foreground mt-1.5 text-right">
          Stand: {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
        </p>
      )}
    </div>
  );
}
