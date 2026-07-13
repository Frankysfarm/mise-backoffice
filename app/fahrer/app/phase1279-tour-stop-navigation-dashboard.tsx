'use client';

// Phase 1279 — Tour-Stop Navigation Dashboard (Fahrer-App)
// Vollständige Tour-Übersicht: alle Stopps, aktueller Stopp hervorgehoben,
// GPS Deep-Links (Google/Apple/Waze), Ankunfts-/Liefer-Bestätigung, ETA-Countdown
// Props: stops · batchStartedAt · totalEtaMin · onMarkArrived · onMarkDelivered

import { useEffect, useState } from 'react';
import { MapPin, CheckCircle, Navigation, Phone, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type Stop = {
  id: string; batch_id: string; order_id: string; reihenfolge: number;
  angekommen_am: string | null; geliefert_am: string | null;
  distanz_zum_vorgaenger_m?: number | null;
  order: {
    id: string; bestellnummer: string; kunde_name: string; kunde_adresse: string | null;
    kunde_plz: string | null; kunde_lat: number | null; kunde_lng: number | null;
    gesamtbetrag: number; kunde_notiz?: string | null; kunde_lieferhinweis?: string | null;
    kunde_telefon?: string | null;
  };
};

interface Props {
  stops: Stop[];
  batchStartedAt: string | null;
  totalEtaMin?: number | null;
  onMarkArrived?: (stopId: string) => Promise<void>;
  onMarkDelivered?: (stopId: string) => Promise<void>;
}

type StopState = 'done' | 'current' | 'upcoming';

function getStopState(stop: Stop, stops: Stop[]): StopState {
  if (stop.geliefert_am) return 'done';
  const currentIdx = stops.findIndex(s => !s.geliefert_am);
  if (stops[currentIdx]?.id === stop.id) return 'current';
  return 'upcoming';
}

function buildNavUrls(lat: number | null, lng: number | null, address: string | null) {
  if (!lat || !lng) {
    const q = encodeURIComponent(address ?? '');
    return {
      google: `https://www.google.com/maps/search/?api=1&query=${q}`,
      apple: `http://maps.apple.com/?q=${q}`,
      waze: `https://waze.com/ul?q=${q}`,
    };
  }
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`,
    apple: `http://maps.apple.com/?ll=${lat},${lng}&q=Lieferadresse`,
    waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
  };
}

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function fmtDistanz(m: number | null | undefined): string {
  if (!m) return '';
  if (m < 1000) return `${m} m`;
  return `${(m / 1000).toFixed(1)} km`;
}

function fmtRemainMin(startedAt: string | null, totalEtaMin: number | null | undefined): string {
  if (!startedAt || !totalEtaMin) return '—';
  const endMs = new Date(startedAt).getTime() + totalEtaMin * 60_000;
  const remain = Math.floor((endMs - Date.now()) / 60_000);
  if (remain < 0) return `+${Math.abs(remain)} Min`;
  return `${remain} Min`;
}

export function FahrerPhase1279TourStopNavigationDashboard({
  stops, batchStartedAt, totalEtaMin, onMarkArrived, onMarkDelivered,
}: Props) {
  const [, setTick] = useState(0);
  const [expandedStop, setExpandedStop] = useState<string | null>(null);
  const [pendingStop, setPendingStop] = useState<string | null>(null);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Auto-expand current stop
  useEffect(() => {
    const current = stops.find(s => !s.geliefert_am);
    if (current) setExpandedStop(current.id);
  }, [stops]);

  if (!stops || stops.length === 0) return null;

  const doneCount = stops.filter(s => s.geliefert_am != null).length;
  const totalCount = stops.length;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const remainStr = fmtRemainMin(batchStartedAt, totalEtaMin);

  async function handleAction(stopId: string, action: 'arrived' | 'delivered') {
    setPendingStop(stopId);
    try {
      if (action === 'arrived' && onMarkArrived) await onMarkArrived(stopId);
      if (action === 'delivered' && onMarkDelivered) await onMarkDelivered(stopId);
    } finally {
      setPendingStop(null);
    }
  }

  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 backdrop-blur overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/10">
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-matcha-300" />
          <span className="text-sm font-bold text-white">Tour-Navigation</span>
          <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold text-white">
            {doneCount}/{totalCount} Stopps
          </span>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-white/70">
          <Clock className="h-3 w-3" />
          <span>{remainStr}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pt-2 pb-1">
        <div className="flex items-center justify-between text-[10px] text-white/60 mb-1">
          <span>Fortschritt</span>
          <span className="font-bold text-white">{progressPct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full rounded-full bg-matcha-400 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Stops list */}
      <div className="divide-y divide-white/10 pb-2">
        {stops.map(stop => {
          const state = getStopState(stop, stops);
          const isExpanded = expandedStop === stop.id;
          const nav = buildNavUrls(stop.order.kunde_lat, stop.order.kunde_lng, stop.order.kunde_adresse);
          const isPending = pendingStop === stop.id;

          return (
            <div key={stop.id}>
              {/* Stop header - always visible */}
              <button
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-3 text-left transition-all',
                  state === 'current' ? 'bg-white/15' : 'hover:bg-white/10',
                )}
                onClick={() => setExpandedStop(isExpanded ? null : stop.id)}
              >
                {/* Stop number indicator */}
                <div className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black',
                  state === 'done' ? 'bg-matcha-500 text-white' :
                  state === 'current' ? 'bg-white text-matcha-700 shadow-lg' :
                  'bg-white/20 text-white/60',
                )}>
                  {state === 'done' ? '✓' : stop.reihenfolge}
                </div>

                {/* Customer info */}
                <div className="flex-1 min-w-0">
                  <div className={cn(
                    'text-sm font-bold leading-tight truncate',
                    state === 'done' ? 'text-white/50 line-through' :
                    state === 'current' ? 'text-white' : 'text-white/70',
                  )}>
                    {stop.order.kunde_name}
                  </div>
                  <div className="text-[10px] text-white/50 truncate mt-0.5">
                    {stop.order.kunde_adresse ?? stop.order.kunde_plz ?? '—'}
                  </div>
                </div>

                {/* Amount + expand */}
                <div className="flex items-center gap-2 shrink-0">
                  <span className={cn(
                    'text-[11px] font-bold',
                    state === 'done' ? 'text-white/40' : 'text-white/80',
                  )}>
                    {fmtEur(stop.order.gesamtbetrag)}
                  </span>
                  {state === 'current' && (
                    <span className="animate-pulse h-2 w-2 rounded-full bg-amber-400" />
                  )}
                  {isExpanded
                    ? <ChevronUp className="h-3.5 w-3.5 text-white/40" />
                    : <ChevronDown className="h-3.5 w-3.5 text-white/40" />
                  }
                </div>
              </button>

              {/* Expanded stop details */}
              {isExpanded && state !== 'done' && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Address + distance */}
                  {stop.order.kunde_adresse && (
                    <div className="rounded-xl bg-white/10 px-3 py-2">
                      <div className="text-[9px] font-bold uppercase tracking-wide text-white/50 mb-1">Adresse</div>
                      <div className="text-sm font-semibold text-white">{stop.order.kunde_adresse}</div>
                      {stop.order.kunde_plz && (
                        <div className="text-[11px] text-white/60">{stop.order.kunde_plz}</div>
                      )}
                      {stop.distanz_zum_vorgaenger_m && (
                        <div className="text-[10px] text-amber-300 mt-1">
                          ~ {fmtDistanz(stop.distanz_zum_vorgaenger_m)} vom letzten Stopp
                        </div>
                      )}
                    </div>
                  )}

                  {/* Notes */}
                  {(stop.order.kunde_notiz || stop.order.kunde_lieferhinweis) && (
                    <div className="rounded-xl bg-amber-500/20 border border-amber-400/30 px-3 py-2">
                      <div className="text-[9px] font-bold uppercase tracking-wide text-amber-300 mb-1">Hinweise</div>
                      {stop.order.kunde_notiz && (
                        <div className="text-xs text-amber-100">{stop.order.kunde_notiz}</div>
                      )}
                      {stop.order.kunde_lieferhinweis && (
                        <div className="text-xs text-amber-200 mt-0.5">{stop.order.kunde_lieferhinweis}</div>
                      )}
                    </div>
                  )}

                  {/* Navigation buttons */}
                  <div className="grid grid-cols-3 gap-2">
                    <a
                      href={nav.google}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1 rounded-xl bg-blue-500/80 py-2.5 text-white transition hover:bg-blue-500"
                    >
                      <Navigation className="h-4 w-4" />
                      <span className="text-[10px] font-bold">Google</span>
                    </a>
                    <a
                      href={nav.waze}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1 rounded-xl bg-indigo-500/80 py-2.5 text-white transition hover:bg-indigo-500"
                    >
                      <Navigation className="h-4 w-4" />
                      <span className="text-[10px] font-bold">Waze</span>
                    </a>
                    <a
                      href={nav.apple}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex flex-col items-center gap-1 rounded-xl bg-slate-500/80 py-2.5 text-white transition hover:bg-slate-500"
                    >
                      <Navigation className="h-4 w-4" />
                      <span className="text-[10px] font-bold">Apple</span>
                    </a>
                  </div>

                  {/* Phone */}
                  {stop.order.kunde_telefon && (
                    <a
                      href={`tel:${stop.order.kunde_telefon}`}
                      className="flex items-center justify-center gap-2 rounded-xl bg-white/10 py-2.5 text-white transition hover:bg-white/20"
                    >
                      <Phone className="h-4 w-4" />
                      <span className="text-sm font-semibold">{stop.order.kunde_telefon}</span>
                    </a>
                  )}

                  {/* Action buttons */}
                  {state === 'current' && (
                    <div className="grid grid-cols-2 gap-2">
                      {!stop.angekommen_am && onMarkArrived && (
                        <button
                          onClick={() => handleAction(stop.id, 'arrived')}
                          disabled={isPending}
                          className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 py-3 text-sm font-bold text-white transition hover:bg-amber-400 disabled:opacity-50"
                        >
                          <MapPin className="h-4 w-4" />
                          Angekommen
                        </button>
                      )}
                      {onMarkDelivered && (
                        <button
                          onClick={() => handleAction(stop.id, 'delivered')}
                          disabled={isPending}
                          className={cn(
                            'flex items-center justify-center gap-1.5 rounded-xl py-3 text-sm font-bold text-white transition disabled:opacity-50',
                            stop.angekommen_am ? 'bg-matcha-500 hover:bg-matcha-400 col-span-2' : 'bg-matcha-600 hover:bg-matcha-500',
                          )}
                        >
                          <CheckCircle className="h-4 w-4" />
                          Geliefert
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
    </div>
  );
}
