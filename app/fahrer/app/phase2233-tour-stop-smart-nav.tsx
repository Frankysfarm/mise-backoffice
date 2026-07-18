'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, Navigation, Phone, ChevronDown, ChevronUp, Package } from 'lucide-react';

interface StopDetail {
  adresse: string;
  kundeName: string;
  bestellNr: string;
  anzahlArtikel: number;
}

interface NextTourData {
  batch_id: string | null;
  stops: StopDetail[];
  distance_km: number | null;
  estimated_min: number | null;
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

export function FahrerPhase2233TourStopSmartNav({ driverId, isOnline }: Props) {
  const [data, setData] = useState<NextTourData | null>(null);
  const [open, setOpen] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);

  const load = useCallback(async () => {
    if (!driverId || !isOnline) return;
    try {
      const res = await fetch(`/api/delivery/driver/naechste-tour?driver_id=${driverId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.batch_id) setData(json);
        else setData(null);
      }
    } catch {
      // ignore
    }
  }, [driverId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !data || !data.batch_id || data.stops.length === 0) return null;

  const current = data.stops[currentIdx] ?? data.stops[0];
  const remaining = data.stops.length - currentIdx;
  const hasNext = currentIdx < data.stops.length - 1;

  const openMaps = () => {
    const q = encodeURIComponent(current.adresse);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${q}`, '_blank');
  };

  return (
    <section className="bg-gradient-to-br from-blue-900/90 to-indigo-900/90 border border-blue-700/60 rounded-2xl p-4 space-y-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Navigation className="w-5 h-5 text-blue-300" />
          <span className="font-bold text-white text-base">Tour-Stop Navigator</span>
          <span className="text-xs bg-blue-500/40 text-blue-200 px-2 py-0.5 rounded-full">
            {remaining} Stop{remaining !== 1 ? 'ps' : ''} übrig
          </span>
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-blue-400" />
          : <ChevronDown className="w-4 h-4 text-blue-400" />}
      </button>

      {open && (
        <>
          {/* Current stop */}
          <div className="rounded-xl bg-white/10 border border-white/20 p-3 space-y-2">
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                {currentIdx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-blue-300 uppercase tracking-wide mb-0.5">
                  Aktueller Stopp
                </div>
                <div className="text-sm font-bold text-white leading-tight">{current.adresse}</div>
                <div className="text-xs text-blue-200 mt-0.5">
                  {current.kundeName} · {current.bestellNr} · {current.anzahlArtikel} Artikel
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={openMaps}
                className="flex-1 py-2 bg-blue-500 hover:bg-blue-400 active:bg-blue-600 text-white text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <MapPin className="w-4 h-4" />
                Navigation starten
              </button>
              <a
                href={`tel:${current.kundeName}`}
                className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors"
                aria-label="Anrufen"
              >
                <Phone className="w-4 h-4 text-blue-300" />
              </a>
            </div>
          </div>

          {/* Next stops preview */}
          {data.stops.slice(currentIdx + 1, currentIdx + 3).map((stop, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg bg-white/5 border border-white/10 px-3 py-2">
              <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold text-gray-300 shrink-0">
                {currentIdx + i + 2}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-gray-300 truncate">{stop.adresse}</div>
                <div className="text-[10px] text-gray-500">{stop.kundeName}</div>
              </div>
              <Package className="w-3.5 h-3.5 text-gray-500 shrink-0" />
            </div>
          ))}

          {/* Navigation through stops */}
          {data.stops.length > 1 && (
            <div className="flex items-center justify-between pt-1">
              <button
                onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                disabled={currentIdx === 0}
                className="text-xs text-blue-400 disabled:opacity-30 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                ← Zurück
              </button>
              <span className="text-xs text-blue-400">
                {currentIdx + 1} / {data.stops.length}
              </span>
              <button
                onClick={() => setCurrentIdx((i) => Math.min(data.stops.length - 1, i + 1))}
                disabled={!hasNext}
                className="text-xs text-blue-400 disabled:opacity-30 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                Weiter →
              </button>
            </div>
          )}

          {data.estimated_min !== null && (
            <p className="text-[10px] text-blue-500 text-center">
              Geschätzte Tour-Zeit: ~{data.estimated_min} Min
              {data.distance_km !== null ? ` · ${data.distance_km.toFixed(1)} km` : ''}
            </p>
          )}
        </>
      )}
    </section>
  );
}
