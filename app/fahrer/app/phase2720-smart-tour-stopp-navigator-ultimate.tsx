'use client';
import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, MapPin, Navigation2, Phone, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourStop {
  stop_nr: number;
  adresse: string;
  kunde_name: string;
  telefon: string | null;
  notiz: string | null;
  status: 'offen' | 'aktuell' | 'geliefert';
  eta_min: number | null;
  lat: number | null;
  lng: number | null;
}

interface ApiData {
  batch_id: string;
  stops: TourStop[];
  gesamt_stops: number;
  abgeschlossene_stops: number;
  eta_rueckkehr_min: number | null;
}

const MOCK: ApiData = {
  batch_id: 'b1',
  stops: [
    { stop_nr: 1, adresse: 'Hauptstr. 12, Musterstadt', kunde_name: 'Anna W.', telefon: '+49 151 1234567', notiz: 'Bitte klingeln', status: 'aktuell', eta_min: 3, lat: 48.137, lng: 11.576 },
    { stop_nr: 2, adresse: 'Gartenweg 5, Musterstadt', kunde_name: 'Ben K.', telefon: null, notiz: null, status: 'offen', eta_min: 9, lat: 48.142, lng: 11.580 },
    { stop_nr: 3, adresse: 'Lindenstr. 8, Musterstadt', kunde_name: 'Cora L.', telefon: '+49 152 9876543', notiz: 'Hintereingang', status: 'offen', eta_min: 17, lat: 48.135, lng: 11.572 },
  ],
  gesamt_stops: 3,
  abgeschlossene_stops: 0,
  eta_rueckkehr_min: 28,
};

function navUrl(lat: number | null, lng: number | null, adresse: string): string {
  if (lat && lng) return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(adresse)}`;
}

export function FahrerPhase2720SmartTourStoppNavigatorUltimate({
  driverId,
  batchId,
}: {
  driverId?: string;
  batchId?: string | null;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [tick, setTick] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [confirming, setConfirming] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/delivery/fahrer/tour-stopp-navigator?driver_id=${driverId ?? ''}&batch_id=${batchId ?? ''}`)
        .then(r => r.json())
        .then((d: ApiData) => setData(d))
        .catch(() => setData(MOCK));
    if (!driverId && !batchId) { setData(MOCK); return; }
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [driverId, batchId]);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1_000);
    return () => clearInterval(iv);
  }, []);

  const handleConfirm = async (stopNr: number) => {
    setConfirming(String(stopNr));
    await fetch('/api/delivery/fahrer/stopp-bestaetigung', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driver_id: driverId, batch_id: batchId, stop_nr: stopNr }),
    }).catch(() => {});
    setConfirming(null);
    setData(d => d ? { ...d, stops: d.stops.map(s => s.stop_nr === stopNr ? { ...s, status: 'geliefert' } : s.stop_nr === stopNr + 1 ? { ...s, status: 'aktuell' } : s) } : d);
  };

  if (!data) return null;

  const currentStop = data.stops.find(s => s.status === 'aktuell');
  const nextStops = data.stops.filter(s => s.status === 'offen');
  const doneCount = data.stops.filter(s => s.status === 'geliefert').length;
  const progress = Math.round((doneCount / data.gesamt_stops) * 100);

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white shadow-sm mb-3 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-matcha-50 border-b border-matcha-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation2 size={16} className="text-matcha-700" />
          <span className="font-bold text-sm text-matcha-900">Tour Navigator</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-600">
          <span>{doneCount}/{data.gesamt_stops} Stopps</span>
          {data.eta_rueckkehr_min !== null && (
            <span className="font-semibold text-matcha-700">Rückkehr in ~{data.eta_rueckkehr_min} Min</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-gray-100">
        <div className="h-full bg-matcha-500 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      {/* Current Stop Hero */}
      {currentStop ? (
        <div className="px-4 py-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 border-2 border-amber-400 flex items-center justify-center text-sm font-black text-amber-700">
              {currentStop.stop_nr}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-0.5">Aktueller Stopp</div>
              <div className="text-sm font-bold text-gray-900 leading-tight">{currentStop.adresse}</div>
              <div className="text-xs text-gray-600 mt-0.5">{currentStop.kunde_name}</div>
              {currentStop.notiz && (
                <div className="mt-1.5 flex items-start gap-1 text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1">
                  <AlertTriangle size={10} className="flex-shrink-0 mt-0.5" />
                  {currentStop.notiz}
                </div>
              )}
            </div>
            {currentStop.eta_min !== null && (
              <div className="flex-shrink-0 text-center">
                <div className="text-2xl font-black text-amber-600 tabular-nums leading-none">{currentStop.eta_min}'</div>
                <div className="text-[9px] text-gray-400">ETA Min</div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2">
            <a
              href={navUrl(currentStop.lat, currentStop.lng, currentStop.adresse)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-blue-500 text-white text-xs font-semibold"
            >
              <Navigation2 size={16} />
              Navi
            </a>
            {currentStop.telefon ? (
              <a
                href={`tel:${currentStop.telefon}`}
                className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-matcha-500 text-white text-xs font-semibold"
              >
                <Phone size={16} />
                Anruf
              </a>
            ) : (
              <div className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-gray-100 text-gray-400 text-xs font-semibold cursor-not-allowed">
                <Phone size={16} />
                Kein Tel.
              </div>
            )}
            <button
              onClick={() => handleConfirm(currentStop.stop_nr)}
              disabled={confirming === String(currentStop.stop_nr)}
              className={cn('flex flex-col items-center gap-1 py-2.5 rounded-xl text-white text-xs font-semibold transition-colors',
                confirming === String(currentStop.stop_nr) ? 'bg-gray-300' : 'bg-green-500 active:bg-green-600'
              )}
            >
              <CheckCircle2 size={16} />
              {confirming === String(currentStop.stop_nr) ? '...' : 'Geliefert'}
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 py-4 text-center">
          <CheckCircle2 size={24} className="text-green-500 mx-auto mb-1" />
          <div className="text-sm font-semibold text-gray-700">Alle Stopps abgeschlossen!</div>
        </div>
      )}

      {/* Next stops preview */}
      {nextStops.length > 0 && (
        <div className="border-t border-matcha-100">
          <button
            onClick={() => setShowAll(s => !s)}
            className="w-full flex items-center justify-between px-4 py-2 text-xs text-gray-500 hover:bg-matcha-50 transition-colors"
          >
            <span className="flex items-center gap-1">
              <MapPin size={11} />
              {nextStops.length} weitere Stopp{nextStops.length > 1 ? 's' : ''}
            </span>
            <span>{showAll ? '▲' : '▼'}</span>
          </button>

          {showAll && (
            <div className="divide-y divide-matcha-50">
              {nextStops.map(s => (
                <div key={s.stop_nr} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center text-[10px] font-bold text-gray-500">
                    {s.stop_nr}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-700 truncate">{s.adresse}</div>
                    <div className="text-[10px] text-gray-400">{s.kunde_name}</div>
                  </div>
                  {s.eta_min !== null && (
                    <div className="flex-shrink-0 flex items-center gap-0.5 text-xs text-gray-500">
                      <Timer size={10} />
                      {s.eta_min}'
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
