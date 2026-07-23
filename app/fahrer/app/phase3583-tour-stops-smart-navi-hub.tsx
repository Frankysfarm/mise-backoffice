'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, MapPin, Navigation, Phone, CheckCircle2, Clock, Package, AlertCircle } from 'lucide-react';

interface TourStopp {
  id: string;
  stopp_nr: number;
  kunde_name: string | null;
  adresse: string;
  status: 'pending' | 'arrived' | 'delivered' | 'failed';
  eta_min: number | null;
  distanz_km: number | null;
  pakete: number;
  kunde_telefon: string | null;
  sonderwunsch: string | null;
  zahlung: 'bar' | 'karte' | 'online' | null;
}

interface ApiResponse {
  stops: TourStopp[];
  batch_id: string;
  fortschritt_pct: number;
  naechster_stopp_nr: number | null;
}

const MOCK: ApiResponse = {
  batch_id: 'mock',
  fortschritt_pct: 33,
  naechster_stopp_nr: 2,
  stops: [
    { id: 's1', stopp_nr: 1, kunde_name: 'Anna M.', adresse: 'Pontstraße 12, Aachen', status: 'delivered', eta_min: null, distanz_km: null, pakete: 2, kunde_telefon: '+4915201234567', sonderwunsch: null, zahlung: 'online' },
    { id: 's2', stopp_nr: 2, kunde_name: 'Ben K.', adresse: 'Theaterstraße 44, Aachen', status: 'pending', eta_min: 8, distanz_km: 1.4, pakete: 1, kunde_telefon: '+4915209876543', sonderwunsch: 'Klingel unten links', zahlung: 'bar' },
    { id: 's3', stopp_nr: 3, kunde_name: 'Clara S.', adresse: 'Adalbertstraße 7, Aachen', status: 'pending', eta_min: 18, distanz_km: 3.2, pakete: 3, kunde_telefon: null, sonderwunsch: null, zahlung: 'karte' },
  ],
};

const STATUS_DOT: Record<string, string> = {
  delivered: 'bg-emerald-500',
  arrived: 'bg-blue-500',
  pending: 'bg-gray-300 dark:bg-gray-600',
  failed: 'bg-red-500',
};

const ZAHLUNGS_LABEL: Record<string, string> = {
  bar: '💵 Bar',
  karte: '💳 Karte',
  online: '✅ Bezahlt',
};

function mapsUrl(adresse: string): string {
  return `https://maps.google.com/?q=${encodeURIComponent(adresse)}`;
}

export function FahrerPhase3583TourStopsSmartNaviHub({
  stops: propStops,
  driverLat,
  driverLng,
}: {
  stops?: TourStopp[];
  driverLat?: number | null;
  driverLng?: number | null;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse>({ ...MOCK, stops: propStops ?? MOCK.stops });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // If propStops changes, update data
  useEffect(() => {
    if (propStops && propStops.length > 0) {
      setData(prev => ({ ...prev, stops: propStops }));
    }
  }, [propStops]);

  const nextStop = data.stops.find(s => s.stopp_nr === data.naechster_stopp_nr) ?? data.stops.find(s => s.status === 'pending');
  const delivered = data.stops.filter(s => s.status === 'delivered').length;
  const total = data.stops.length;

  return (
    <div className="border rounded-xl bg-white dark:bg-gray-900 shadow-sm mb-3">
      <button
        className="w-full flex items-center justify-between p-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          <Navigation className="w-4 h-4 text-blue-600" />
          Tour-Stops Smart Navi Hub
          <span className="text-xs text-gray-500 font-normal">{delivered}/{total} erledigt</span>
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3">
          {/* Fortschrittsbalken */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-gray-500">
              <span>Tour-Fortschritt</span>
              <span>{delivered}/{total} Stopps</span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-2 bg-emerald-500 rounded-full transition-all"
                style={{ width: `${(delivered / Math.max(total, 1)) * 100}%` }}
              />
            </div>
          </div>

          {/* Nächster Stopp Hero */}
          {nextStop && (
            <div className="rounded-xl border-2 border-blue-400 bg-blue-50 dark:bg-blue-900/20 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                  Nächster Stopp #{nextStop.stopp_nr}
                </span>
                {nextStop.eta_min !== null && (
                  <span className="ml-auto text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> ~{nextStop.eta_min} Min
                  </span>
                )}
              </div>

              <div className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                {nextStop.kunde_name ?? 'Kunde'}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">{nextStop.adresse}</div>

              {nextStop.sonderwunsch && (
                <div className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg p-2 border border-amber-200">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  {nextStop.sonderwunsch}
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  {nextStop.distanz_km !== null && <span>{nextStop.distanz_km} km</span>}
                  <span className="flex items-center gap-1"><Package className="w-3 h-3" /> {nextStop.pakete}</span>
                  {nextStop.zahlung && <span>{ZAHLUNGS_LABEL[nextStop.zahlung]}</span>}
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <a
                  href={mapsUrl(nextStop.adresse)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold transition-colors"
                >
                  <Navigation className="w-3.5 h-3.5" /> Google Maps
                </a>
                {nextStop.kunde_telefon && (
                  <a
                    href={`tel:${nextStop.kunde_telefon}`}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-semibold hover:bg-gray-200 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" /> Anrufen
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Alle Stopps */}
          <div className="space-y-1.5">
            {data.stops.map(s => (
              <div key={s.id} className={`border rounded-lg overflow-hidden ${s.status === 'delivered' ? 'opacity-60' : ''}`}>
                <button
                  className="w-full flex items-center gap-3 p-2.5 text-left"
                  onClick={() => setExpandedId(e => e === s.id ? null : s.id)}
                >
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${STATUS_DOT[s.status]}`} />
                  <span className="text-xs font-medium flex-shrink-0 text-gray-600 dark:text-gray-400">#{s.stopp_nr}</span>
                  <span className="text-xs font-semibold flex-1 truncate">{s.kunde_name ?? 'Kunde'}</span>
                  {s.status === 'delivered' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  ) : s.eta_min !== null ? (
                    <span className="text-xs text-gray-500 flex-shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {s.eta_min} Min
                    </span>
                  ) : null}
                </button>

                {expandedId === s.id && (
                  <div className="px-3 pb-2.5 border-t bg-gray-50 dark:bg-gray-800/50 space-y-2">
                    <div className="text-xs text-gray-600 dark:text-gray-400 pt-2">{s.adresse}</div>
                    {s.sonderwunsch && (
                      <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 rounded p-1.5 border border-amber-200">
                        ⚠ {s.sonderwunsch}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <a
                        href={mapsUrl(s.adresse)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium"
                      >
                        <Navigation className="w-3 h-3" /> Navi
                      </a>
                      {s.kunde_telefon && (
                        <a
                          href={`tel:${s.kunde_telefon}`}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs font-medium"
                        >
                          <Phone className="w-3 h-3" /> Anruf
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
