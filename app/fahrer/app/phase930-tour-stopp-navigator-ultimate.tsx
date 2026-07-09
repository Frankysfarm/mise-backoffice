'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, Phone, Clock, CheckCircle2, ChevronRight, Package, AlertCircle } from 'lucide-react';

interface Stop {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  distanz_zum_vorgaenger_m?: number | null;
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
}

interface ActiveBatch {
  id: string;
  status: string;
  started_at: string | null;
  total_eta_min?: number | null;
  total_distance_km?: number | null;
  stops: Stop[];
}

interface Props {
  activeBatch: ActiveBatch | null;
  driverPos?: { lat: number; lng: number } | null;
}

function formatDist(m: number | null | undefined): string {
  if (m == null) return '';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function openMapsNav(lat: number | null, lng: number | null, address: string | null) {
  if (lat && lng) {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const url = isIOS
      ? `maps://?daddr=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  } else if (address) {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
    window.open(url, '_blank');
  }
}

export function FahrerPhase930TourStoppNavigatorUltimate({ activeBatch, driverPos }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  if (!activeBatch) return null;

  const now = Date.now();
  const stops = [...activeBatch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const nextStop = stops.find(s => !s.geliefert_am);
  const completedCount = stops.filter(s => s.geliefert_am).length;
  const totalCount = stops.length;

  const etaMs = activeBatch.started_at && activeBatch.total_eta_min != null
    ? new Date(activeBatch.started_at).getTime() + activeBatch.total_eta_min * 60_000
    : null;
  const etaMinLeft = etaMs ? Math.ceil((etaMs - now) / 60_000) : null;

  if (totalCount === 0) return null;

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-matcha-600 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4" />
            <span className="text-sm font-semibold">Tour-Stops</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span>{completedCount}/{totalCount} erledigt</span>
            {etaMinLeft !== null && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {etaMinLeft <= 0 ? 'Überfällig' : `~${etaMinLeft} Min`}
              </span>
            )}
          </div>
        </div>
        {/* Progress */}
        <div className="mt-2 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className="h-full bg-white rounded-full transition-all duration-500"
            style={{ width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Next stop highlight */}
      {nextStop && (
        <div className="px-4 py-3 bg-saffron/5 border-b border-saffron/20">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-5 h-5 rounded-full bg-saffron text-white text-[10px] font-bold flex items-center justify-center flex-none">
                  {nextStop.reihenfolge}
                </div>
                <span className="text-xs font-semibold text-stone-800 uppercase tracking-wide">Nächster Stop</span>
              </div>
              <div className="text-sm font-semibold text-stone-900 truncate">{nextStop.order.kunde_name}</div>
              {nextStop.order.kunde_adresse && (
                <div className="text-xs text-stone-500 truncate">{nextStop.order.kunde_adresse}{nextStop.order.kunde_plz ? `, ${nextStop.order.kunde_plz}` : ''}</div>
              )}
              {nextStop.distanz_zum_vorgaenger_m != null && (
                <div className="text-xs text-stone-400 mt-0.5">
                  Entfernung: {formatDist(nextStop.distanz_zum_vorgaenger_m)}
                </div>
              )}
              {nextStop.order.kunde_notiz && (
                <div className="flex items-start gap-1 mt-1 text-[10px] text-amber-700 bg-amber-50 rounded px-1.5 py-1">
                  <AlertCircle className="w-3 h-3 flex-none mt-0.5" />
                  <span className="truncate">{nextStop.order.kunde_notiz}</span>
                </div>
              )}
            </div>
            {/* Actions */}
            <div className="flex flex-col gap-1.5 flex-none">
              <button
                onClick={() => openMapsNav(nextStop.order.kunde_lat, nextStop.order.kunde_lng, nextStop.order.kunde_adresse)}
                className="flex items-center gap-1 bg-matcha-600 text-white text-xs px-2.5 py-1.5 rounded-lg font-medium"
              >
                <MapPin className="w-3 h-3" />
                Navi
              </button>
              {nextStop.order.kunde_telefon && (
                <a
                  href={`tel:${nextStop.order.kunde_telefon}`}
                  className="flex items-center gap-1 bg-stone-100 text-stone-700 text-xs px-2.5 py-1.5 rounded-lg font-medium"
                >
                  <Phone className="w-3 h-3" />
                  Anruf
                </a>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2 text-[10px] text-stone-500">
            <Package className="w-3 h-3" />
            <span>Bestellung #{nextStop.order.bestellnummer}</span>
            <span>·</span>
            <span className="font-medium text-matcha-700">{nextStop.order.gesamtbetrag.toFixed(2).replace('.', ',')} €</span>
          </div>
        </div>
      )}

      {/* All stops list */}
      <div className="divide-y divide-stone-100">
        {stops.map(stop => {
          const isDone = !!stop.geliefert_am;
          const isNext = stop === nextStop;
          return (
            <div
              key={stop.id}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5',
                isDone ? 'opacity-50' : isNext ? '' : 'opacity-70'
              )}
            >
              {/* Stop number badge */}
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-none',
                isDone ? 'bg-matcha-100 text-matcha-700' :
                isNext ? 'bg-saffron text-white' :
                'bg-stone-100 text-stone-500'
              )}>
                {isDone ? <CheckCircle2 className="w-3.5 h-3.5 text-matcha-500" /> : stop.reihenfolge}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-stone-800 truncate">{stop.order.kunde_name}</div>
                <div className="text-[10px] text-stone-400 truncate">
                  #{stop.order.bestellnummer} · {stop.order.kunde_adresse ?? 'Keine Adresse'}
                </div>
              </div>

              {/* Distance & done time */}
              <div className="text-[10px] text-stone-400 text-right flex-none">
                {isDone && stop.geliefert_am
                  ? <span className="text-matcha-600 font-medium">Geliefert</span>
                  : stop.distanz_zum_vorgaenger_m != null
                    ? formatDist(stop.distanz_zum_vorgaenger_m)
                    : ''
                }
              </div>

              {/* Nav button for future stops */}
              {!isDone && !isNext && (
                <button
                  onClick={() => openMapsNav(stop.order.kunde_lat, stop.order.kunde_lng, stop.order.kunde_adresse)}
                  className="text-stone-300 hover:text-matcha-600 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Tour complete state */}
      {completedCount === totalCount && totalCount > 0 && (
        <div className="px-4 py-3 bg-matcha-50 border-t border-matcha-100 text-center">
          <div className="flex items-center justify-center gap-2 text-matcha-700 text-sm font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            Tour abgeschlossen! Alle {totalCount} Stops erledigt.
          </div>
        </div>
      )}
    </div>
  );
}
