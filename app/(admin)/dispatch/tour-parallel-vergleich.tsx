'use client';

import * as React from 'react';

interface TourData {
  id: string;
  tourNummer: number;
  fahrer: string;
  stopsDone: number;
  stopsTotal: number;
  etaAbweichung: number;
  effizienz: number;
}

interface ApiResponse {
  tours: TourData[];
}

function scoreColor(score: number): string {
  if (score >= 85) return 'text-green-700 bg-green-50 border-green-200';
  if (score >= 70) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function progressBarColor(score: number): string {
  if (score >= 85) return 'bg-green-500';
  if (score >= 70) return 'bg-amber-500';
  return 'bg-red-500';
}

interface Props {
  locationId: string;
}

export function DispatchTourParallelVergleich({ locationId }: Props) {
  const [tours, setTours] = React.useState<TourData[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch(
        `/api/delivery/dispatch/tour-comparison?location_id=${encodeURIComponent(locationId)}`,
      );
      if (!res.ok) return;
      const json: ApiResponse = await res.json();
      if (Array.isArray(json.tours)) {
        setTours(json.tours);
      }
    } catch {
      // Netzwerk-Fehler — bisherige Daten behalten
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  React.useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 30_000);
    return () => clearInterval(iv);
  }, [load]);

  if (!loading && tours.length === 0) {
    return (
      <div className="rounded-xl border border-matcha-200 bg-matcha-50 p-4 mt-4">
        <span className="text-sm font-semibold text-matcha-700">Tour-Vergleich</span>
        <p className="text-xs text-matcha-500 mt-2">Keine aktiven Touren</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-matcha-200 bg-matcha-50 p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-matcha-700">Tour-Vergleich</span>
        <span className="text-xs text-matcha-500">
          {loading ? 'Laden…' : 'Aktualisiert alle 30s'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {tours.map((tour) => {
          const stopsPercent = Math.round((tour.stopsDone / tour.stopsTotal) * 100);
          return (
            <div
              key={tour.id}
              className="rounded-lg border border-matcha-200 bg-white p-3 flex flex-col gap-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-matcha-700">Tour {tour.tourNummer}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${scoreColor(tour.effizienz)}`}>
                  {tour.effizienz}
                </span>
              </div>

              <span className="text-sm font-medium text-gray-700 truncate">{tour.fahrer}</span>

              <div className="flex items-center gap-1 text-xs text-gray-500">
                <span>{tour.stopsDone}/{tour.stopsTotal} Stops</span>
                <span className="text-matcha-400">·</span>
                <span>±{tour.etaAbweichung} Min</span>
              </div>

              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${progressBarColor(tour.effizienz)}`}
                  style={{ width: `${stopsPercent}%` }}
                />
              </div>
              <span className="text-xs text-gray-400">{stopsPercent}% abgeschlossen</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
