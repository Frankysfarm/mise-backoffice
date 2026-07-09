'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, Phone, CheckCircle2, Package, AlertCircle, ChevronDown, ChevronUp, Clock, Zap } from 'lucide-react';

interface Stop {
  id: string;
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
    zahlungsart?: string;
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
  onStopComplete?: (stopId: string) => void;
}

function openNavApp(lat: number | null, lng: number | null, address: string | null) {
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const isIOS = /iPhone|iPad|iPod/.test(userAgent);
  if (lat && lng) {
    const url = isIOS
      ? `maps://?daddr=${lat},${lng}`
      : `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, '_blank');
  } else if (address) {
    const encoded = encodeURIComponent(address);
    window.open(`https://www.google.com/maps/search/${encoded}`, '_blank');
  }
}

function formatDist(m: number | null | undefined): string {
  if (m == null) return '';
  if (m < 1000) return `${Math.round(m)} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

export function FahrerPhase935TourLiveKommando({ activeBatch, onStopComplete }: Props) {
  const [expandedStop, setExpandedStop] = useState<string | null>(null);

  if (!activeBatch || activeBatch.stops.length === 0) return null;

  const stops = [...activeBatch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const completed = stops.filter(s => s.geliefert_am).length;
  const pending = stops.filter(s => !s.geliefert_am);
  const currentStop = pending[0] ?? null;
  const progressPct = Math.round((completed / stops.length) * 100);

  const elapsedMin = activeBatch.started_at
    ? Math.floor((Date.now() - new Date(activeBatch.started_at).getTime()) / 60_000)
    : 0;

  return (
    <div className="rounded-2xl bg-stone-900 text-white overflow-hidden shadow-lg">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-bold">Tour-Live-Kommando</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-stone-400">
            <Clock className="w-3 h-3" />
            <span>{elapsedMin} Min aktiv</span>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-matcha-500 transition-all duration-700"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-xs font-black tabular-nums text-white">
            {completed}/{stops.length}
          </span>
          <span className="text-xs text-stone-400">Stopps</span>
        </div>
      </div>

      {/* Current stop highlight */}
      {currentStop && (
        <div className="px-4 py-3 bg-matcha-900/50 border-b border-white/10">
          <div className="text-[10px] font-bold text-matcha-400 uppercase tracking-wider mb-1.5">
            Aktueller Stopp
          </div>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-matcha-500 flex items-center justify-center text-white text-xs font-black shrink-0">
              {currentStop.reihenfolge}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-white truncate">{currentStop.order.kunde_name}</div>
              <div className="text-xs text-stone-400 truncate">{currentStop.order.kunde_adresse}</div>
              <div className="flex items-center gap-2 mt-1">
                {currentStop.order.zahlungsart && (
                  <span className="text-[10px] bg-white/10 rounded px-1.5 py-0.5">
                    {currentStop.order.zahlungsart === 'bar' ? '💵 Bar' : '💳 Karte'}
                  </span>
                )}
                <span className="text-[10px] text-stone-400">
                  #{currentStop.order.bestellnummer}
                </span>
                {currentStop.distanz_zum_vorgaenger_m && (
                  <span className="text-[10px] text-stone-400">
                    {formatDist(currentStop.distanz_zum_vorgaenger_m)}
                  </span>
                )}
              </div>
              {currentStop.order.kunde_notiz && (
                <div className="mt-1 text-[10px] text-amber-300 flex items-center gap-1">
                  <AlertCircle className="w-2.5 h-2.5 shrink-0" />
                  <span className="truncate">{currentStop.order.kunde_notiz}</span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="grid grid-cols-3 gap-2 mt-3">
            <button
              onClick={() => openNavApp(currentStop.order.kunde_lat, currentStop.order.kunde_lng, currentStop.order.kunde_adresse)}
              className="flex flex-col items-center gap-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 transition-colors text-white"
            >
              <Navigation className="w-4 h-4" />
              <span className="text-[10px] font-bold">Navigieren</span>
            </button>
            {currentStop.order.kunde_telefon && (
              <button
                onClick={() => { window.location.href = `tel:${currentStop.order.kunde_telefon}`; }}
                className="flex flex-col items-center gap-1 py-2 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-white"
              >
                <Phone className="w-4 h-4" />
                <span className="text-[10px] font-bold">Anrufen</span>
              </button>
            )}
            <button
              onClick={() => onStopComplete && onStopComplete(currentStop.id)}
              className="flex flex-col items-center gap-1 py-2 rounded-xl bg-matcha-600 hover:bg-matcha-500 transition-colors text-white col-span-currentStop.order.kunde_telefon ? 1 : 2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-[10px] font-bold">Geliefert</span>
            </button>
          </div>
        </div>
      )}

      {/* All stops list */}
      <div className="divide-y divide-white/5">
        {stops.map((stop) => {
          const isDone = !!stop.geliefert_am;
          const isCurrent = !isDone && stop === currentStop;
          const isPending = !isDone && !isCurrent;
          const isExpanded = expandedStop === stop.id;

          return (
            <div key={stop.id} className={cn(
              'transition-colors',
              isDone ? 'opacity-50' : '',
              isCurrent ? '' : '',
            )}>
              <button
                className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
                onClick={() => setExpandedStop(isExpanded ? null : stop.id)}
              >
                {/* Stop number */}
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shrink-0',
                  isDone ? 'bg-matcha-500 text-white' :
                  isCurrent ? 'bg-blue-500 text-white' :
                  'bg-white/10 text-stone-400'
                )}>
                  {isDone ? '✓' : stop.reihenfolge}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className={cn('text-xs font-semibold truncate', isDone ? 'text-stone-500' : 'text-white')}>
                    {stop.order.kunde_name}
                  </div>
                  <div className="text-[10px] text-stone-500 truncate">
                    {stop.order.kunde_adresse}
                  </div>
                </div>

                {/* Status / Amount */}
                <div className="shrink-0 text-right">
                  {isDone ? (
                    <CheckCircle2 className="w-4 h-4 text-matcha-500" />
                  ) : (
                    <>
                      <div className="text-[11px] font-bold text-stone-300 tabular-nums">
                        {stop.order.gesamtbetrag.toFixed(2)} €
                      </div>
                      {stop.distanz_zum_vorgaenger_m && (
                        <div className="text-[9px] text-stone-500">
                          {formatDist(stop.distanz_zum_vorgaenger_m)}
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="shrink-0">
                  {isExpanded ? (
                    <ChevronUp className="w-3 h-3 text-stone-500" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-stone-500" />
                  )}
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="px-4 pb-3 space-y-2">
                  {stop.order.kunde_lieferhinweis && (
                    <div className="text-[10px] text-amber-300 bg-amber-900/30 rounded-lg p-2 flex items-start gap-1.5">
                      <AlertCircle className="w-3 h-3 shrink-0 mt-0.5" />
                      <span>{stop.order.kunde_lieferhinweis}</span>
                    </div>
                  )}
                  {stop.order.kunde_notiz && (
                    <div className="text-[10px] text-stone-400 bg-white/5 rounded-lg p-2">
                      📝 {stop.order.kunde_notiz}
                    </div>
                  )}
                  {!isDone && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => openNavApp(stop.order.kunde_lat, stop.order.kunde_lng, stop.order.kunde_adresse)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold"
                      >
                        <Navigation className="w-3 h-3" /> Navi
                      </button>
                      {stop.order.kunde_telefon && (
                        <button
                          onClick={() => { window.location.href = `tel:${stop.order.kunde_telefon}`; }}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-semibold"
                        >
                          <Phone className="w-3 h-3" /> Anrufen
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      {completed === stops.length && stops.length > 0 && (
        <div className="px-4 py-3 bg-matcha-900/50 text-center">
          <div className="flex items-center justify-center gap-2 text-matcha-400 font-bold">
            <CheckCircle2 className="w-4 h-4" />
            <span>Alle Stopps abgeschlossen!</span>
          </div>
        </div>
      )}
    </div>
  );
}
