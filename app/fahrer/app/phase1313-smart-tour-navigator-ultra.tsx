'use client';

// Phase 1313 — Smart-Tour-Navigator-Ultra (Fahrer-App)
// Mobil-optimierter Tour-Stopp-Navigator mit Echtzeit-ETA + Navigations-CTA
// Aktueller Stopp (groß) + Nächster Stopp (klein) + Fortschrittsbalken + Quick-Actions + Tour-Übersicht-Toggle

import { useState } from 'react';
import { MapPin, Navigation, CheckCircle2, Clock, ChevronRight, List, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TourStop {
  id: string;
  order_id: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
  status: 'pending' | 'arrived' | 'done';
  sequence: number;
  customer_name?: string | null;
  eta_min?: number | null;
}

interface Props {
  stops: TourStop[];
  currentStopIndex: number;
  driverPos?: { lat: number; lng: number } | null;
}

function buildMapsUrl(stop: TourStop, driverPos?: { lat: number; lng: number } | null): string {
  const dest = stop.lat && stop.lng
    ? `${stop.lat},${stop.lng}`
    : encodeURIComponent(stop.address);
  const origin = driverPos ? `&origin=${driverPos.lat},${driverPos.lng}` : '';
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}${origin}`;
}

function formatEta(etaMin: number | null | undefined): string | null {
  if (etaMin == null) return null;
  if (etaMin <= 0) return 'Jetzt';
  if (etaMin < 60) return `${etaMin} Min`;
  const h = Math.floor(etaMin / 60);
  const m = etaMin % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function FahrerPhase1313SmartTourNavigatorUltra({ stops, currentStopIndex, driverPos }: Props) {
  const [showOverview, setShowOverview] = useState(false);

  if (!stops || stops.length === 0) return null;

  const idx = currentStopIndex < 0 ? 0 : Math.min(currentStopIndex, stops.length - 1);
  const current = stops[idx] ?? null;
  const next = idx + 1 < stops.length ? stops[idx + 1] : null;

  const doneCount = stops.filter((s) => s.status === 'done').length;
  const totalCount = stops.length;
  const progressPct = Math.round((doneCount / Math.max(1, totalCount)) * 100);

  const etaLabel = current ? formatEta(current.eta_min) : null;

  return (
    <div className="rounded-2xl bg-zinc-900 border border-zinc-700 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-green-400" />
          <span className="text-sm font-bold text-white tracking-wide">Smart-Tour-Navigator</span>
        </div>
        <button
          onClick={() => setShowOverview((v) => !v)}
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors min-h-[44px] px-2"
          aria-label={showOverview ? 'Übersicht schließen' : 'Alle Stopps anzeigen'}
        >
          {showOverview ? (
            <>
              <X className="h-3.5 w-3.5" />
              <span>Schließen</span>
            </>
          ) : (
            <>
              <List className="h-3.5 w-3.5" />
              <span>Alle Stopps</span>
            </>
          )}
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-zinc-400">Fortschritt</span>
          <span className="text-xs font-bold text-white tabular-nums">
            {doneCount} von {totalCount} Stopps
          </span>
        </div>
        <div className="relative h-2.5 rounded-full bg-zinc-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Tour overview (toggle) */}
      {showOverview && (
        <div className="mx-4 mb-3 rounded-xl bg-zinc-800 border border-zinc-700 divide-y divide-zinc-700 overflow-hidden">
          {stops.map((stop, i) => (
            <div
              key={stop.id}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5',
                i === idx && 'bg-green-900/30',
              )}
            >
              <div className={cn(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                stop.status === 'done'
                  ? 'bg-green-500/20 text-green-400'
                  : i === idx
                  ? 'bg-green-500 text-white'
                  : 'bg-zinc-700 text-zinc-400',
              )}>
                {stop.status === 'done' ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <span>{stop.sequence}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                {stop.customer_name && (
                  <div className="text-xs font-semibold text-white truncate">{stop.customer_name}</div>
                )}
                <div className="text-xs text-zinc-400 truncate">{stop.address}</div>
              </div>
              {stop.eta_min != null && stop.status !== 'done' && (
                <div className="text-xs text-zinc-500 tabular-nums shrink-0">{formatEta(stop.eta_min)}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Current stop card */}
      {current && (
        <div className="mx-4 mb-3 rounded-2xl bg-zinc-800 border border-green-700/50 p-4">
          <div className="flex items-start justify-between gap-2 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <MapPin className="h-3.5 w-3.5 text-green-400 shrink-0" />
                <span className="text-[11px] font-semibold text-green-400 uppercase tracking-wider">
                  Aktueller Stopp
                </span>
                {current.status === 'arrived' && (
                  <span className="ml-1 text-[10px] bg-amber-500/20 text-amber-300 rounded-full px-1.5 py-0.5 font-medium">
                    Angekommen
                  </span>
                )}
              </div>
              {current.customer_name && (
                <div className="text-base font-bold text-white leading-tight mb-0.5">
                  {current.customer_name}
                </div>
              )}
              <div className="text-sm text-zinc-300 leading-snug">{current.address}</div>
            </div>
            {etaLabel && (
              <div className="flex items-center gap-1 shrink-0 bg-zinc-700/60 rounded-xl px-2.5 py-1.5">
                <Clock className="h-3 w-3 text-zinc-400" />
                <span className="text-xs font-bold text-white tabular-nums">{etaLabel}</span>
              </div>
            )}
          </div>

          {/* Navigate button */}
          <a
            href={buildMapsUrl(current, driverPos)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full min-h-[48px] rounded-xl bg-green-500 hover:bg-green-400 active:bg-green-600 text-white font-bold text-sm transition-colors"
          >
            <Navigation className="h-4 w-4" />
            Jetzt Navigieren
          </a>

          {/* Quick action buttons */}
          <div className="flex gap-2 mt-2">
            <button
              className="flex-1 min-h-[44px] rounded-xl border border-zinc-600 bg-zinc-700/50 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
              type="button"
            >
              <MapPin className="h-3.5 w-3.5 text-amber-400" />
              Angekommen
            </button>
            <button
              className="flex-1 min-h-[44px] rounded-xl border border-zinc-600 bg-zinc-700/50 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold transition-colors flex items-center justify-center gap-1.5"
              type="button"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
              Abgeschlossen
            </button>
          </div>
        </div>
      )}

      {/* Next stop preview */}
      {next && (
        <div className="mx-4 mb-4 rounded-xl bg-zinc-800/60 border border-zinc-700 px-3 py-2.5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-0.5">
              Nächster Stopp
            </div>
            {next.customer_name && (
              <div className="text-xs font-bold text-zinc-300 truncate">{next.customer_name}</div>
            )}
            <div className="text-xs text-zinc-500 truncate">{next.address}</div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {next.eta_min != null && (
              <span className="text-xs text-zinc-500 tabular-nums">{formatEta(next.eta_min)}</span>
            )}
            <ChevronRight className="h-4 w-4 text-zinc-600" />
          </div>
        </div>
      )}
    </div>
  );
}
