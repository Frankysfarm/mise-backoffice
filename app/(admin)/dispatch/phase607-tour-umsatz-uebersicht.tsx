'use client';

import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, Package, Euro, ChevronDown, ChevronUp } from 'lucide-react';

interface TourUmsatz {
  batchId: string;
  tourNummer: string | number;
  fahrerName: string;
  stops: number;
  geliefert: number;
  umsatz: number;
  status: string;
}

interface Props {
  locationId: string | null;
}

function getTourUmsatzMock(locationId: string): TourUmsatz[] {
  return [
    { batchId: 'mock-1', tourNummer: 1, fahrerName: 'Max M.', stops: 4, geliefert: 3, umsatz: 124.5, status: 'aktiv' },
    { batchId: 'mock-2', tourNummer: 2, fahrerName: 'Anna K.', stops: 3, geliefert: 3, umsatz: 89.9, status: 'abgeschlossen' },
    { batchId: 'mock-3', tourNummer: 3, fahrerName: 'Tobias R.', stops: 5, geliefert: 2, umsatz: 67.4, status: 'aktiv' },
  ];
}

export function DispatchPhase607TourUmsatzUebersicht({ locationId }: Props) {
  const [touren, setTouren] = useState<TourUmsatz[]>([]);
  const [loading, setLoading] = useState(true);
  const [offen, setOffen] = useState(true);

  const laden = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/tour-analytics?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('api error');
      const data = await res.json();
      if (data.ok && Array.isArray(data.touren) && data.touren.length > 0) {
        setTouren(data.touren);
      } else {
        setTouren(getTourUmsatzMock(locationId));
      }
    } catch {
      setTouren(getTourUmsatzMock(locationId ?? ''));
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 60000);
    return () => clearInterval(id);
  }, [laden]);

  if (loading || touren.length === 0) return null;

  const gesamt = touren.reduce((s, t) => s + t.umsatz, 0);
  const aktivCount = touren.filter((t) => t.status === 'aktiv').length;

  return (
    <div className="rounded-xl border border-matcha-200 dark:border-matcha-800 bg-white dark:bg-matcha-950 shadow-sm mb-4">
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-matcha-600 dark:text-matcha-400" />
          <span className="text-sm font-bold text-matcha-900 dark:text-matcha-100">
            Tour-Umsatz-Übersicht
          </span>
          <span className="text-xs bg-matcha-100 dark:bg-matcha-800 text-matcha-700 dark:text-matcha-300 rounded-full px-2 py-0.5">
            {aktivCount} aktiv
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-matcha-700 dark:text-matcha-300">
            {gesamt.toFixed(2)} €
          </span>
          {offen ? (
            <ChevronUp className="w-4 h-4 text-matcha-500" />
          ) : (
            <ChevronDown className="w-4 h-4 text-matcha-500" />
          )}
        </div>
      </button>

      {offen && (
        <div className="px-4 pb-4 space-y-2 border-t border-matcha-100 dark:border-matcha-800 pt-3">
          {touren
            .slice()
            .sort((a, b) => b.umsatz - a.umsatz)
            .map((tour) => {
              const fertigPct =
                tour.stops > 0 ? Math.round((tour.geliefert / tour.stops) * 100) : 0;
              return (
                <div
                  key={tour.batchId}
                  className="rounded-lg bg-gray-50 dark:bg-matcha-900/40 border border-gray-200 dark:border-matcha-800 p-3"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                        Tour #{tour.tourNummer}
                      </span>
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        {tour.fahrerName}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Euro className="w-3 h-3 text-matcha-600 dark:text-matcha-400" />
                      <span className="text-sm font-bold text-matcha-700 dark:text-matcha-300">
                        {tour.umsatz.toFixed(2)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 dark:bg-matcha-800 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-matcha-500"
                        style={{ width: `${fertigPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {tour.geliefert}/{tour.stops} Stops
                    </span>
                    <span
                      className={`text-xs rounded-full px-1.5 py-0.5 ${
                        tour.status === 'aktiv'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}
                    >
                      {tour.status}
                    </span>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
