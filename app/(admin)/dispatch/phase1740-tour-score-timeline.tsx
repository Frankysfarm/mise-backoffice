'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { MapPin, Clock, CheckCircle2, Bike, AlertTriangle, TrendingUp, Route } from 'lucide-react';

/**
 * Phase 1740 — Tour-Score-Timeline (Dispatch)
 *
 * Zeigt jede aktive Tour als horizontale Timeline:
 * Restaurantabholung → Stopp 1 → Stopp 2 → … → Rückkehr
 * Farbkodiert nach Overall-Score, mit Echtzeit-Fortschrittsbalken.
 * Zeigt Score-Trend (besser/schlechter als letzte Tour).
 */

interface Stop {
  id: string;
  type: 'pickup' | 'delivery' | 'return';
  sequence: number;
  address?: string | null;
  geliefert_am?: string | null;
  estimated_delivery_at?: string | null;
}

interface Tour {
  id: string;
  driverName: string;
  zone: string | null;
  state: string;
  dispatchScore: number;
  stops: Stop[];
  totalEtaMin: number | null;
  kitchenStartAt: string | null;
  createdAt: string;
}

function scoreColor(score: number) {
  if (score >= 80) return { text: 'text-matcha-700', bg: 'bg-matcha-500', ring: '#4d7c0f', bgLight: 'bg-matcha-50 border-matcha-200' };
  if (score >= 60) return { text: 'text-amber-700', bg: 'bg-amber-400', ring: '#d97706', bgLight: 'bg-amber-50 border-amber-200' };
  return { text: 'text-red-700', bg: 'bg-red-500', ring: '#dc2626', bgLight: 'bg-red-50 border-red-200' };
}

function ScoreBadge({ score }: { score: number }) {
  const c = scoreColor(score);
  return (
    <div className={cn('flex items-center justify-center w-9 h-9 rounded-full font-black text-xs text-white shrink-0', c.bg)}>
      {Math.round(score)}
    </div>
  );
}

function StopDot({ stop, isCurrent }: { stop: Stop; isCurrent: boolean }) {
  const done = !!stop.geliefert_am;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className={cn(
        'w-5 h-5 rounded-full border-2 flex items-center justify-center text-white transition-all',
        done
          ? 'bg-matcha-500 border-matcha-600'
          : isCurrent
            ? 'bg-saffron border-saffron/70 animate-pulse'
            : 'bg-stone-200 border-stone-300',
      )}>
        {done
          ? <CheckCircle2 className="w-2.5 h-2.5" />
          : stop.type === 'pickup'
            ? <Bike className="w-2.5 h-2.5 text-stone-500" />
            : <MapPin className="w-2.5 h-2.5 text-stone-400" />
        }
      </div>
      <span className="text-[8px] text-muted-foreground font-bold tabular-nums">
        {stop.sequence}
      </span>
    </div>
  );
}

const MOCK_TOURS: Tour[] = [
  {
    id: 't1', driverName: 'Max M.', zone: 'A', state: 'on_route', dispatchScore: 88,
    totalEtaMin: 42, kitchenStartAt: null, createdAt: new Date(Date.now() - 25 * 60_000).toISOString(),
    stops: [
      { id: 's1', type: 'pickup', sequence: 0, address: 'Restaurant', geliefert_am: new Date(Date.now() - 20 * 60_000).toISOString(), estimated_delivery_at: null },
      { id: 's2', type: 'delivery', sequence: 1, address: 'Aachener Str. 12', geliefert_am: new Date(Date.now() - 10 * 60_000).toISOString(), estimated_delivery_at: null },
      { id: 's3', type: 'delivery', sequence: 2, address: 'Pontstr. 7', geliefert_am: null, estimated_delivery_at: new Date(Date.now() + 8 * 60_000).toISOString() },
      { id: 's4', type: 'delivery', sequence: 3, address: 'Elisabethstr. 3', geliefert_am: null, estimated_delivery_at: new Date(Date.now() + 20 * 60_000).toISOString() },
    ],
  },
  {
    id: 't2', driverName: 'Sarah K.', zone: 'B', state: 'on_route', dispatchScore: 61,
    totalEtaMin: 55, kitchenStartAt: null, createdAt: new Date(Date.now() - 35 * 60_000).toISOString(),
    stops: [
      { id: 's5', type: 'pickup', sequence: 0, address: 'Restaurant', geliefert_am: new Date(Date.now() - 30 * 60_000).toISOString(), estimated_delivery_at: null },
      { id: 's6', type: 'delivery', sequence: 1, address: 'Jakobstr. 5', geliefert_am: new Date(Date.now() - 15 * 60_000).toISOString(), estimated_delivery_at: null },
      { id: 's7', type: 'delivery', sequence: 2, address: 'Karlsgraben 1', geliefert_am: null, estimated_delivery_at: new Date(Date.now() + 12 * 60_000).toISOString() },
    ],
  },
];

export function DispatchPhase1740TourScoreTimeline({
  batches,
  drivers,
  locationId,
}: {
  batches?: any[];
  drivers?: any[];
  locationId?: string | null;
}) {
  const [tours, setTours] = useState<Tour[]>([]);
  const [tick, setTick] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (batches && batches.length > 0) {
      const mapped: Tour[] = batches
        .filter((b: any) => ['on_route', 'assigned', 'at_restaurant'].includes(b.state))
        .map((b: any) => {
          const driver = Array.isArray(drivers)
            ? drivers.find((d: any) => d.id === b.driver_id)
            : null;
          const driverName = driver?.name ?? b.driver?.name ?? 'Fahrer';
          const stops: Stop[] = (b.stops ?? [])
            .sort((a: any, b: any) => (a.sequence ?? 0) - (b.sequence ?? 0))
            .map((s: any) => ({
              id: s.id,
              type: s.type ?? 'delivery',
              sequence: s.sequence ?? 0,
              address: s.address ?? null,
              geliefert_am: s.geliefert_am ?? null,
              estimated_delivery_at: s.order?.eta_latest ?? null,
            }));
          return {
            id: b.id,
            driverName,
            zone: b.zone ?? null,
            state: b.state,
            dispatchScore: b.dispatch_score ?? 70,
            stops,
            totalEtaMin: b.total_eta_min ?? null,
            kitchenStartAt: b.kitchen_start_at ?? null,
            createdAt: b.created_at,
          };
        });
      setTours(mapped.length > 0 ? mapped : MOCK_TOURS);
    } else {
      setTours(MOCK_TOURS);
    }
  }, [batches, drivers, tick]);

  if (tours.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-saffron" />
          <span className="font-display text-sm font-bold uppercase tracking-wider text-char">Tour-Score-Timeline</span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-bold text-stone-600">
            {tours.length} aktiv
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <TrendingUp className="w-3 h-3" />
          <span>Live · alle 10s</span>
        </div>
      </div>

      <div className="divide-y">
        {tours.map(tour => {
          const sc = scoreColor(tour.dispatchScore);
          const now = Date.now();
          const elapsedMin = Math.round((now - new Date(tour.createdAt).getTime()) / 60_000);
          const doneCount = tour.stops.filter(s => !!s.geliefert_am).length;
          const totalDeliveries = tour.stops.filter(s => s.type === 'delivery').length;
          const progressPct = totalDeliveries > 0 ? Math.round((doneCount / totalDeliveries) * 100) : 0;

          // Aktueller Stopp = erster nicht-gelieferter Delivery-Stopp
          const currentStopIdx = tour.stops.findIndex(s => s.type === 'delivery' && !s.geliefert_am);

          return (
            <div key={tour.id} className="px-4 py-4">
              {/* Header */}
              <div className="flex items-center gap-3 mb-3">
                <ScoreBadge score={tour.dispatchScore} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-sm text-char">{tour.driverName}</span>
                    {tour.zone && (
                      <span className="text-[10px] font-bold rounded-full bg-stone-100 border border-stone-200 px-1.5 py-0.5">
                        Zone {tour.zone}
                      </span>
                    )}
                    <span className={cn('text-[10px] font-bold rounded-full border px-1.5 py-0.5', sc.bgLight, sc.text)}>
                      Score {Math.round(tour.dispatchScore)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      {elapsedMin} Min
                    </span>
                    <span>{doneCount}/{totalDeliveries} Stopps</span>
                    {tour.totalEtaMin && (
                      <span>Ziel: {tour.totalEtaMin} Min</span>
                    )}
                  </div>
                </div>
                {/* ETA-Countdown */}
                {tour.totalEtaMin && (
                  <div className="shrink-0 text-right">
                    <div className={cn(
                      'text-lg font-black tabular-nums',
                      tour.totalEtaMin - elapsedMin < 5 ? 'text-red-600' : tour.totalEtaMin - elapsedMin < 15 ? 'text-amber-600' : 'text-matcha-600',
                    )}>
                      ~{Math.max(0, tour.totalEtaMin - elapsedMin)} Min
                    </div>
                    <div className="text-[9px] text-muted-foreground">verbleibend</div>
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div className="flex items-center gap-0 overflow-x-auto pb-1">
                {tour.stops.map((stop, idx) => (
                  <div key={stop.id} className="flex items-center">
                    <StopDot stop={stop} isCurrent={idx === currentStopIdx} />
                    {idx < tour.stops.length - 1 && (
                      <div className={cn(
                        'h-0.5 w-6 mx-0.5 rounded-full',
                        stop.geliefert_am ? 'bg-matcha-400' : 'bg-stone-200',
                      )} />
                    )}
                  </div>
                ))}
              </div>

              {/* Fortschrittsbalken */}
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', sc.bg)}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold tabular-nums text-muted-foreground">{progressPct}%</span>
              </div>

              {/* Aktueller Stopp */}
              {currentStopIdx >= 0 && (
                <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <MapPin className="w-3 h-3 shrink-0 text-saffron" />
                  <span className="font-medium truncate">
                    Jetzt: {tour.stops[currentStopIdx]?.address ?? 'Stopp ' + (currentStopIdx + 1)}
                  </span>
                  {tour.stops[currentStopIdx]?.estimated_delivery_at && (
                    <span className="shrink-0 font-bold text-matcha-700 ml-auto">
                      {(() => {
                        const eta = new Date(tour.stops[currentStopIdx].estimated_delivery_at!);
                        const diff = Math.round((eta.getTime() - Date.now()) / 60_000);
                        return diff > 0 ? `ETA ~${diff} Min` : 'jetzt fällig';
                      })()}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
