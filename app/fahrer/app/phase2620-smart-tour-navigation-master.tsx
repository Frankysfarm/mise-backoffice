'use client';

/**
 * Phase 2620 — Smart Tour Navigation Master
 *
 * Zeigt Tour-Stopps als navigierbare Liste mit GPS-Links (Google Maps / Waze),
 * Countdown-Anzeige je Stopp, Lieferbestätigung-Button und Schicht-KPI-Zusammenfassung.
 * Mobile-first, Matcha-Theme.
 */

import { useState } from 'react';
import { CheckCircle2, Clock, MapPin, Navigation, Phone, Route as RouteIcon, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface TourStop {
  id: string;
  sequence: number;
  order_id: string;
  bestellnummer: string;
  kunde_name: string | null;
  adresse: string | null;
  plz: string | null;
  lat: number | null;
  lng: number | null;
  telefon: string | null;
  betrag: number;
  bezahlt: boolean;
  zahlungsart: string | null;
  eta_min: number | null;
  geliefert_am: string | null;
  notiz: string | null;
}

interface Props {
  stops: TourStop[];
  currentStopId: string | null;
  onDeliverStop?: (stopId: string) => Promise<void>;
  driverName?: string;
  totalEarnedToday?: number;
  completedCount?: number;
}

function mapsLink(lat: number | null, lng: number | null, adresse: string | null): string {
  if (lat && lng) return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  if (adresse) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`;
  return '#';
}

function wazeLink(lat: number | null, lng: number | null): string {
  if (lat && lng) return `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`;
  return '#';
}

export function FahrerPhase2620SmartTourNavigationMaster({
  stops,
  currentStopId,
  onDeliverStop,
  driverName,
  totalEarnedToday = 0,
  completedCount = 0,
}: Props) {
  const [delivering, setDelivering] = useState<string | null>(null);
  const [localDone, setLocalDone] = useState<Set<string>>(new Set());

  const allStops = stops.slice().sort((a, b) => a.sequence - b.sequence);
  const done = allStops.filter(s => s.geliefert_am || localDone.has(s.id));
  const pending = allStops.filter(s => !s.geliefert_am && !localDone.has(s.id));
  const activeStop = pending.find(s => s.id === currentStopId) ?? pending[0] ?? null;
  const progressPct = allStops.length > 0 ? Math.round((done.length / allStops.length) * 100) : 0;

  async function handleDeliver(stopId: string) {
    setDelivering(stopId);
    try {
      if (onDeliverStop) await onDeliverStop(stopId);
      setLocalDone(prev => new Set([...prev, stopId]));
    } catch { /* ignore */ }
    setDelivering(null);
  }

  if (allStops.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-3">
        <div className="flex items-center gap-2 mb-2">
          <RouteIcon className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="font-display text-sm font-bold">Smart Tour Navigator</span>
          {driverName && <span className="text-xs text-muted-foreground ml-1">· {driverName}</span>}
        </div>

        {/* Fortschrittsbalken */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{done.length} von {allStops.length} Stopps</span>
            <span className="font-bold text-matcha-600">{progressPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-matcha-500 rounded-full transition-all duration-700" style={{ width: `${progressPct}%` }} />
          </div>
        </div>

        <div className="mt-2 flex items-center gap-3 text-xs">
          {totalEarnedToday > 0 && (
            <span className="text-matcha-700 font-semibold">€{totalEarnedToday.toFixed(2)} heute</span>
          )}
          {pending.length > 0 && activeStop?.eta_min && (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" /> Nächster Stopp ~{activeStop.eta_min} Min
            </span>
          )}
        </div>
      </div>

      {/* Aktiver Stopp hervorgehoben */}
      {activeStop && (
        <div className="rounded-xl border-2 border-matcha-400 bg-matcha-50 dark:bg-matcha-950/20 shadow-md p-3">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-4 w-4 text-matcha-600" />
            <span className="text-xs font-bold text-matcha-700 uppercase tracking-wide">Jetzt anfahren</span>
            <span className="ml-auto text-xs font-bold text-matcha-700">Stopp {activeStop.sequence}</span>
          </div>
          <div className="font-semibold text-sm mb-0.5">{activeStop.kunde_name ?? `Stopp ${activeStop.sequence}`}</div>
          {activeStop.adresse && (
            <div className="flex items-start gap-1 text-xs text-muted-foreground mb-2">
              <MapPin className="h-3 w-3 mt-0.5 shrink-0" /> {activeStop.adresse}{activeStop.plz ? `, ${activeStop.plz}` : ''}
            </div>
          )}
          {activeStop.notiz && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-2 py-1 text-[10px] text-amber-700 mb-2">
              📝 {activeStop.notiz}
            </div>
          )}
          <div className="flex items-center gap-1.5 text-xs mb-2">
            <span className={cn('font-bold', activeStop.bezahlt ? 'text-matcha-700' : 'text-amber-700')}>
              €{activeStop.betrag.toFixed(2)}
            </span>
            <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-bold', activeStop.bezahlt ? 'bg-matcha-100 text-matcha-700' : 'bg-amber-100 text-amber-700')}>
              {activeStop.bezahlt ? 'bezahlt' : `Bar · ${activeStop.zahlungsart ?? 'cash'}`}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <a href={mapsLink(activeStop.lat, activeStop.lng, activeStop.adresse)} target="_blank" rel="noreferrer"
              className="flex flex-col items-center gap-1 rounded-lg bg-blue-600 px-2 py-2 text-white text-[10px] font-bold active:scale-95 transition">
              <Navigation className="h-4 w-4" /> Maps
            </a>
            <a href={wazeLink(activeStop.lat, activeStop.lng)} target="_blank" rel="noreferrer"
              className="flex flex-col items-center gap-1 rounded-lg bg-cyan-500 px-2 py-2 text-white text-[10px] font-bold active:scale-95 transition">
              <Navigation className="h-4 w-4" /> Waze
            </a>
            {activeStop.telefon && (
              <a href={`tel:${activeStop.telefon}`}
                className="flex flex-col items-center gap-1 rounded-lg bg-stone-600 px-2 py-2 text-white text-[10px] font-bold active:scale-95 transition">
                <Phone className="h-4 w-4" /> Anrufen
              </a>
            )}
          </div>
          <button
            onClick={() => handleDeliver(activeStop.id)}
            disabled={!!delivering}
            className="mt-2 w-full flex items-center justify-center gap-2 rounded-xl bg-matcha-600 text-white font-bold py-3 text-sm active:scale-[0.98] transition disabled:opacity-60"
          >
            {delivering === activeStop.id ? (
              <span className="animate-spin">⟳</span>
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            Zugestellt bestätigen
          </button>
        </div>
      )}

      {/* Nächste Stopps */}
      {pending.length > 1 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground px-1">Nächste Stopps</div>
          {pending.slice(1, 4).map(stop => (
            <div key={stop.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
              <span className="h-6 w-6 rounded-full bg-muted text-[10px] font-bold flex items-center justify-center shrink-0">
                {stop.sequence}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate">{stop.kunde_name ?? `Stopp ${stop.sequence}`}</div>
                {stop.adresse && <div className="text-[9px] text-muted-foreground truncate">{stop.adresse}</div>}
              </div>
              {stop.eta_min && <span className="text-[9px] text-muted-foreground shrink-0">~{stop.eta_min} Min</span>}
              <span className="text-[9px] font-bold text-matcha-600 shrink-0">€{stop.betrag.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Erledigte Stopps */}
      {done.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground px-1">Erledigt ({done.length})</div>
          {done.map(stop => (
            <div key={stop.id} className="flex items-center gap-2 rounded-lg bg-matcha-50/50 dark:bg-matcha-950/10 border border-matcha-200/50 px-3 py-1.5 opacity-70">
              <CheckCircle2 className="h-3.5 w-3.5 text-matcha-500 shrink-0" />
              <span className="text-xs text-muted-foreground truncate">{stop.kunde_name ?? `Stopp ${stop.sequence}`}</span>
              <span className="ml-auto text-[9px] font-bold text-matcha-600">€{stop.betrag.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
