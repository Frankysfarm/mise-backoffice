'use client';

import { Navigation, MapPin, CheckCircle2, Clock, ChevronRight, Package, Truck } from 'lucide-react';

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

type TourStopp = {
  id: string;
  reihenfolge: number;
  kunde_name: string;
  adresse: string;
  ist_aktuell: boolean;
  abgeschlossen: boolean;
  eta_min: number | null;
  distanz_km: number | null;
};

interface Props {
  stops?: TourStopp[];
  onNavigate?: (stop: TourStopp) => void;
  onComplete?: (stop: TourStopp) => void;
}

const MOCK_STOPS: TourStopp[] = [
  { id: 's1', reihenfolge: 1, kunde_name: 'Anna Meier', adresse: 'Hauptstraße 12, 10115 Berlin', ist_aktuell: false, abgeschlossen: true, eta_min: null, distanz_km: null },
  { id: 's2', reihenfolge: 2, kunde_name: 'Max Schreiber', adresse: 'Berliner Str. 45, 10117 Berlin', ist_aktuell: true, abgeschlossen: false, eta_min: 4, distanz_km: 1.2 },
  { id: 's3', reihenfolge: 3, kunde_name: 'Lena Vogel', adresse: 'Kastanienallee 7, 10119 Berlin', ist_aktuell: false, abgeschlossen: false, eta_min: 12, distanz_km: 2.8 },
  { id: 's4', reihenfolge: 4, kunde_name: 'Tim Koch', adresse: 'Rosenthaler Str. 22, 10119 Berlin', ist_aktuell: false, abgeschlossen: false, eta_min: 20, distanz_km: 3.5 },
];

export function TourStoppSequenzPro({ stops, onNavigate, onComplete }: Props) {
  const data = stops && stops.length > 0 ? stops : MOCK_STOPS;
  const sorted = [...data].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const completed = sorted.filter(s => s.abgeschlossen).length;
  const total = sorted.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div className="bg-white min-h-screen p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Truck className="w-5 h-5 text-emerald-600" />
        <h1 className="font-bold text-gray-900">Tour-Stopps</h1>
        <span className="ml-auto text-sm text-gray-500">{completed}/{total}</span>
      </div>

      <div className="mb-5">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Fortschritt</span>
          <span>{pct}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2.5">
          <div
            className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="space-y-3">
        {sorted.map((stop, idx) => {
          const isLast = idx === sorted.length - 1;

          return (
            <div key={stop.id} className="relative">
              {!isLast && (
                <div className={cn(
                  'absolute left-5 top-12 w-0.5 h-full -mb-3 z-0',
                  stop.abgeschlossen ? 'bg-emerald-300' : 'bg-gray-200'
                )} />
              )}

              <div className={cn(
                'relative z-10 rounded-xl border-2 p-4 transition-all',
                stop.ist_aktuell && 'border-emerald-500 bg-emerald-50 shadow-md',
                stop.abgeschlossen && !stop.ist_aktuell && 'border-gray-200 bg-gray-50 opacity-70',
                !stop.ist_aktuell && !stop.abgeschlossen && 'border-gray-200 bg-white'
              )}>
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5',
                    stop.abgeschlossen && 'bg-emerald-500',
                    stop.ist_aktuell && !stop.abgeschlossen && 'bg-emerald-500 animate-pulse',
                    !stop.ist_aktuell && !stop.abgeschlossen && 'bg-gray-200'
                  )}>
                    {stop.abgeschlossen
                      ? <CheckCircle2 className="w-5 h-5 text-white" />
                      : stop.ist_aktuell
                        ? <MapPin className="w-4 h-4 text-white" />
                        : <span className="text-xs font-bold text-gray-500">{stop.reihenfolge}</span>
                    }
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{stop.kunde_name}</p>
                      {stop.ist_aktuell && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Aktuell</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                      <Package className="w-3 h-3 shrink-0" />
                      <span className="truncate">{stop.adresse}</span>
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      {stop.eta_min !== null && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />{stop.eta_min} Min
                        </span>
                      )}
                      {stop.distanz_km !== null && (
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <ChevronRight className="w-3 h-3" />{stop.distanz_km} km
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {stop.ist_aktuell && !stop.abgeschlossen && (
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => onNavigate?.(stop)}
                      className="flex-1 flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white rounded-xl py-3 font-semibold text-sm transition-colors"
                    >
                      <Navigation className="w-4 h-4" />
                      Navigieren
                    </button>
                    <button
                      onClick={() => onComplete?.(stop)}
                      className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-xl py-3 font-semibold text-sm transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Abschließen
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
