'use client';

import { MapPin, Phone, Navigation, ChevronRight, Package, AlertCircle } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

type Stop = {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  order: {
    id: string;
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_plz: string | null;
    kunde_lat: number | null;
    kunde_lng: number | null;
    gesamtbetrag: number;
    kunde_notiz?: string | null;
    kunde_lieferhinweis?: string | null;
    kunde_telefon?: string | null;
  };
};

type ActiveBatch = {
  id: string;
  status: string;
  started_at: string | null;
  total_eta_min?: number | null;
  stops: Stop[];
};

function buildNavUrls(lat: number | null, lng: number | null, address: string | null, plz: string | null) {
  const addr = [address, plz].filter(Boolean).join(' ');
  if (lat !== null && lng !== null) {
    return {
      google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
      waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
      apple: `maps://maps.apple.com/?daddr=${lat},${lng}`,
    };
  }
  if (addr) {
    const enc = encodeURIComponent(addr);
    return {
      google: `https://www.google.com/maps/dir/?api=1&destination=${enc}`,
      waze: `https://waze.com/ul?q=${enc}&navigate=yes`,
      apple: `maps://maps.apple.com/?daddr=${enc}`,
    };
  }
  return null;
}

export function FahrerStopAktionsPanel({
  activeBatch,
  driverLat,
  driverLng,
}: {
  activeBatch: ActiveBatch;
  driverLat?: number | null;
  driverLng?: number | null;
}) {
  const sortedStops = [...activeBatch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const currentStop = sortedStops.find((s) => !s.geliefert_am);
  const nextStop = currentStop
    ? sortedStops.find((s) => !s.geliefert_am && s.id !== currentStop.id)
    : null;

  if (!currentStop) return null;

  const o = currentStop.order;
  const completedCount = sortedStops.filter((s) => !!s.geliefert_am).length;
  const totalCount = sortedStops.length;
  const navUrls = buildNavUrls(o.kunde_lat, o.kunde_lng, o.kunde_adresse, o.kunde_plz);

  return (
    <div className="space-y-3">
      {/* Current stop card */}
      <div className="rounded-2xl bg-gray-800/80 border border-gray-700 overflow-hidden">
        {/* Stop header */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-matcha-900/60 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-matcha-400 shrink-0" />
            <span className="text-[11px] font-black uppercase tracking-widest text-matcha-300">
              Stopp {completedCount + 1} von {totalCount}
            </span>
          </div>
          <div className="text-xs font-bold text-matcha-400 tabular-nums">
            {euro(o.gesamtbetrag)}
          </div>
        </div>

        {/* Customer info */}
        <div className="px-4 pt-3 pb-2">
          <div className="text-lg font-black text-white leading-tight truncate">{o.kunde_name}</div>
          {o.kunde_adresse && (
            <div className="text-sm text-gray-300 mt-0.5 leading-snug">
              {o.kunde_adresse}
              {o.kunde_plz && <span className="text-gray-400"> · {o.kunde_plz}</span>}
            </div>
          )}
          <div className="text-[10px] text-gray-500 mt-1 font-mono">#{o.bestellnummer}</div>
        </div>

        {/* Customer note */}
        {(o.kunde_notiz || o.kunde_lieferhinweis) && (
          <div className="mx-4 mb-3 flex items-start gap-2 rounded-xl bg-amber-900/30 border border-amber-700/40 px-3 py-2">
            <AlertCircle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-200 leading-snug">
              {o.kunde_lieferhinweis || o.kunde_notiz}
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        {navUrls && (
          <div className="px-4 pb-3 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1.5">
              Navigation öffnen
            </div>
            <div className="grid grid-cols-3 gap-2">
              <a
                href={navUrls.google}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 rounded-xl bg-blue-600/20 border border-blue-600/30 py-2.5 text-blue-300 hover:bg-blue-600/30 transition active:scale-95"
              >
                <Navigation className="h-5 w-5" />
                <span className="text-[10px] font-bold">Google</span>
              </a>
              <a
                href={navUrls.waze}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center gap-1 rounded-xl bg-cyan-600/20 border border-cyan-600/30 py-2.5 text-cyan-300 hover:bg-cyan-600/30 transition active:scale-95"
              >
                <Navigation className="h-5 w-5" />
                <span className="text-[10px] font-bold">Waze</span>
              </a>
              <a
                href={navUrls.apple}
                className="flex flex-col items-center gap-1 rounded-xl bg-gray-600/20 border border-gray-600/30 py-2.5 text-gray-300 hover:bg-gray-600/30 transition active:scale-95"
              >
                <Navigation className="h-5 w-5" />
                <span className="text-[10px] font-bold">Apple</span>
              </a>
            </div>
          </div>
        )}

        {/* Phone */}
        {o.kunde_telefon && (
          <div className="px-4 pb-3">
            <a
              href={`tel:${o.kunde_telefon}`}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-matcha-700/30 border border-matcha-600/40 text-matcha-300 hover:bg-matcha-700/50 transition active:scale-95"
            >
              <Phone className="h-4 w-4" />
              <span className="text-sm font-bold">{o.kunde_telefon}</span>
            </a>
          </div>
        )}
      </div>

      {/* Next stop preview */}
      {nextStop && (
        <div className="flex items-center gap-3 rounded-xl bg-gray-800/40 border border-gray-700/50 px-4 py-3">
          <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-0.5">
              Nächster Stopp
            </div>
            <div className="text-sm font-bold text-gray-300 truncate">{nextStop.order.kunde_name}</div>
            {nextStop.order.kunde_adresse && (
              <div className="text-xs text-gray-500 truncate">{nextStop.order.kunde_adresse}</div>
            )}
          </div>
          <Package className="h-4 w-4 text-gray-600 shrink-0" />
        </div>
      )}
    </div>
  );
}
