'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, ChevronDown, ChevronUp, Clock, MapPin, Route, Star, TrendingUp, Truck } from 'lucide-react';

interface Batch {
  id: string;
  driver_id: string;
  status: string;
  started_at?: string | null;
  total_eta_min?: number | null;
  zone?: string | null;
}

interface Driver {
  id: string;
  vorname: string;
  nachname: string;
  status?: {
    ist_online: boolean;
    aktueller_batch_id?: string | null;
    last_lat?: number | null;
    last_lng?: number | null;
  } | null;
}

interface Stop {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am?: string | null;
  geliefert_am?: string | null;
}

interface Props {
  batches: Batch[];
  drivers: Driver[];
  stops: Stop[];
}

function computeScore(
  batch: Batch,
  stops: Stop[],
  startedAt: Date | null,
): { score: number; label: string; level: 'excellent' | 'good' | 'fair' | 'poor' } {
  const batchStops = stops.filter(s => s.batch_id === batch.id);
  const total = batchStops.length;
  if (total === 0) return { score: 0, label: 'Keine Stopps', level: 'poor' };

  const delivered = batchStops.filter(s => s.geliefert_am).length;
  const completionRate = total > 0 ? delivered / total : 0;

  let elapsedMin = 0;
  if (startedAt) elapsedMin = (Date.now() - startedAt.getTime()) / 60000;

  const expectedMin = (batch.total_eta_min ?? 45);
  const timeScore = elapsedMin > 0 ? Math.max(0, 1 - (elapsedMin / expectedMin - 0.5)) : 1;

  const raw = Math.round((completionRate * 70 + timeScore * 30) * 100) / 100;
  const score = Math.min(100, Math.max(0, Math.round(raw * 100)));

  const level: 'excellent' | 'good' | 'fair' | 'poor' =
    score >= 85 ? 'excellent' : score >= 65 ? 'good' : score >= 40 ? 'fair' : 'poor';
  const label = level === 'excellent' ? 'Sehr gut' : level === 'good' ? 'Gut' : level === 'fair' ? 'Mittel' : 'Schwach';
  return { score, label, level };
}

const LEVEL_STYLE = {
  excellent: { bg: 'bg-matcha-50',  border: 'border-matcha-200',  bar: 'bg-matcha-500',  badge: 'bg-matcha-500 text-white',  text: 'text-matcha-700'  },
  good:      { bg: 'bg-blue-50',    border: 'border-blue-200',    bar: 'bg-blue-500',    badge: 'bg-blue-500 text-white',    text: 'text-blue-700'    },
  fair:      { bg: 'bg-amber-50',   border: 'border-amber-200',   bar: 'bg-amber-400',   badge: 'bg-amber-500 text-white',   text: 'text-amber-700'   },
  poor:      { bg: 'bg-red-50',     border: 'border-red-200',     bar: 'bg-red-500',     badge: 'bg-red-500 text-white',     text: 'text-red-700'     },
};

export function DispatchPhase2075TourScoreRouteVisualisierung({ batches, drivers, stops }: Props) {
  const [open, setOpen] = useState(true);

  const rows = useMemo(() => {
    const driverMap = new Map(drivers.map(d => [d.id, d]));
    const activeBatches = batches.filter(b => b.status === 'active' || b.status === 'started' || b.status === 'unterwegs');

    return activeBatches
      .map(batch => {
        const driver = driverMap.get(batch.driver_id);
        const batchStops = stops
          .filter(s => s.batch_id === batch.id)
          .sort((a, b) => a.reihenfolge - b.reihenfolge);
        const startedAt = batch.started_at ? new Date(batch.started_at) : null;
        const elapsedMin = startedAt ? Math.round((Date.now() - startedAt.getTime()) / 60000) : null;
        const { score, label, level } = computeScore(batch, stops, startedAt);
        const deliveredCount = batchStops.filter(s => s.geliefert_am).length;
        const totalCount = batchStops.length;
        const progressPct = totalCount > 0 ? (deliveredCount / totalCount) * 100 : 0;
        return { batch, driver, batchStops, elapsedMin, score, label, level, deliveredCount, totalCount, progressPct };
      })
      .sort((a, b) => b.score - a.score);
  }, [batches, drivers, stops]);

  if (rows.length === 0) return null;

  const avgScore = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider">
          <Route className="h-4 w-4 text-matcha-600 shrink-0" />
          Tour-Score &amp; Route-Visualisierung
          <span className="text-muted-foreground font-normal normal-case tracking-normal">
            {rows.length} Tour{rows.length !== 1 ? 'en' : ''}
          </span>
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-matcha-100 text-matcha-700 border border-matcha-200 text-[10px] font-bold">
            <TrendingUp className="w-3 h-3" />
            Ø {avgScore}
          </span>
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="divide-y">
          {rows.map(({ batch, driver, batchStops, elapsedMin, score, label, level, deliveredCount, totalCount, progressPct }) => {
            const s = LEVEL_STYLE[level];
            const driverName = driver
              ? `${driver.vorname} ${driver.nachname}`
              : `Fahrer ${batch.driver_id.slice(0, 4)}`;

            return (
              <div key={batch.id} className={cn('px-4 py-3 space-y-2', s.bg)}>
                {/* Header row */}
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', s.badge)}>
                    <Bike className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black truncate">{driverName}</span>
                      {batch.zone && (
                        <span className="text-[10px] rounded-full bg-white/70 border px-1.5 py-0.5 font-bold">
                          Zone {batch.zone}
                        </span>
                      )}
                      {elapsedMin !== null && (
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="w-3 h-3" />{elapsedMin} Min vergangen
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Score circle */}
                  <div className="shrink-0 text-right">
                    <div className={cn('text-2xl font-black tabular-nums', s.text)}>{score}</div>
                    <div className={cn('text-[9px] font-bold', s.text)}>{label}</div>
                  </div>
                </div>

                {/* Score bar */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>Tour-Score</span>
                    <span>{deliveredCount}/{totalCount} Stopps</span>
                  </div>
                  <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', s.bar)}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>

                {/* Route Stop Dots */}
                {batchStops.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {batchStops.map((stop, idx) => {
                      const isDone = !!stop.geliefert_am;
                      const isArrived = !!stop.angekommen_am && !isDone;
                      const isNext = !isDone && !isArrived && batchStops.slice(0, idx).every(s => !!s.geliefert_am);
                      return (
                        <div key={stop.id} className="flex items-center gap-1">
                          {idx > 0 && (
                            <div className={cn('h-0.5 w-3', isDone ? s.bar : 'bg-muted')} />
                          )}
                          <div className={cn(
                            'flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black border transition-all',
                            isDone   ? cn(s.badge, 'border-transparent shadow-sm')
                            : isArrived ? 'bg-blue-100 border-blue-300 text-blue-700'
                            : isNext    ? 'bg-white border-2 border-current shadow-md ring-2 ring-offset-1 ' + s.text
                            :             'bg-white border-border text-muted-foreground',
                          )}>
                            {isDone ? <CheckCircle2 className="h-3 w-3" /> : stop.reihenfolge}
                          </div>
                        </div>
                      );
                    })}
                    {totalCount > 0 && (
                      <span className="text-[9px] text-muted-foreground ml-1">
                        {Math.round(progressPct)}% ✓
                      </span>
                    )}
                  </div>
                )}

                {/* Stars */}
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star
                      key={i}
                      className={cn(
                        'h-3 w-3',
                        i <= Math.round(score / 20) ? cn(s.text, 'fill-current') : 'text-muted',
                      )}
                    />
                  ))}
                  <span className="ml-2 text-[10px] text-muted-foreground">{score}/100 Punkte</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
