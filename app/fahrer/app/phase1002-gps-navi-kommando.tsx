'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Navigation, MapPin, Clock, Wifi, WifiOff, ChevronDown, ChevronUp, Phone, Package, RefreshCw } from 'lucide-react';

/**
 * Phase 1002 — GPS-Navi-Kommando (Fahrer-App)
 *
 * Live-GPS-Navigations-Kommandozentrale:
 * - Zeigt aktuellen Stopp mit Adresse, ETA und Kunden-Kontakt
 * - Echtzeit-GPS-Position über navigator.geolocation (falls verfügbar)
 * - Direktstart Navigation per Google Maps / Waze / Apple Maps
 * - Pulsierendes Ankunfts-Signal wenn <100m vom Ziel entfernt
 * Polling /api/delivery/driver/active-batch für aktiven Stopp-Daten.
 */

interface ActiveStop {
  id: string;
  adresse: string;
  kundenName: string | null;
  telefon: string | null;
  etaMin: number | null;
  bestellnummer: string | number | null;
  lat: number | null;
  lng: number | null;
}

const DEMO_STOP: ActiveStop = {
  id: 'demo',
  adresse: 'Musterstraße 42, 10115 Berlin',
  kundenName: 'Anna Müller',
  telefon: '+491761234567',
  etaMin: 5,
  bestellnummer: '4481',
  lat: 52.5200,
  lng: 13.4050,
};

function distance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function FahrerPhase1002GpsNaviKommando() {
  const [stop, setStop]         = useState<ActiveStop | null>(null);
  const [gpsLat, setGpsLat]     = useState<number | null>(null);
  const [gpsLng, setGpsLng]     = useState<number | null>(null);
  const [gpsErr, setGpsErr]     = useState(false);
  const [loading, setLoading]   = useState(true);
  const [open, setOpen]         = useState(true);
  const [confirmed, setConfirmed] = useState(false);

  // Fetch active stop
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/delivery/driver/active-batch');
        if (!res.ok) throw new Error();
        const raw = await res.json();
        const s = raw.currentStop ?? raw.aktueller_stop ?? null;
        if (s) {
          setStop({
            id:            s.id ?? 'live',
            adresse:       s.address ?? s.adresse ?? 'Unbekannte Adresse',
            kundenName:    s.customer_name ?? s.kundenName ?? null,
            telefon:       s.phone ?? s.telefon ?? null,
            etaMin:        s.eta_min ?? s.etaMin ?? null,
            bestellnummer: s.order_number ?? s.bestellnummer ?? null,
            lat:           s.lat ?? null,
            lng:           s.lng ?? null,
          });
        } else {
          setStop(DEMO_STOP);
        }
      } catch {
        setStop(DEMO_STOP);
      } finally {
        setLoading(false);
      }
    }
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, []);

  // GPS tracking
  const startGps = useCallback(() => {
    if (!navigator.geolocation) { setGpsErr(true); return; }
    navigator.geolocation.watchPosition(
      pos => { setGpsLat(pos.coords.latitude); setGpsLng(pos.coords.longitude); setGpsErr(false); },
      ()  => setGpsErr(true),
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
  }, []);

  useEffect(() => { startGps(); }, [startGps]);

  const distM =
    gpsLat && gpsLng && stop?.lat && stop?.lng
      ? distance(gpsLat, gpsLng, stop.lat, stop.lng)
      : null;
  const nearArrival = distM !== null && distM < 100;

  function navLink(type: 'google' | 'waze' | 'apple'): string {
    const addr = encodeURIComponent(stop?.adresse ?? '');
    const ll   = stop?.lat && stop?.lng ? `${stop.lat},${stop.lng}` : null;
    if (type === 'google') return ll
      ? `https://www.google.com/maps/dir/?api=1&destination=${ll}`
      : `https://www.google.com/maps/dir/?api=1&destination=${addr}`;
    if (type === 'waze')  return `https://waze.com/ul?ll=${ll ?? ''}&q=${addr}&navigate=yes`;
    return `http://maps.apple.com/?daddr=${ll ?? addr}`;
  }

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground animate-pulse">
          <RefreshCw className="h-4 w-4 animate-spin" />
          Lade aktuellen Stopp…
        </div>
      </div>
    );
  }

  if (!stop) return null;

  return (
    <div className={cn(
      'rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden transition-all',
      nearArrival && 'ring-2 ring-matcha-500 ring-offset-2',
    )}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Navigation className={cn('h-4 w-4', nearArrival ? 'text-matcha-500 animate-pulse' : 'text-blue-500')} />
          <span className="text-sm font-bold">
            {nearArrival ? '📍 Fast da!' : 'GPS-Navi'}
          </span>
          {stop.bestellnummer && (
            <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5 font-bold text-muted-foreground">
              #{stop.bestellnummer}
            </span>
          )}
          <div className="ml-auto flex items-center gap-1.5">
            {gpsLat ? (
              <Wifi className="h-3 w-3 text-matcha-500" />
            ) : gpsErr ? (
              <WifiOff className="h-3 w-3 text-red-400" />
            ) : null}
            {stop.etaMin !== null && (
              <span className="text-[10px] font-bold tabular-nums text-muted-foreground">
                ~{stop.etaMin} Min
              </span>
            )}
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && !confirmed && (
        <div className="px-4 pb-4 space-y-3">
          {/* Zieladresse */}
          <div className={cn(
            'rounded-xl border p-3 space-y-1',
            nearArrival
              ? 'bg-matcha-50 dark:bg-matcha-950/20 border-matcha-300'
              : 'bg-blue-50 dark:bg-blue-950/20 border-blue-200',
          )}>
            <div className="flex items-start gap-2">
              <MapPin className={cn('h-4 w-4 mt-0.5 shrink-0', nearArrival ? 'text-matcha-600' : 'text-blue-600')} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-foreground leading-snug">
                  {stop.adresse}
                </div>
                {stop.kundenName && (
                  <div className="text-xs text-muted-foreground mt-0.5">{stop.kundenName}</div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3 pt-0.5">
              {stop.etaMin !== null && (
                <div className="flex items-center gap-1 text-xs font-bold text-blue-700 dark:text-blue-300">
                  <Clock className="h-3 w-3" />
                  ETA ~{stop.etaMin} Min
                </div>
              )}
              {distM !== null && (
                <div className="text-xs text-muted-foreground">
                  {distM < 1000 ? `${Math.round(distM)} m` : `${(distM / 1000).toFixed(1)} km`} entfernt
                </div>
              )}
            </div>
          </div>

          {/* Navigations-Buttons */}
          <div className="grid grid-cols-3 gap-2">
            <a
              href={navLink('google')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-700 py-2.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition"
            >
              <Navigation className="h-4 w-4" />
              Google
            </a>
            <a
              href={navLink('waze')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-700 py-2.5 text-[10px] font-bold text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition"
            >
              <MapPin className="h-4 w-4" />
              Waze
            </a>
            <a
              href={navLink('apple')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-1 rounded-xl bg-zinc-50 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-700 py-2.5 text-[10px] font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 transition"
            >
              <MapPin className="h-4 w-4" />
              Apple
            </a>
          </div>

          {/* Telefon */}
          {stop.telefon && (
            <a
              href={`tel:${stop.telefon}`}
              className="flex items-center gap-2 rounded-xl bg-muted/30 border border-border px-3 py-2.5 text-xs font-medium hover:bg-muted/60 transition"
            >
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{stop.telefon}</span>
              <span className="ml-auto text-[9px] text-muted-foreground">Anrufen</span>
            </a>
          )}

          {/* Abliefern */}
          <button
            onClick={() => setConfirmed(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-matcha-600 hover:bg-matcha-700 active:scale-[0.98] text-white py-3 text-sm font-bold transition"
          >
            <Package className="h-4 w-4" />
            Abgeliefert ✓
          </button>
        </div>
      )}

      {confirmed && (
        <div className="px-4 py-5 text-center bg-matcha-50 dark:bg-matcha-950/20 border-t border-matcha-200">
          <div className="text-2xl mb-1">🎉</div>
          <div className="text-sm font-bold text-matcha-700 dark:text-matcha-300">Super — Abgeliefert!</div>
          <button
            onClick={() => setConfirmed(false)}
            className="mt-3 text-[11px] text-muted-foreground underline underline-offset-2"
          >
            Rückgängig
          </button>
        </div>
      )}
    </div>
  );
}
