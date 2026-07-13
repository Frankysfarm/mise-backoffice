'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronDown, ChevronUp, MapPin, Navigation, Package, Star,
  TrendingDown, TrendingUp, Minus, Clock, CheckCircle2, Circle,
} from 'lucide-react';

/**
 * Phase 1003 — Tour-Visualisierung-Pro (Dispatch)
 *
 * Zeigt aktive Touren als vertikale Stop-Sequenz mit:
 * - Farbkodiertem Effizienz-Score (0–100) je Fahrer
 * - Stop-Fortschrittsanzeige (erledigt / aktuell / ausstehend)
 * - ETA-Abweichung je Stop
 * - Gesamt-Tour-Effizienz-Balken
 *
 * Pollt /api/delivery/admin/active-tours alle 30s.
 * Fallback: Mock-Daten.
 */

interface TourStop {
  id: string;
  sequence: number;
  kunde_name?: string | null;
  kunde_adresse?: string | null;
  status: 'completed' | 'current' | 'pending';
  eta_min?: number | null;
  eta_deviation_min?: number | null;
  geliefert_am?: string | null;
}

interface ActiveTour {
  tour_id: string;
  fahrer_name: string;
  fahrer_id: string;
  score: number;
  score_trend: 'up' | 'down' | 'stable';
  status: 'pickup' | 'on_route' | 'returning';
  stops_total: number;
  stops_done: number;
  stops: TourStop[];
  started_at?: string | null;
  eta_zurueck_min?: number | null;
  effizienz_pct?: number | null;
}

interface Props {
  locationId?: string | null;
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_TOURS: ActiveTour[] = [
  {
    tour_id: 't1',
    fahrer_name: 'M. Bauer',
    fahrer_id: 'drv-01',
    score: 87,
    score_trend: 'up',
    status: 'on_route',
    stops_total: 3,
    stops_done: 1,
    effizienz_pct: 91,
    eta_zurueck_min: 22,
    started_at: new Date(Date.now() - 28 * 60_000).toISOString(),
    stops: [
      { id: 's1', sequence: 1, kunde_name: 'A. Müller', kunde_adresse: 'Hauptstr. 12', status: 'completed', eta_deviation_min: -2 },
      { id: 's2', sequence: 2, kunde_name: 'B. Weber', kunde_adresse: 'Parkweg 5', status: 'current', eta_min: 8, eta_deviation_min: 1 },
      { id: 's3', sequence: 3, kunde_name: 'C. Schmidt', kunde_adresse: 'Lindenstr. 33', status: 'pending', eta_min: 18, eta_deviation_min: null },
    ],
  },
  {
    tour_id: 't2',
    fahrer_name: 'L. Huber',
    fahrer_id: 'drv-02',
    score: 72,
    score_trend: 'stable',
    status: 'on_route',
    stops_total: 2,
    stops_done: 0,
    effizienz_pct: 78,
    eta_zurueck_min: 35,
    started_at: new Date(Date.now() - 5 * 60_000).toISOString(),
    stops: [
      { id: 's4', sequence: 1, kunde_name: 'D. Klein', kunde_adresse: 'Rosenweg 8', status: 'current', eta_min: 12, eta_deviation_min: 3 },
      { id: 's5', sequence: 2, kunde_name: 'E. Braun', kunde_adresse: 'Bergstr. 21', status: 'pending', eta_min: 25, eta_deviation_min: null },
    ],
  },
  {
    tour_id: 't3',
    fahrer_name: 'K. Stein',
    fahrer_id: 'drv-03',
    score: 55,
    score_trend: 'down',
    status: 'returning',
    stops_total: 2,
    stops_done: 2,
    effizienz_pct: 62,
    eta_zurueck_min: 8,
    started_at: new Date(Date.now() - 45 * 60_000).toISOString(),
    stops: [
      { id: 's6', sequence: 1, kunde_name: 'F. Weiß', kunde_adresse: 'Dorfstr. 3', status: 'completed', eta_deviation_min: 5 },
      { id: 's7', sequence: 2, kunde_name: 'G. Lang', kunde_adresse: 'Feldweg 17', status: 'completed', eta_deviation_min: 7 },
    ],
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 75) return { bar: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/25', border: 'border-emerald-200 dark:border-emerald-800' };
  if (score >= 50) return { bar: 'bg-amber-400', text: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/25', border: 'border-amber-200 dark:border-amber-800' };
  return { bar: 'bg-red-500', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-950/25', border: 'border-red-200 dark:border-red-800' };
}

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'stable' }) {
  if (trend === 'up') return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function StopIcon({ status }: { status: TourStop['status'] }) {
  if (status === 'completed') return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />;
  if (status === 'current') return <Navigation className="h-4 w-4 text-sky-500 shrink-0 animate-pulse" />;
  return <Circle className="h-4 w-4 text-muted-foreground/40 shrink-0" />;
}

function statusLabel(status: ActiveTour['status']) {
  if (status === 'pickup') return { label: 'Abholung', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' };
  if (status === 'on_route') return { label: 'Unterwegs', cls: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300' };
  return { label: 'Rückkehr', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' };
}

function deviationBadge(dev: number | null | undefined) {
  if (dev === null || dev === undefined) return null;
  if (dev <= 0) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold">{dev < 0 ? `${Math.abs(dev)} Min früher` : 'pünktlich'}</span>;
  if (dev <= 5) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 font-semibold">+{dev} Min</span>;
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 font-semibold">+{dev} Min verspätet</span>;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function DispatchPhase1003TourVisualisierungPro({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [tours, setTours] = useState<ActiveTour[]>([]);
  const [usingMock, setUsingMock] = useState(false);
  const [expandedTour, setExpandedTour] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!locationId) { setTours(MOCK_TOURS); setUsingMock(true); return; }
      try {
        const res = await fetch(`/api/delivery/admin/batch-monitor?action=details&location_id=${locationId}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('not ok');
        const d = await res.json();
        // batch-monitor?action=details returns ActiveBatchInfo[] — map to ActiveTour
        const rawList = Array.isArray(d) ? d : [];
        const list: ActiveTour[] = rawList.map((b: Record<string, unknown>, i: number) => {
          const stops = (b.stops as Record<string, unknown>[] | null) ?? [];
          return {
            tour_id: (b.batchId as string) ?? String(i),
            fahrer_name: (b.driverName as string | null) ?? 'Fahrer',
            fahrer_id: (b.driverId as string | null) ?? '',
            score: Math.round((b.completionPct as number | null) ?? 50),
            score_trend: 'stable' as const,
            status: 'on_route' as const,
            stops_total: (b.totalStops as number) ?? stops.length,
            stops_done: (b.completedStops as number) ?? 0,
            started_at: (b.startedAt as string | null) ?? null,
            effizienz_pct: Math.round((b.completionPct as number | null) ?? 50),
            eta_zurueck_min: null,
            stops: stops.map((s, j) => ({
              id: (s.stopId as string) ?? String(j),
              sequence: j + 1,
              status: s.completedAt ? 'completed' : j === (b.completedStops as number) ? 'current' : 'pending',
              eta_min: (s.etaMin as number | null) ?? null,
              eta_deviation_min: null,
              geliefert_am: (s.completedAt as string | null) ?? null,
            } as TourStop)),
          };
        });
        if (list.length > 0) { setTours(list); setUsingMock(false); }
        else { setTours(MOCK_TOURS); setUsingMock(true); }
      } catch {
        setTours(MOCK_TOURS);
        setUsingMock(true);
      }
    }
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const activeTours = tours.filter(t => t.status !== 'returning' || t.stops_done < t.stops_total);

  return (
    <div className="rounded-2xl border bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-sky-100 dark:bg-sky-950/40">
            <Navigation className="h-4 w-4 text-sky-600" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-foreground leading-tight">Tour-Visualisierung Pro</div>
            <div className="text-[11px] text-muted-foreground leading-tight">{tours.length} aktive Touren</div>
          </div>
          {usingMock && (
            <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">Demo</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-semibold text-foreground tabular-nums">
              {tours.reduce((s, t) => s + t.stops_done, 0)} / {tours.reduce((s, t) => s + t.stops_total, 0)}
            </div>
            <div className="text-[10px] text-muted-foreground">Stopps erledigt</div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {tours.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Keine aktiven Touren</div>
          ) : (
            tours.map(tour => {
              const sc = scoreColor(tour.score);
              const st = statusLabel(tour.status);
              const isExpanded = expandedTour === tour.tour_id;
              const progressPct = tour.stops_total > 0
                ? Math.round((tour.stops_done / tour.stops_total) * 100)
                : 0;

              return (
                <div key={tour.tour_id} className={cn('rounded-xl border overflow-hidden', sc.border)}>
                  {/* Tour header row */}
                  <button
                    className={cn('w-full flex items-center gap-3 px-3 py-2.5', sc.bg, 'hover:brightness-[0.98] transition-all')}
                    onClick={() => setExpandedTour(isExpanded ? null : tour.tour_id)}
                  >
                    {/* Driver + score */}
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm text-foreground">{tour.fahrer_name}</span>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded font-semibold', st.cls)}>{st.label}</span>
                        <TrendIcon trend={tour.score_trend} />
                      </div>
                      {/* Score bar */}
                      <div className="mt-1.5 flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                          <div className={cn('h-full rounded-full transition-all', sc.bar)} style={{ width: `${tour.score}%` }} />
                        </div>
                        <span className={cn('text-xs font-black tabular-nums', sc.text)}>{tour.score}</span>
                        <Star className="h-3 w-3 text-amber-400" />
                      </div>
                    </div>

                    {/* Stop counter + ETA */}
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-black text-foreground tabular-nums">
                        {tour.stops_done}/{tour.stops_total}
                      </div>
                      <div className="text-[10px] text-muted-foreground">Stopps</div>
                      {tour.eta_zurueck_min != null && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          <Clock className="inline h-2.5 w-2.5 mr-0.5" />
                          {tour.eta_zurueck_min} Min zurück
                        </div>
                      )}
                    </div>

                    {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
                  </button>

                  {/* Progress bar */}
                  <div className="h-1 bg-neutral-100 dark:bg-neutral-800">
                    <div className={cn('h-full transition-all', sc.bar)} style={{ width: `${progressPct}%` }} />
                  </div>

                  {/* Stop list (expanded) */}
                  {isExpanded && (
                    <div className="bg-white dark:bg-neutral-900 px-3 py-2 space-y-1.5">
                      {tour.stops.map((stop, idx) => (
                        <div key={stop.id} className="flex items-start gap-2.5">
                          {/* Connector line */}
                          <div className="flex flex-col items-center pt-0.5">
                            <StopIcon status={stop.status} />
                            {idx < tour.stops.length - 1 && (
                              <div className={cn('w-0.5 h-4 mt-0.5 rounded', stop.status === 'completed' ? 'bg-emerald-300 dark:bg-emerald-700' : 'bg-neutral-200 dark:bg-neutral-700')} />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 pb-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={cn('text-xs font-semibold', stop.status === 'completed' ? 'text-muted-foreground line-through' : stop.status === 'current' ? 'text-foreground font-black' : 'text-muted-foreground')}>
                                {stop.sequence}. {stop.kunde_name ?? '—'}
                              </span>
                              {stop.status === 'current' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 font-bold">JETZT</span>
                              )}
                              {deviationBadge(stop.eta_deviation_min)}
                              {stop.status === 'pending' && stop.eta_min != null && (
                                <span className="text-[10px] text-muted-foreground">
                                  <Clock className="inline h-2.5 w-2.5 mr-0.5" />ETA ~{stop.eta_min} Min
                                </span>
                              )}
                            </div>
                            {stop.kunde_adresse && (
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
                                <MapPin className="h-2.5 w-2.5" />
                                {stop.kunde_adresse}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      {/* Tour efficiency */}
                      {tour.effizienz_pct != null && (
                        <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">Tour-Effizienz:</span>
                          <div className="flex-1 h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
                            <div
                              className={cn('h-full rounded-full', tour.effizienz_pct >= 80 ? 'bg-emerald-500' : tour.effizienz_pct >= 60 ? 'bg-amber-400' : 'bg-red-500')}
                              style={{ width: `${tour.effizienz_pct}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-foreground tabular-nums">{tour.effizienz_pct}%</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
