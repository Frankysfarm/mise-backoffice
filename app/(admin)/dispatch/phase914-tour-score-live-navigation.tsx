'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Navigation2, Star, MapPin, Clock, TrendingUp, AlertTriangle, Loader2 } from 'lucide-react';

/**
 * Phase 914 — Tour Score Live Navigation (Dispatch)
 *
 * Kombiniertes Score- und Navigations-Panel für alle aktiven Touren:
 * - Dispatch-Score je Tour (0–100)
 * - Nächste Stops mit ETA
 * - Farbkodierung nach Performance
 * Polling alle 30 Sekunden.
 */

interface Props {
  locationId: string | null;
}

interface TourStop {
  address: string;
  eta_min: number;
  status: 'pending' | 'completed' | 'current';
}

interface TourEntry {
  tour_id: string;
  driver_name: string;
  dispatch_score: number;
  stops_total: number;
  stops_done: number;
  current_stop?: TourStop;
  next_stop?: TourStop;
  elapsed_min: number;
  zone?: string;
  sla_ok: boolean;
}

interface ApiResponse {
  tours: TourEntry[];
}

function scoreColor(score: number) {
  if (score >= 80) return { bg: 'bg-matcha-100 dark:bg-matcha-950/40', text: 'text-matcha-700 dark:text-matcha-300', ring: 'bg-matcha-500' };
  if (score >= 60) return { bg: 'bg-amber-100 dark:bg-amber-950/40', text: 'text-amber-700 dark:text-amber-300', ring: 'bg-amber-400' };
  return { bg: 'bg-red-100 dark:bg-red-950/40', text: 'text-red-700 dark:text-red-300', ring: 'bg-red-500' };
}

const MOCK_TOURS: TourEntry[] = [
  {
    tour_id: 'mock-1',
    driver_name: 'Max M.',
    dispatch_score: 87,
    stops_total: 4,
    stops_done: 2,
    current_stop: { address: 'Hauptstraße 12', eta_min: 3, status: 'current' },
    next_stop: { address: 'Bahnhofstr. 45', eta_min: 11, status: 'pending' },
    elapsed_min: 22,
    zone: 'A',
    sla_ok: true,
  },
  {
    tour_id: 'mock-2',
    driver_name: 'Jana K.',
    dispatch_score: 62,
    stops_total: 3,
    stops_done: 1,
    current_stop: { address: 'Ringstraße 8', eta_min: 1, status: 'current' },
    next_stop: { address: 'Marktplatz 3', eta_min: 9, status: 'pending' },
    elapsed_min: 35,
    zone: 'B',
    sla_ok: false,
  },
  {
    tour_id: 'mock-3',
    driver_name: 'Tom R.',
    dispatch_score: 91,
    stops_total: 5,
    stops_done: 4,
    current_stop: { address: 'Gartenweg 2', eta_min: 2, status: 'current' },
    elapsed_min: 48,
    zone: 'A',
    sla_ok: true,
  },
];

export function DispatchPhase914TourScoreLiveNavigation({ locationId }: Props) {
  const [tours, setTours] = useState<TourEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) {
      setTours(MOCK_TOURS);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/tour-score-live-navigation?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error();
      const json: ApiResponse = await res.json();
      setTours(json.tours ?? MOCK_TOURS);
    } catch {
      setTours(MOCK_TOURS);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  const avgScore = tours.length > 0
    ? Math.round(tours.reduce((s, t) => s + t.dispatch_score, 0) / tours.length)
    : 0;
  const slaBreaches = tours.filter((t) => !t.sla_ok).length;

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-background">
      <button
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-muted/30 transition"
        onClick={() => setOpen((v) => !v)}
      >
        <Navigation2 className={cn('h-4 w-4 shrink-0', slaBreaches > 0 ? 'text-red-500' : 'text-matcha-600')} />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground flex-1">
          Tour Score · Live Navigation
        </span>
        {/* Avg score badge */}
        <span className={cn(
          'rounded-full px-2 py-0.5 text-[10px] font-black',
          avgScore >= 80 ? 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300'
            : avgScore >= 60 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
            : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
        )}>
          Ø {avgScore} Pkt
        </span>
        {slaBreaches > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[10px] font-black text-red-700 dark:text-red-300">
            <AlertTriangle className="h-2.5 w-2.5" />
            {slaBreaches} SLA
          </span>
        )}
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        <span className="text-[10px] text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-border divide-y divide-border">
          {tours.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Keine aktiven Touren
            </div>
          ) : (
            tours.map((tour) => {
              const sc = scoreColor(tour.dispatch_score);
              const progress = tour.stops_total > 0
                ? Math.round((tour.stops_done / tour.stops_total) * 100)
                : 0;

              return (
                <div key={tour.tour_id} className={cn('px-4 py-3 flex flex-col gap-2', sc.bg)}>
                  {/* Row 1: Driver + Score + Zone */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <span className="text-xs font-bold text-foreground truncate">{tour.driver_name}</span>
                      {tour.zone && (
                        <span className="text-[9px] rounded bg-white/50 dark:bg-black/20 border border-current/10 px-1.5 py-0.5 font-bold text-foreground/60">
                          Zone {tour.zone}
                        </span>
                      )}
                      {!tour.sla_ok && (
                        <span className="flex items-center gap-0.5 text-[9px] font-black text-red-600 dark:text-red-400">
                          <AlertTriangle className="h-2.5 w-2.5" />
                          SLA
                        </span>
                      )}
                    </div>

                    {/* Score Arc */}
                    <div className="flex items-center gap-1 shrink-0">
                      <Star className={cn('h-3 w-3', sc.text)} />
                      <span className={cn('font-mono text-lg font-black tabular-nums', sc.text)}>
                        {tour.dispatch_score}
                      </span>
                    </div>
                  </div>

                  {/* Row 2: Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-700',
                          tour.dispatch_score >= 80 ? 'bg-matcha-500' : tour.dispatch_score >= 60 ? 'bg-amber-400' : 'bg-red-500',
                        )}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold tabular-nums text-muted-foreground shrink-0">
                      {tour.stops_done}/{tour.stops_total} Stops
                    </span>
                    <span className="text-[9px] tabular-nums text-muted-foreground shrink-0">
                      {tour.elapsed_min} Min
                    </span>
                  </div>

                  {/* Row 3: Current + Next Stop */}
                  <div className="flex gap-3 flex-wrap">
                    {tour.current_stop && (
                      <div className="flex items-center gap-1 text-[10px]">
                        <MapPin className="h-3 w-3 text-matcha-600 shrink-0" />
                        <span className="font-semibold text-foreground truncate max-w-[120px]">
                          {tour.current_stop.address}
                        </span>
                        <span className="font-bold text-matcha-700 dark:text-matcha-300 shrink-0">
                          ~{tour.current_stop.eta_min} Min
                        </span>
                      </div>
                    )}
                    {tour.next_stop && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span className="truncate max-w-[100px]">{tour.next_stop.address}</span>
                        <span className="shrink-0">~{tour.next_stop.eta_min} Min</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Footer */}
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/20 text-[10px] text-muted-foreground">
            <TrendingUp className="h-3 w-3" />
            <span>{tours.length} aktive Tour{tours.length !== 1 ? 'en' : ''} · Score Ø {avgScore}</span>
            <span className="ml-auto">30 s Polling</span>
          </div>
        </div>
      )}
    </div>
  );
}
