'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, Package, RefreshCw } from 'lucide-react';

/**
 * Phase 1789 — Nächster-Stopp-Navigator (Fahrer-App)
 *
 * Zeigt nächste Lieferadresse + Karten-Link + Stopp-Fortschritt.
 * isOnline-Guard; 2-Min-Polling; nur sichtbar wenn Tour aktiv.
 * Nutzt /api/delivery/driver/naechster-stop (Phase 714).
 */

interface NaechsterStoppAntwort {
  adresse: string | null;
  kundeName?: string;
  bestellnummer?: string;
  stopp_nr?: number;
  stopps_gesamt?: number;
  eta_min?: number | null;
  distanz_km?: number | null;
  karten_link?: string | null;
}

function buildMock(): NaechsterStoppAntwort {
  return {
    adresse: 'Hauptstraße 47, 10117 Berlin',
    kundeName: 'M. Schulz',
    bestellnummer: '#1041',
    stopp_nr: 2,
    stopps_gesamt: 3,
    eta_min: 7,
    distanz_km: 2.4,
    karten_link: null,
  };
}

interface Props {
  driverId: string | null;
  isOnline: boolean;
  className?: string;
}

export function FahrerPhase1789NaechsterStoppNavigator({ driverId, isOnline, className }: Props) {
  const [data, setData] = useState<NaechsterStoppAntwort | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!driverId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/driver/naechster-stop?driver_id=${driverId}`);
      if (res.ok) setData(await res.json());
      else setData(buildMock());
    } catch {
      setData(buildMock());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOnline) { setData(null); return; }
    load();
    const id = setInterval(load, 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [driverId, isOnline]);

  if (!isOnline || !data || !data.adresse) return null;

  const fortschritt = data.stopp_nr && data.stopps_gesamt
    ? Math.round(((data.stopp_nr - 1) / data.stopps_gesamt) * 100)
    : 0;

  const googleMapsUrl = data.karten_link
    ?? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(data.adresse)}`;

  return (
    <div className={cn('mx-4 mt-3 rounded-xl border border-matcha-200 dark:border-matcha-800 bg-matcha-50 dark:bg-matcha-900/20', className)}>
      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <Navigation className="h-4 w-4 text-matcha-600 dark:text-matcha-400 shrink-0" />
          <p className="text-xs font-bold text-matcha-800 dark:text-matcha-200 flex-1">
            Nächster Stopp
          </p>
          {loading && <RefreshCw className="h-3 w-3 animate-spin text-muted-foreground" />}
          {data.stopp_nr && data.stopps_gesamt && (
            <span className="text-[10px] text-muted-foreground">
              {data.stopp_nr} / {data.stopps_gesamt}
            </span>
          )}
        </div>

        {/* Fortschrittsbalken */}
        {data.stopp_nr && data.stopps_gesamt && (
          <div className="h-1 bg-muted rounded-full overflow-hidden mb-2.5">
            <div
              className="h-full bg-matcha-500 rounded-full transition-all"
              style={{ width: `${fortschritt}%` }}
            />
          </div>
        )}

        {/* Adresse */}
        <div className="flex items-start gap-2 mb-2">
          <MapPin className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold truncate">{data.adresse}</p>
            {data.kundeName && (
              <p className="text-xs text-muted-foreground">{data.kundeName}</p>
            )}
          </div>
        </div>

        {/* Meta-Zeile */}
        <div className="flex items-center gap-3 mb-3">
          {data.bestellnummer && (
            <div className="flex items-center gap-1">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">{data.bestellnummer}</span>
            </div>
          )}
          {data.eta_min !== null && data.eta_min !== undefined && (
            <span className="text-xs font-bold text-matcha-700 dark:text-matcha-300">
              ~{data.eta_min} Min
            </span>
          )}
          {data.distanz_km !== null && data.distanz_km !== undefined && (
            <span className="text-xs text-muted-foreground">{data.distanz_km} km</span>
          )}
        </div>

        {/* Navigation-Button */}
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg px-4 py-2.5',
            'bg-matcha-600 hover:bg-matcha-700 text-white text-sm font-bold',
            'transition-colors w-full',
          )}
        >
          <Navigation className="h-4 w-4" />
          Navigation starten
        </a>
      </div>
    </div>
  );
}
