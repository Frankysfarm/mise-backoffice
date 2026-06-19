'use client';

/**
 * TourZielpunktKarte — Kompaktkarte für den nächsten Stopp mit Adresse, Distanz, ETA und Navigation.
 *
 * Zeigt:
 *  - Adresse + Kundename des nächsten Stopps
 *  - Geschätzte Fahrtzeit (ETA) + Entfernung in km
 *  - Ein-Tap-Navigations-Button (öffnet Maps-App)
 *  - Farbkodierung je nach verbleibender Zeit: grün / amber / rot
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Navigation, MapPin, Clock, ArrowRight } from 'lucide-react';

interface TourStop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    kunde_name: string;
    kunde_adresse: string | null;
    kunde_lat?: number | null;
    kunde_lng?: number | null;
  } | null;
  eta_min?: number | null;
  distance_km?: number | null;
}

interface Props {
  stops: TourStop[];
  driverLat?: number | null;
  driverLng?: number | null;
}

function etaStyle(etaMin: number | null): { card: string; badge: string } {
  if (etaMin === null) return { card: 'bg-card border-border', badge: 'bg-muted text-muted-foreground' };
  if (etaMin <= 3) return { card: 'bg-red-50 border-red-300', badge: 'bg-red-500 text-white' };
  if (etaMin <= 7) return { card: 'bg-amber-50 border-amber-300', badge: 'bg-amber-500 text-white' };
  return { card: 'bg-matcha-50 border-matcha-200', badge: 'bg-matcha-500 text-white' };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function TourZielpunktKarte({ stops, driverLat, driverLng }: Props) {
  const nextStop = useMemo(
    () =>
      stops
        .filter(s => !s.geliefert_am)
        .sort((a, b) => a.reihenfolge - b.reihenfolge)[0] ?? null,
    [stops],
  );

  // Must be before early return — hooks cannot be called conditionally
  const distKm = useMemo(() => {
    if (!nextStop) return null;
    if (nextStop.distance_km != null) return nextStop.distance_km;
    const ord = nextStop.order;
    if (driverLat != null && driverLng != null && ord?.kunde_lat && ord?.kunde_lng) {
      return haversineKm(driverLat, driverLng, ord.kunde_lat, ord.kunde_lng);
    }
    return null;
  }, [nextStop, driverLat, driverLng]);

  if (!nextStop || !nextStop.order) return null;

  const { order } = nextStop;
  const etaMin = nextStop.eta_min ?? null;
  const style = etaStyle(etaMin);

  const mapsUrl = order.kunde_lat && order.kunde_lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${order.kunde_lat},${order.kunde_lng}&travelmode=bicycling`
    : order.kunde_adresse
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.kunde_adresse)}`
      : null;

  return (
    <div className={cn('rounded-xl border p-3 space-y-2', style.card)}>
      {/* Label */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Nächster Stopp · #{nextStop.reihenfolge}
          </span>
        </div>
        {etaMin !== null && (
          <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black', style.badge)}>
            ~{etaMin} Min
          </span>
        )}
      </div>

      {/* Customer + address */}
      <div>
        <div className="text-sm font-bold leading-tight">{order.kunde_name}</div>
        {order.kunde_adresse && (
          <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{order.kunde_adresse}</div>
        )}
      </div>

      {/* Distance + Nav button */}
      <div className="flex items-center gap-2 pt-0.5">
        {distKm !== null && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span className="font-bold">{distKm.toFixed(1)} km</span>
          </div>
        )}
        {mapsUrl && (
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-matcha-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm active:scale-95 transition"
          >
            <Navigation className="h-3 w-3" />
            Navigation
            <ArrowRight className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}
