'use client';

import { useEffect, useState } from 'react';
import { MapPin, CheckCircle2, Circle, Clock, Navigation } from 'lucide-react';

interface BatchStop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    eta_earliest: string | null;
    eta_latest: string | null;
  } | null;
}

interface Batch {
  id: string;
  status: string;
  fahrer_id?: string | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: BatchStop[];
}

interface Props {
  batches: Batch[];
}

function minsUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  return Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
}

export function DispatchPhase630TourVisualisierungsPanel({ batches }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const aktiveBatches = batches.filter((b) =>
    ['unterwegs', 'aktiv', 'in_progress', 'active'].includes(b.status ?? '')
  );

  if (aktiveBatches.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Navigation className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <span className="text-sm font-bold uppercase tracking-wide text-blue-800 dark:text-blue-200">
          Tour-Visualisierung · Live
        </span>
        <span className="ml-auto rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-300">
          {aktiveBatches.length} aktiv
        </span>
      </div>

      <div className="flex flex-col gap-4">
        {aktiveBatches.slice(0, 4).map((batch) => {
          const batchStops = [...batch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
          const completed = batchStops.filter((s) => s.geliefert_am !== null).length;
          const total = batchStops.length;
          const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
          const driverName = batch.fahrer
            ? `${batch.fahrer.vorname} ${batch.fahrer.nachname.charAt(0)}.`
            : 'Fahrer';

          return (
            <div
              key={batch.id}
              className="rounded-lg border border-blue-100 dark:border-blue-900 bg-white dark:bg-gray-900/40 p-3"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-bold text-gray-800 dark:text-gray-100">{driverName}</span>
                {batch.zone && (
                  <span className="rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                    Zone {batch.zone}
                  </span>
                )}
                <span className="ml-auto text-xs font-semibold text-gray-500 dark:text-gray-400 tabular-nums">
                  {completed}/{total} Stops
                </span>
              </div>

              <div className="mb-2 h-2 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-blue-500 dark:bg-blue-400 transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {batchStops.length > 0 && (
                <div className="flex flex-col gap-1.5 mt-2">
                  {batchStops.map((stop, idx) => {
                    const isDone = stop.geliefert_am !== null;
                    const isCurrent = !isDone && idx === completed;
                    const eta = minsUntil(stop.order?.eta_earliest);

                    return (
                      <div
                        key={stop.id}
                        className={`flex items-center gap-2 rounded px-2 py-1 ${
                          isCurrent
                            ? 'bg-blue-100 dark:bg-blue-900/30'
                            : isDone
                            ? 'opacity-50'
                            : ''
                        }`}
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-matcha-500" />
                        ) : isCurrent ? (
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-500 animate-pulse" />
                        ) : (
                          <Circle className="h-3.5 w-3.5 shrink-0 text-gray-300 dark:text-gray-600" />
                        )}
                        <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 min-w-0 truncate">
                          {stop.order?.bestellnummer ? `#${stop.order.bestellnummer}` : `Stop ${stop.reihenfolge}`}
                        </span>
                        {stop.order?.kunde_adresse && (
                          <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate flex-1">
                            {stop.order.kunde_adresse}
                          </span>
                        )}
                        {eta !== null && isCurrent && (
                          <span className="ml-auto shrink-0 flex items-center gap-1 text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                            <Clock className="h-3 w-3" />
                            {eta <= 0 ? 'Jetzt' : `~${eta} Min`}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {total === 0 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center py-2">
                  Keine Stops zugewiesen
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
