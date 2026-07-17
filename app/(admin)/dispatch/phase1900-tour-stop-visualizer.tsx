'use client';

import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, CheckCircle2, Clock, Bike, Zap, ChevronRight, Route } from 'lucide-react';
import { Card } from '@/components/ui/card';

/**
 * Phase 1900 — Tour-Stop-Visualizer (Dispatch)
 *
 * Visualisiert aktive Touren als horizontale Stop-Timelines.
 * Zeigt pro Tour:
 *   - Tour-Score (0–100) mit Farbkodierung
 *   - Alle Stops in Reihenfolge mit Status-Icons
 *   - ETA zum nächsten Stop
 *   - Fortschrittsbalken
 */

interface Driver {
  id: string;
  vorname?: string | null;
  nachname?: string | null;
  score?: number | null;
}

interface Batch {
  id: string;
  driver_id?: string | null;
  status?: string | null;
  created_at?: string;
  zone?: string | null;
}

interface Stop {
  id: string;
  batch_id?: string | null;
  position?: number | null;
  status?: string | null;
  address?: string | null;
  eta?: string | null;
}

interface Props {
  drivers: Driver[];
  batches: Batch[];
  stops: Stop[];
}

type TourHealth = 'ontime' | 'tight' | 'late';

const HEALTH_CFG: Record<TourHealth, {
  bg: string; bar: string; badge: string; badgeBg: string; label: string;
}> = {
  ontime: { bg: 'bg-emerald-50/40 dark:bg-emerald-950/20', bar: 'bg-emerald-500', badge: 'text-emerald-700 dark:text-emerald-300', badgeBg: 'bg-emerald-100 dark:bg-emerald-900/30', label: 'Pünktlich' },
  tight:  { bg: 'bg-amber-50/40 dark:bg-amber-950/20',     bar: 'bg-amber-400',   badge: 'text-amber-700 dark:text-amber-300',     badgeBg: 'bg-amber-100 dark:bg-amber-900/30',     label: 'Knapp' },
  late:   { bg: 'bg-rose-50/40 dark:bg-rose-950/20',       bar: 'bg-rose-500',    badge: 'text-rose-700 dark:text-rose-300',       badgeBg: 'bg-rose-100 dark:bg-rose-900/30',       label: 'Verzögert' },
};

function scoreColor(score: number): string {
  if (score >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-rose-600 dark:text-rose-400';
}

function getTourHealth(stops: Stop[], createdAt: string | undefined): TourHealth {
  const lateStops = stops.filter(s => {
    if (s.status === 'completed') return false;
    if (!s.eta) return false;
    return new Date(s.eta).getTime() < Date.now();
  });
  if (lateStops.length > 0) return 'late';

  const tightStops = stops.filter(s => {
    if (s.status === 'completed') return false;
    if (!s.eta) return false;
    const remaining = (new Date(s.eta).getTime() - Date.now()) / 60_000;
    return remaining < 10;
  });
  if (tightStops.length > 0) return 'tight';

  return 'ontime';
}

function computeTourScore(driver: Driver, stops: Stop[], health: TourHealth): number {
  let score = driver.score ?? 70;
  if (health === 'late') score -= 20;
  else if (health === 'tight') score -= 5;
  const completedRatio = stops.length > 0 ? stops.filter(s => s.status === 'completed').length / stops.length : 0;
  score += completedRatio * 10;
  return Math.round(Math.max(0, Math.min(100, score)));
}

function StopDot({ stop, isNext }: { stop: Stop; isNext: boolean }) {
  const isCompleted = stop.status === 'completed';
  const isActive = stop.status === 'active' || isNext;

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={cn(
        'h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all',
        isCompleted
          ? 'bg-emerald-500 border-emerald-500'
          : isActive
            ? 'bg-white border-matcha-500 shadow-[0_0_0_2px_rgba(var(--matcha-500),0.2)]'
            : 'bg-muted border-border',
      )}>
        {isCompleted ? (
          <CheckCircle2 className="h-3 w-3 text-white" />
        ) : isActive ? (
          <div className="h-2 w-2 rounded-full bg-matcha-500 animate-pulse" />
        ) : (
          <MapPin className="h-2.5 w-2.5 text-muted-foreground" />
        )}
      </div>
      {stop.eta && !isCompleted && (
        <span className={cn(
          'text-[8px] font-bold tabular-nums',
          new Date(stop.eta).getTime() < Date.now() ? 'text-rose-500' : 'text-muted-foreground',
        )}>
          {new Date(stop.eta).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  );
}

export function DispatchPhase1900TourStopVisualizer({ drivers, batches, stops }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const tours = useMemo(() => {
    const activeBatches = batches.filter(b => ['aktiv', 'active', 'unterwegs', 'in_delivery'].includes(b.status ?? ''));
    return activeBatches
      .map(batch => {
        const driver = drivers.find(d => d.id === batch.driver_id) ?? null;
        const batchStops = stops
          .filter(s => s.batch_id === batch.id)
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        const health = getTourHealth(batchStops, batch.created_at);
        const score = driver ? computeTourScore(driver, batchStops, health) : 0;
        const completedCount = batchStops.filter(s => s.status === 'completed').length;
        const pct = batchStops.length > 0 ? Math.round((completedCount / batchStops.length) * 100) : 0;
        const nextStop = batchStops.find(s => s.status !== 'completed') ?? null;

        return { batch, driver, stops: batchStops, health, score, completedCount, pct, nextStop };
      })
      .filter(t => t.stops.length > 0)
      .sort((a, b) => {
        const order: Record<TourHealth, number> = { late: 0, tight: 1, ontime: 2 };
        return order[a.health] - order[b.health];
      });
  }, [batches, drivers, stops]);

  if (tours.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <Route className="h-4 w-4 text-matcha-600" />
        <span className="text-[11px] font-black uppercase tracking-widest text-matcha-700 dark:text-matcha-300">
          Tour-Visualisierung · {tours.length} aktiv
        </span>
        {tours.filter(t => t.health === 'late').length > 0 && (
          <span className="ml-auto rounded-full bg-rose-600 px-2 py-0.5 text-[9px] font-black text-white animate-pulse">
            {tours.filter(t => t.health === 'late').length} verzögert
          </span>
        )}
      </div>

      <div className="divide-y">
        {tours.map(({ batch, driver, stops: tourStops, health, score, completedCount, pct, nextStop }) => {
          const cfg = HEALTH_CFG[health];
          const driverName = driver
            ? `${driver.vorname ?? ''} ${driver.nachname ?? ''}`.trim()
            : 'Kein Fahrer';

          return (
            <div key={batch.id} className={cn('px-4 py-3', cfg.bg)}>
              {/* Top row: driver + score + health */}
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center gap-1.5">
                  <Bike className="h-3.5 w-3.5 text-matcha-600" />
                  <span className="text-xs font-bold truncate max-w-[100px]">{driverName}</span>
                  {batch.zone && (
                    <span className="text-[9px] rounded-full bg-white/60 border px-1.5 py-0.5 font-bold">
                      Zone {batch.zone}
                    </span>
                  )}
                </div>

                <div className="ml-auto flex items-center gap-2">
                  {/* Score */}
                  <div className={cn('font-mono text-lg font-black tabular-nums', scoreColor(score))}>
                    {score}
                  </div>
                  <div className="text-[8px] text-muted-foreground">Score</div>

                  {/* Health badge */}
                  <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-black', cfg.badge, cfg.badgeBg)}>
                    {cfg.label}
                  </span>
                </div>
              </div>

              {/* Stop timeline */}
              <div className="flex items-start gap-1 overflow-x-auto pb-1 scrollbar-none">
                {tourStops.map((stop, i) => (
                  <div key={stop.id} className="flex items-center gap-1 shrink-0">
                    <StopDot stop={stop} isNext={i === completedCount} />
                    {i < tourStops.length - 1 && (
                      <ChevronRight className="h-3 w-3 text-muted-foreground/50 shrink-0 mt-[-8px]" />
                    )}
                  </div>
                ))}
              </div>

              {/* Progress bar + next stop */}
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', cfg.bar)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[9px] font-bold text-muted-foreground tabular-nums shrink-0">
                  {completedCount}/{tourStops.length}
                </span>
                {nextStop?.address && (
                  <span className="flex items-center gap-1 text-[9px] text-muted-foreground truncate max-w-[120px]">
                    <Zap className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                    {nextStop.address}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
