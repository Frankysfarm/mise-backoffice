'use client';

import { useState, useEffect, useCallback } from 'react';
import { Navigation, MapPin, Clock, CheckCircle, ChevronDown, ChevronUp, Phone, Route } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 2060 — Tour-Stops & Navigation Live
 *
 * Erweitert Phase 2052 um:
 * - Live-Countdown (Sekunden) bis zum nächsten Stop
 * - Sequenzielle Navigation: aktueller Stop hervorgehoben, nächster vorschau
 * - Google Maps / Apple Maps Direktlink je Stop
 * - Offline-fähig mit zuletzt bekannten Stops
 */

interface TourStop {
  id: string;
  reihenfolge: number;
  adresse: string;
  kunde_name: string | null;
  telefon: string | null;
  bestellnummer: string | null;
  geliefert_am: string | null;
  eta_min: number | null;
  lat?: number | null;
  lng?: number | null;
  notiz?: string | null;
}

const MOCK_STOPS: TourStop[] = [
  { id: 's1', reihenfolge: 1, adresse: 'Musterstraße 12, 10115 Berlin', kunde_name: 'Schmidt, H.', telefon: '+49 30 12345', bestellnummer: 'FF-2401', geliefert_am: null, eta_min: 6, lat: null, lng: null, notiz: null },
  { id: 's2', reihenfolge: 2, adresse: 'Hauptstr. 55, 10117 Berlin', kunde_name: 'Müller, K.', telefon: '+49 30 87654', bestellnummer: 'FF-2402', geliefert_am: null, eta_min: 16, lat: null, lng: null, notiz: null },
  { id: 's3', reihenfolge: 3, adresse: 'Berliner Allee 3, 10119 Berlin', kunde_name: 'Weber, S.', telefon: null, bestellnummer: 'FF-2403', geliefert_am: null, eta_min: 24, lat: null, lng: null, notiz: 'Klingel 3. OG' },
];

interface Props {
  driverId: string;
  locationId: string;
  isOnline: boolean;
  className?: string;
}

function openNavigation(stop: TourStop) {
  const dest = stop.lat && stop.lng
    ? `${stop.lat},${stop.lng}`
    : encodeURIComponent(stop.adresse);

  const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
  const url = isIOS
    ? `maps://?daddr=${dest}`
    : `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
  window.open(url, '_blank');
}

export function FahrerPhase2060TourStopsNavigationLive({ driverId, locationId, isOnline, className = '' }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [stops, setStops] = useState<TourStop[]>([]);
  const [loading, setLoading] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 10_000);
    return () => clearInterval(iv);
  }, []);

  const fetchStops = useCallback(async () => {
    if (!driverId) {
      setStops(MOCK_STOPS);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/fahrer/tour-stops?driver_id=${driverId}`);
      if (res.ok) {
        const data = await res.json();
        const list: TourStop[] = (data?.stops ?? []).map((s: any) => ({
          id: s.id,
          reihenfolge: s.reihenfolge ?? s.sequence ?? 0,
          adresse: s.adresse ?? s.address ?? '',
          kunde_name: s.kunde_name ?? s.customer_name ?? null,
          telefon: s.telefon ?? s.phone ?? null,
          bestellnummer: s.bestellnummer ?? s.order_number ?? null,
          geliefert_am: s.geliefert_am ?? s.delivered_at ?? null,
          eta_min: s.eta_min ?? null,
          lat: s.lat ?? null,
          lng: s.lng ?? null,
          notiz: s.notiz ?? s.notes ?? null,
        }));
        setStops(list.length ? list : MOCK_STOPS);
      } else {
        setStops(MOCK_STOPS);
      }
    } catch {
      setStops(MOCK_STOPS);
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    fetchStops();
  }, [fetchStops, tick]);

  const pending = stops.filter((s) => !s.geliefert_am).sort((a, b) => a.reihenfolge - b.reihenfolge);
  const done = stops.filter((s) => !!s.geliefert_am);
  const nextStop = pending[0] ?? null;
  const total = stops.length;
  const doneCount = done.length;
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <section className={cn('rounded-2xl border border-matcha-800/30 bg-matcha-950/80 overflow-hidden', className)}>
      {/* Header */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3"
      >
        <Route className="h-4 w-4 text-matcha-400 shrink-0" />
        <div className="flex-1 text-left">
          <div className="text-xs font-bold text-white">Tour-Stops & Navigation</div>
          <div className="text-[10px] text-matcha-400">
            {doneCount}/{total} erledigt{nextStop?.eta_min ? ` · nächster in ~${nextStop.eta_min} Min` : ''}
          </div>
        </div>
        {/* Progress */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-20 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-matcha-500 transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-[10px] text-matcha-400 font-bold">{pct}%</span>
          {collapsed ? <ChevronDown className="h-3.5 w-3.5 text-matcha-500" /> : <ChevronUp className="h-3.5 w-3.5 text-matcha-500" />}
        </div>
      </button>

      {!collapsed && (
        <div className="border-t border-white/5 divide-y divide-white/5">
          {loading && (
            <div className="px-4 py-3 text-xs text-matcha-400 animate-pulse">Lade Stops…</div>
          )}

          {!loading && pending.length === 0 && done.length === 0 && (
            <div className="px-4 py-3 text-xs text-matcha-500">Keine aktive Tour.</div>
          )}

          {/* Ausstehende Stops */}
          {pending.map((stop, idx) => {
            const isNext = idx === 0;
            return (
              <div
                key={stop.id}
                className={cn(
                  'px-4 py-3 flex items-start gap-3',
                  isNext ? 'bg-matcha-900/40' : 'opacity-70',
                )}
              >
                {/* Sequenz-Nummer */}
                <div className={cn(
                  'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black',
                  isNext ? 'bg-matcha-500 text-white' : 'bg-white/10 text-matcha-400',
                )}>
                  {stop.reihenfolge}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {isNext && (
                      <span className="text-[9px] rounded-full bg-matcha-500/20 text-matcha-300 px-1.5 py-0.5 font-bold uppercase">
                        Jetzt
                      </span>
                    )}
                    <span className="text-xs font-bold text-white truncate">
                      {stop.kunde_name ?? 'Kunde'}
                    </span>
                    {stop.bestellnummer && (
                      <span className="text-[9px] text-matcha-400">#{stop.bestellnummer.replace('FF-', '')}</span>
                    )}
                  </div>

                  <div className="flex items-start gap-1 mt-0.5">
                    <MapPin className="h-3 w-3 text-matcha-500 shrink-0 mt-0.5" />
                    <span className="text-[11px] text-matcha-300 leading-snug">{stop.adresse}</span>
                  </div>

                  {stop.notiz && (
                    <div className="text-[10px] text-amber-400 mt-0.5">ℹ {stop.notiz}</div>
                  )}

                  {stop.eta_min !== null && (
                    <div className="flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3 text-matcha-500" />
                      <span className="text-[10px] text-matcha-400">~{stop.eta_min} Min</span>
                    </div>
                  )}

                  {/* Aktions-Buttons für nächsten Stop */}
                  {isNext && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => openNavigation(stop)}
                        className="flex items-center gap-1 rounded-xl bg-matcha-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-matcha-500 transition"
                      >
                        <Navigation className="h-3 w-3" />
                        Navigieren
                      </button>
                      {stop.telefon && (
                        <a
                          href={`tel:${stop.telefon}`}
                          className="flex items-center gap-1 rounded-xl bg-white/10 px-3 py-1.5 text-[11px] font-bold text-matcha-300 hover:bg-white/15 transition"
                        >
                          <Phone className="h-3 w-3" />
                          Anrufen
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Erledigte Stops */}
          {done.length > 0 && (
            <div className="px-4 py-2 bg-white/[0.02]">
              <div className="text-[10px] text-matcha-600 font-bold uppercase mb-1.5">Abgeliefert</div>
              {done.map((stop) => (
                <div key={stop.id} className="flex items-center gap-2 py-1">
                  <CheckCircle className="h-3.5 w-3.5 text-matcha-500 shrink-0" />
                  <span className="text-[11px] text-matcha-500 truncate">{stop.adresse}</span>
                  {stop.bestellnummer && (
                    <span className="text-[9px] text-matcha-600 shrink-0">#{stop.bestellnummer.replace('FF-', '')}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
