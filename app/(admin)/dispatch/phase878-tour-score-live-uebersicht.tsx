'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  Bike, CheckCircle2, Clock, MapPin, Star, Target, TrendingUp,
} from 'lucide-react';

/**
 * phase878 — Tour Score Live-Übersicht
 *
 * Zeigt alle aktiven Touren mit Dispatch-Score, Stop-Fortschritt und
 * Fahrer-Name als kompakte visuelle Übersicht.
 * Score 0–100 → Farb-Balken: rot < 50, amber 50–75, grün > 75
 */

interface TourStop {
  id: string;
  sequence: number;
  completed_at: string | null;
}

interface ActiveTour {
  id: string;
  state: string;
  dispatch_score: number | null;
  total_eta_min: number | null;
  zone: string | null;
  created_at: string;
  driver: { id: string; name: string; vehicle: string } | null;
  stops: TourStop[];
}

interface Props {
  locationId?: string | null;
  initialTours?: ActiveTour[];
}

function scoreColor(score: number | null): string {
  if (score == null) return 'bg-muted';
  if (score >= 75) return 'bg-matcha-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function scoreTextColor(score: number | null): string {
  if (score == null) return 'text-muted-foreground';
  if (score >= 75) return 'text-matcha-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function elapsedMin(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
}

function useTick(ms = 10_000) {
  const [, set] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => set((n) => n + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}

export function DispatchPhase878TourScoreLiveUebersicht({ locationId, initialTours = [] }: Props) {
  const [tours, setTours] = useState<ActiveTour[]>(initialTours);
  useTick();
  const supabase = createClient();

  useEffect(() => {
    if (!locationId) return;
    let mounted = true;

    async function load() {
      const { data } = await supabase
        .from('mise_delivery_batches')
        .select(`
          id, state, dispatch_score, total_eta_min, zone, created_at,
          driver:mise_drivers(id, name, vehicle),
          stops:mise_delivery_batch_stops(id, sequence, completed_at)
        `)
        .eq('location_id', locationId)
        .in('state', ['assigned', 'at_restaurant', 'on_route'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (!mounted || !data) return;
      setTours(data as unknown as ActiveTour[]);
    }

    load();
    const iv = setInterval(load, 15_000);
    return () => { mounted = false; clearInterval(iv); };
  }, [locationId]);

  // Fallback mock when no real data
  const displayTours = tours.length > 0 ? tours : (locationId ? [] : MOCK_TOURS);

  if (displayTours.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 text-center text-sm text-muted-foreground">
        <Target size={20} className="mx-auto mb-1 opacity-30" />
        Keine aktiven Touren
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-matcha-600" />
          <span className="text-sm font-semibold text-foreground">Tour Score Übersicht</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{displayTours.length} aktiv</span>
      </div>

      <div className="space-y-3">
        {displayTours.map((tour) => {
          const completed = tour.stops.filter((s) => s.completed_at).length;
          const total = tour.stops.length;
          const progress = total > 0 ? (completed / total) : 0;
          const elapsed = elapsedMin(tour.created_at);
          const score = tour.dispatch_score;

          return (
            <div key={tour.id} className="space-y-1.5">
              {/* Tour header */}
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Bike size={11} className="text-muted-foreground shrink-0" />
                  <span className="font-medium text-foreground truncate">
                    {tour.driver?.name ?? 'Kein Fahrer'}
                  </span>
                  {tour.zone && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                      <MapPin size={7} />
                      {tour.zone}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-muted-foreground">
                    <Clock size={9} className="inline mr-0.5" />
                    {elapsed} min
                  </span>
                  {score != null && (
                    <span className={cn('font-black text-sm tabular-nums', scoreTextColor(score))}>
                      {score}
                    </span>
                  )}
                </div>
              </div>

              {/* Score bar */}
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-500', scoreColor(score))}
                  style={{ width: `${score ?? 0}%` }}
                />
              </div>

              {/* Stop progress */}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>
                  <CheckCircle2 size={9} className="inline mr-0.5 text-matcha-500" />
                  {completed}/{total} Stops
                </span>
                {tour.total_eta_min != null && (
                  <span>ETA ~{tour.total_eta_min} min gesamt</span>
                )}
              </div>

              {/* Stop dots */}
              <div className="flex gap-1">
                {tour.stops
                  .slice()
                  .sort((a, b) => a.sequence - b.sequence)
                  .map((s) => (
                    <div
                      key={s.id}
                      className={cn(
                        'h-2 flex-1 rounded-full',
                        s.completed_at ? 'bg-matcha-500' : 'bg-muted',
                      )}
                    />
                  ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-matcha-500" />
        Live · aktualisiert alle 15 s
      </div>
    </div>
  );
}

const MOCK_TOURS: ActiveTour[] = [
  {
    id: 'm1',
    state: 'on_route',
    dispatch_score: 82,
    total_eta_min: 45,
    zone: 'Nord',
    created_at: new Date(Date.now() - 18 * 60000).toISOString(),
    driver: { id: 'd1', name: 'Marco K.', vehicle: 'bike' },
    stops: [
      { id: 's1', sequence: 1, completed_at: new Date(Date.now() - 5 * 60000).toISOString() },
      { id: 's2', sequence: 2, completed_at: null },
      { id: 's3', sequence: 3, completed_at: null },
    ],
  },
  {
    id: 'm2',
    state: 'on_route',
    dispatch_score: 64,
    total_eta_min: 30,
    zone: 'Mitte',
    created_at: new Date(Date.now() - 25 * 60000).toISOString(),
    driver: { id: 'd2', name: 'Sofia L.', vehicle: 'bike' },
    stops: [
      { id: 's4', sequence: 1, completed_at: new Date(Date.now() - 10 * 60000).toISOString() },
      { id: 's5', sequence: 2, completed_at: new Date(Date.now() - 3 * 60000).toISOString() },
      { id: 's6', sequence: 3, completed_at: null },
    ],
  },
  {
    id: 'm3',
    state: 'assigned',
    dispatch_score: 45,
    total_eta_min: 55,
    zone: 'Süd',
    created_at: new Date(Date.now() - 8 * 60000).toISOString(),
    driver: { id: 'd3', name: 'Kai R.', vehicle: 'car' },
    stops: [
      { id: 's7', sequence: 1, completed_at: null },
      { id: 's8', sequence: 2, completed_at: null },
    ],
  },
];
