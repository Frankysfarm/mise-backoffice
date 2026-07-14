'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Route, Star, Clock, CheckCircle2, AlertTriangle, TrendingUp, Bike, MapPin, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Batch {
  id: string;
  driver_id: string | null;
  status: string;
  started_at: string | null;
  total_eta_min: number | null;
  zone?: string | null;
}

interface Stop {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
}

interface Driver {
  id: string;
  vorname: string;
  nachname: string;
  status?: { ist_online: boolean } | null;
}

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  typ?: string;
}

interface Props {
  batches: Batch[];
  stops: Stop[];
  drivers: Driver[];
  orders: Order[];
}

type TourHealth = 'pünktlich' | 'knapp' | 'verspätet' | 'unbekannt';

interface TourScore {
  batch: Batch;
  driverName: string;
  score: number;
  health: TourHealth;
  completedStops: number;
  totalStops: number;
  progressPct: number;
  elapsedMin: number;
  remainMin: number | null;
  eta: string | null;
  zone: string | null;
}

const HEALTH_CONFIG: Record<TourHealth, { bg: string; border: string; badge: string; bar: string; label: string; scoreColor: string }> = {
  pünktlich:  { bg: 'bg-matcha-50',  border: 'border-matcha-200',  badge: 'bg-matcha-500 text-white',   bar: 'bg-matcha-500',  label: 'Pünktlich',  scoreColor: 'text-matcha-700' },
  knapp:      { bg: 'bg-amber-50',   border: 'border-amber-200',   badge: 'bg-amber-400 text-black',    bar: 'bg-amber-400',   label: 'Knapp',      scoreColor: 'text-amber-700'  },
  verspätet:  { bg: 'bg-red-50',     border: 'border-red-200',     badge: 'bg-red-500 text-white',      bar: 'bg-red-500',     label: 'Verspätet',  scoreColor: 'text-red-700'    },
  unbekannt:  { bg: 'bg-muted/30',   border: 'border-border',      badge: 'bg-muted text-muted-foreground', bar: 'bg-muted-foreground', label: 'Unbekannt', scoreColor: 'text-muted-foreground' },
};

function computeTourScore(batch: Batch, stops: Stop[], now: number): { score: number; health: TourHealth } {
  if (!batch.started_at) return { score: 50, health: 'unbekannt' };
  const elapsedMin = (now - new Date(batch.started_at).getTime()) / 60_000;
  const totalStops = stops.filter(s => s.batch_id === batch.id).length;
  const doneStops = stops.filter(s => s.batch_id === batch.id && s.geliefert_am).length;
  const progressRatio = totalStops > 0 ? doneStops / totalStops : 0;

  if (batch.total_eta_min == null) {
    return { score: Math.min(100, Math.round(progressRatio * 80 + 20)), health: 'unbekannt' };
  }

  const timeRatio = elapsedMin / batch.total_eta_min;
  const delta = progressRatio - timeRatio;

  let score = 70;
  if (delta > 0.2) score = 95;
  else if (delta > 0) score = 85;
  else if (delta > -0.15) score = 72;
  else if (delta > -0.3) score = 55;
  else score = 35;

  // Bonus for completed stops
  score += doneStops * 2;
  score = Math.min(100, Math.max(10, score));

  const health: TourHealth = score >= 75 ? 'pünktlich' : score >= 55 ? 'knapp' : 'verspätet';
  return { score, health };
}

function ScoreGauge({ score, color }: { score: number; color: string }) {
  const r = 20;
  const circ = Math.PI * r; // half circle
  const dash = circ * (1 - score / 100);
  return (
    <div className="relative flex items-center justify-center w-14 h-8 overflow-visible shrink-0">
      <svg viewBox="0 0 56 32" fill="none" className="w-14 h-8">
        <path
          d="M 8 28 A 20 20 0 0 1 48 28"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          className="text-black/10"
          fill="none"
        />
        <path
          d="M 8 28 A 20 20 0 0 1 48 28"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={dash}
          className={color}
          fill="none"
        />
      </svg>
      <span className={cn('absolute bottom-0 text-[10px] font-black tabular-nums', color.replace('stroke-', 'text-'))}>
        {score}
      </span>
    </div>
  );
}

export function DispatchPhase1445TourScoreVisualisierungHub({ batches, stops, drivers, orders }: Props) {
  const [now, setNow] = useState(Date.now());
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(iv);
  }, []);

  const activeBatches = batches.filter(b =>
    ['aktiv', 'unterwegs', 'on_route', 'assigned', 'pickup'].includes(b.status)
  );

  if (activeBatches.length === 0) return null;

  const tours: TourScore[] = activeBatches.map(b => {
    const driver = drivers.find(d => d.id === b.driver_id);
    const driverName = driver ? `${driver.vorname} ${driver.nachname[0]}.` : 'Fahrer?';
    const batchStops = stops.filter(s => s.batch_id === b.id);
    const completedStops = batchStops.filter(s => s.geliefert_am).length;
    const totalStops = batchStops.length;
    const { score, health } = computeTourScore(b, stops, now);
    const elapsedMin = b.started_at ? Math.round((now - new Date(b.started_at).getTime()) / 60_000) : 0;
    const etaMs = b.started_at && b.total_eta_min
      ? new Date(b.started_at).getTime() + b.total_eta_min * 60_000
      : null;
    const remainMin = etaMs ? Math.round((etaMs - now) / 60_000) : null;
    const eta = etaMs ? new Date(etaMs).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : null;
    return {
      batch: b, driverName, score, health,
      completedStops, totalStops,
      progressPct: totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0,
      elapsedMin, remainMin, eta,
      zone: b.zone ?? null,
    };
  }).sort((a, b) => {
    const order: TourHealth[] = ['verspätet', 'knapp', 'pünktlich', 'unbekannt'];
    return order.indexOf(a.health) - order.indexOf(b.health);
  });

  const avgScore = Math.round(tours.reduce((s, t) => s + t.score, 0) / tours.length);
  const lateCount = tours.filter(t => t.health === 'verspätet').length;

  return (
    <Card className={cn('overflow-hidden', lateCount > 0 ? 'border-red-200' : 'border-matcha-200')}>
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/30 transition"
        onClick={() => setOpen(v => !v)}
      >
        <Route className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="font-display text-sm font-black uppercase tracking-wider flex-1 text-left">
          Tour-Score · Visualisierung v1445
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-matcha-600">Ø {avgScore}</span>
          {lateCount > 0 && (
            <span className="rounded-full bg-red-500 text-white px-2 py-0.5 text-[9px] font-black animate-pulse">
              {lateCount} verspätet
            </span>
          )}
          <Badge variant="secondary">{tours.length} Touren</Badge>
          <span className="text-muted-foreground text-xs">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="divide-y border-t">
          {tours.map(tour => {
            const cfg = HEALTH_CONFIG[tour.health];
            const scoreColor = tour.score >= 75 ? 'stroke-matcha-500' : tour.score >= 55 ? 'stroke-amber-400' : 'stroke-red-500';
            return (
              <div key={tour.batch.id} className={cn('p-4', cfg.bg)}>
                <div className="flex items-start gap-3">
                  {/* Score Gauge */}
                  <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
                    <ScoreGauge score={tour.score} color={scoreColor} />
                    <span className="text-[9px] font-black text-muted-foreground">SCORE</span>
                  </div>

                  <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <Bike className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="font-bold text-sm">{tour.driverName}</span>
                      <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-black', cfg.badge)}>
                        {cfg.label}
                      </span>
                      {tour.zone && (
                        <span className="text-[9px] rounded-full bg-white/60 border px-1.5 py-0.5 font-bold">
                          Zone {tour.zone}
                        </span>
                      )}
                    </div>

                    {/* Progress bar with stops */}
                    <div className="mb-2">
                      <div className="flex justify-between text-[10px] mb-0.5">
                        <span className="text-muted-foreground font-medium">
                          {tour.completedStops}/{tour.totalStops} Stopps
                        </span>
                        <span className={cn('font-bold tabular-nums', tour.health === 'verspätet' ? 'text-red-600' : tour.health === 'knapp' ? 'text-amber-600' : 'text-matcha-600')}>
                          {tour.remainMin !== null
                            ? tour.remainMin < 0 ? `+${Math.abs(tour.remainMin)}m verspätet` : `~${tour.remainMin}m verbleibend`
                            : `${tour.elapsedMin}m vergangen`
                          }
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-black/10 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-700', cfg.bar)}
                          style={{ width: `${tour.progressPct}%` }}
                        />
                      </div>
                    </div>

                    {/* Stop timeline dots */}
                    {tour.totalStops > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        {stops.filter(s => s.batch_id === tour.batch.id)
                          .sort((a, b) => a.reihenfolge - b.reihenfolge)
                          .map((s, i) => (
                          <div key={s.id} className={cn(
                            'flex-1 h-2 rounded-full',
                            s.geliefert_am ? cfg.bar : s.angekommen_am ? 'bg-blue-400' : 'bg-black/10',
                          )} />
                        ))}
                      </div>
                    )}

                    {/* ETA */}
                    {tour.eta && (
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        <Clock className="inline h-3 w-3 mr-0.5" />
                        ETA {tour.eta}
                      </div>
                    )}
                  </div>

                  {/* Elapsed time */}
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-base font-black tabular-nums">{tour.elapsedMin}m</div>
                    <div className="text-[8px] text-muted-foreground">vergangen</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="border-t px-4 py-2 bg-muted/20 flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Ø Score: <strong className="text-foreground">{avgScore}/100</strong></span>
        <span>{tours.filter(t => t.health === 'pünktlich').length} pünktlich</span>
        <span>{tours.filter(t => t.health === 'knapp').length} knapp</span>
        {lateCount > 0 && <span className="text-red-600 font-bold">{lateCount} verspätet</span>}
      </div>
    </Card>
  );
}
