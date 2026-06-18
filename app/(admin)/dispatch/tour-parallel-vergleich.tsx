'use client';

import * as React from 'react';

// Mock — API-Anbindung folgt
interface TourData {
  id: string;
  tourNummer: number;
  fahrer: string;
  stopsDone: number;
  stopsTotal: number;
  etaAbweichung: number;
  effizienz: number;
}

function getMockTours(): TourData[] {
  const names = ['Max M.', 'Jana K.', 'Tom S.', 'Lena B.'];
  return names.slice(0, 4).map((name, i) => ({
    id: `tour-${i + 1}`,
    tourNummer: i + 1,
    fahrer: name,
    stopsDone: Math.floor(Math.random() * 5) + 1,
    stopsTotal: Math.floor(Math.random() * 4) + 5,
    etaAbweichung: Math.floor(Math.random() * 7) + 2,
    effizienz: Math.floor(Math.random() * 25) + 72,
  }));
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

export function DispatchTourParallelVergleich({ locationId: _locationId }: Props) {
  const [tours, setTours] = React.useState<TourData[]>(() => getMockTours());

  React.useEffect(() => {
    const iv = setInterval(() => setTours(getMockTours()), 30_000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="rounded-xl border border-matcha-200 bg-matcha-50 p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-matcha-700">Tour-Vergleich</span>
        <span className="text-xs text-matcha-500">Aktualisiert alle 30s</span>
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

              {/* Fortschrittsbalken Stops */}
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
