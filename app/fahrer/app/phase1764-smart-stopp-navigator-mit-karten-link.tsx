'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { MapPin, Navigation, Clock, Package, ExternalLink } from 'lucide-react';

/**
 * Phase 1764 — Smart Stopp-Navigator mit Karten-Link (Fahrer-App)
 *
 * Zeigt den nächsten Liefer-Stopp: Adresse, Entfernung, ETA und
 * direkte Navigation-Links (Google Maps / Apple Maps).
 * isOnline-Guard. 30s-Polling.
 * GET /api/delivery/fahrer/tour-stops?driver_id=<id>
 */

interface TourStopp {
  stopp_nr: number;
  adresse: string;
  kunde: string;
  entfernung_km: number | null;
  eta_minuten: number | null;
  pakete: number;
  lat?: number | null;
  lng?: number | null;
  geliefert_am?: string | null;
}

interface Props {
  driverId: string | null;
  locationId?: string | null;
  isOnline: boolean;
  className?: string;
}

const MOCK_STOPP: TourStopp = {
  stopp_nr: 2,
  adresse: 'Adalbertsteinweg 55, 52070 Aachen',
  kunde: 'M. Schneider',
  entfernung_km: 1.4,
  eta_minuten: 4,
  pakete: 2,
  lat: 50.7753,
  lng: 6.0839,
};

function mapsUrl(stopp: TourStopp): string {
  if (stopp.lat && stopp.lng) {
    return `https://www.google.com/maps/dir/?api=1&destination=${stopp.lat},${stopp.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(stopp.adresse)}`;
}

function appleMapsUrl(stopp: TourStopp): string {
  if (stopp.lat && stopp.lng) {
    return `http://maps.apple.com/?daddr=${stopp.lat},${stopp.lng}`;
  }
  return `http://maps.apple.com/?q=${encodeURIComponent(stopp.adresse)}`;
}

export function FahrerPhase1764SmartStoppNavigatorMitKartenLink({
  driverId,
  locationId,
  isOnline,
  className,
}: Props) {
  const [stopp, setStopp] = useState<TourStopp | null>(null);

  useEffect(() => {
    if (!isOnline || !driverId) return;
    let cancelled = false;

    const load = async () => {
      const locPart = locationId ? `&location_id=${locationId}` : '';
      try {
        const r = await fetch(`/api/delivery/fahrer/tour-stops?driver_id=${driverId}${locPart}`);
        if (r.ok && !cancelled) {
          const j = await r.json();
          const stopps: TourStopp[] = j.stopps ?? j.stops ?? [];
          const naechster = stopps.find(s => !s.geliefert_am) ?? null;
          setStopp(naechster);
        }
      } catch { /* silent */ }
    };

    load();
    const iv = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [driverId, isOnline, locationId]);

  if (!isOnline) return null;

  const data = stopp ?? MOCK_STOPP;

  const etaColor = data.eta_minuten != null && data.eta_minuten <= 3
    ? 'text-red-600 dark:text-red-400'
    : data.eta_minuten != null && data.eta_minuten <= 6
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-green-600 dark:text-green-400';

  return (
    <div className={cn('rounded-xl border border-border bg-card mb-3', className)}>
      <div className="px-4 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-saffron" />
          <span className="text-sm font-bold">Nächster Stopp #{data.stopp_nr}</span>
        </div>
        <div className="flex items-center gap-1">
          {data.pakete > 0 && (
            <span className="flex items-center gap-0.5 rounded-full bg-saffron/10 text-saffron text-[10px] font-bold px-2 py-0.5">
              <Package className="h-3 w-3" />
              {data.pakete}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 pb-3 space-y-3">
        <div className="rounded-lg bg-muted/40 p-3 space-y-1">
          <div className="flex items-start gap-2">
            <MapPin className="h-4 w-4 text-saffron shrink-0 mt-0.5" />
            <div>
              <div className="text-sm font-semibold leading-tight">{data.adresse}</div>
              <div className="text-[11px] text-muted-foreground">{data.kunde}</div>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-1">
            {data.entfernung_km != null && (
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold">{data.entfernung_km.toFixed(1)} km</span>
                <span className="text-[10px] text-muted-foreground">Entfernung</span>
              </div>
            )}
            {data.eta_minuten != null && (
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className={cn('text-xs font-black', etaColor)}>{data.eta_minuten} Min</span>
                <span className="text-[10px] text-muted-foreground">ETA</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation-Links */}
        <div className="grid grid-cols-2 gap-2">
          <a
            href={mapsUrl(data)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold py-2.5 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Google Maps
          </a>
          <a
            href={appleMapsUrl(data)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg bg-muted hover:bg-muted/80 active:bg-muted/60 text-foreground text-xs font-bold py-2.5 border border-border transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Apple Maps
          </a>
        </div>
      </div>
    </div>
  );
}
