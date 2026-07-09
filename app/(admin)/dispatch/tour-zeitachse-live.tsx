'use client';

import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, MapPin, Truck } from 'lucide-react';

interface TourStop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  eta_min?: number | null;
  bestellnummer?: string;
  adresse?: string;
}

interface ActiveTour {
  id: string;
  fahrerId: string;
  fahrerName: string;
  zone: string | null;
  startedAt: string | null;
  totalStops: number;
  completedStops: number;
  currentStopIdx: number;
  totalEtaMin: number | null;
  stops: TourStop[];
}

interface Props {
  tours: ActiveTour[];
}

function elapsedMin(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
}

function progressPct(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

export function DispatchTourZeitachseLive({ tours }: Props) {
  if (tours.length === 0) return null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
            <Truck className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <div className="text-sm font-bold text-stone-800">Tour-Zeitachse Live</div>
            <div className="text-[10px] text-stone-400">{tours.length} aktive Tour{tours.length !== 1 ? 'en' : ''}</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-blue-50 px-2 py-1">
          <div className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-[10px] font-bold text-blue-700">Live</span>
        </div>
      </div>

      {/* Tour rows */}
      <div className="divide-y divide-stone-50 p-4 space-y-4">
        {tours.map((tour) => {
          const pct = progressPct(tour.completedStops, tour.totalStops);
          const elapsed = elapsedMin(tour.startedAt);
          const remaining = tour.totalEtaMin ? Math.max(0, tour.totalEtaMin - elapsed) : null;

          const statusColor =
            pct >= 80 ? 'bg-matcha-500' : pct >= 50 ? 'bg-blue-500' : 'bg-amber-500';

          return (
            <div key={tour.id} className="space-y-2">
              {/* Tour header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-100 text-xs font-bold text-stone-600">
                    {tour.fahrerName.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-stone-800">{tour.fahrerName}</span>
                      {tour.zone && (
                        <span className="rounded px-1 bg-stone-100 text-[9px] font-bold text-stone-500">
                          Zone {tour.zone}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-stone-400">
                        <Clock className="inline h-2.5 w-2.5" /> {elapsed} Min unterwegs
                      </span>
                      {remaining !== null && (
                        <span className="text-[9px] text-blue-600 font-semibold">
                          ~{remaining} Min verbleibend
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-sm font-black tabular-nums text-stone-700">
                    {tour.completedStops}/{tour.totalStops}
                  </span>
                  <span className="text-[9px] text-stone-400">Stopps</span>
                </div>
              </div>

              {/* Progress bar with stops */}
              <div className="relative">
                {/* Background track */}
                <div className="h-1.5 w-full rounded-full bg-stone-100">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', statusColor)}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {/* Stop markers */}
                {tour.stops.length > 0 && (
                  <div className="absolute top-0 left-0 right-0 flex justify-between h-1.5">
                    {tour.stops.map((stop, i) => {
                      const leftPct = ((i + 1) / tour.totalStops) * 100;
                      const done = stop.geliefert_am !== null;
                      const isCurrent = i === tour.currentStopIdx && !done;
                      return (
                        <div
                          key={stop.id}
                          className="absolute top-1/2 -translate-y-1/2"
                          style={{ left: `${leftPct}%`, transform: 'translate(-50%, -50%)' }}
                        >
                          <div
                            className={cn(
                              'h-3 w-3 rounded-full border-2 transition-all',
                              done
                                ? 'bg-matcha-500 border-matcha-500'
                                : isCurrent
                                ? 'bg-white border-blue-500 ring-2 ring-blue-200'
                                : 'bg-white border-stone-300',
                            )}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Stop list - compact */}
              <div className="flex gap-1.5 flex-wrap">
                {tour.stops.map((stop, i) => {
                  const done = stop.geliefert_am !== null;
                  const isCurrent = i === tour.currentStopIdx && !done;
                  return (
                    <div
                      key={stop.id}
                      className={cn(
                        'flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold border',
                        done
                          ? 'bg-matcha-50 border-matcha-200 text-matcha-700'
                          : isCurrent
                          ? 'bg-blue-50 border-blue-300 text-blue-700 ring-1 ring-blue-300'
                          : 'bg-stone-50 border-stone-200 text-stone-400',
                      )}
                    >
                      {done ? <CheckCircle2 className="h-2.5 w-2.5" /> : <MapPin className="h-2.5 w-2.5" />}
                      Stopp {stop.reihenfolge}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
