'use client';

/**
 * FahrerRichtungsAnzeige — Phase 255
 *
 * Kompakter Richtungsanzeiger für den nächsten ungelieferten Stopp.
 * Berechnet Himmelsrichtung + Luftlinien-Distanz auf Basis der Fahrer-GPS-Position
 * und zeigt einen animierten Richtungspfeil.
 *
 * Nur sichtbar wenn aktiver Batch vorhanden und GPS verfügbar.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Navigation, MapPin } from 'lucide-react';

interface Stop {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_lat: number | null;
    kunde_lng: number | null;
    kunde_adresse: string | null;
  };
}

interface Props {
  stops: Stop[];
  driverLat: number | null;
  driverLng: number | null;
}

function bearingDeg(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function compassLabel(deg: number): string {
  const dirs = ['N', 'NO', 'O', 'SO', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

export function FahrerRichtungsAnzeige({ stops, driverLat, driverLng }: Props) {
  const [heading, setHeading] = useState<number | null>(null);

  // Try to get device compass heading
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const win = window as Window & { DeviceOrientationEvent?: unknown };
    if (!win.DeviceOrientationEvent) return;
    const handler = (e: DeviceOrientationEvent) => {
      const alpha = e.alpha; // degrees from North
      if (alpha != null) setHeading(alpha);
    };
    window.addEventListener('deviceorientation', handler, true);
    return () => window.removeEventListener('deviceorientation', handler, true);
  }, []);

  const nextStop = stops
    .filter(s => !s.geliefert_am && s.order.kunde_lat && s.order.kunde_lng)
    .sort((a, b) => a.reihenfolge - b.reihenfolge)[0];

  if (!nextStop || !driverLat || !driverLng) return null;
  const { kunde_lat: lat2, kunde_lng: lng2 } = nextStop.order;
  if (!lat2 || !lng2) return null;

  const bearing = bearingDeg(driverLat, driverLng, lat2, lng2);
  const dist = distanceKm(driverLat, driverLng, lat2, lng2);
  const distLabel = dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`;
  const compass = compassLabel(bearing);

  // Arrow rotation: compensate for device heading if available
  const arrowDeg = heading != null ? (bearing - heading + 360) % 360 : bearing;

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
      {/* Compass arrow */}
      <div
        className="shrink-0 h-10 w-10 rounded-full bg-matcha-50 border border-matcha-200 flex items-center justify-center"
        style={{ transform: `rotate(${arrowDeg}deg)`, transition: 'transform 0.5s ease' }}
        aria-label={`Richtung: ${compass}`}
      >
        <Navigation className="h-5 w-5 text-matcha-700" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-bold truncate">{nextStop.order.kunde_name}</span>
        </div>
        <div className="text-xs text-muted-foreground truncate mt-0.5">
          {nextStop.order.kunde_adresse ?? '–'}
        </div>
      </div>

      {/* Distance + compass */}
      <div className="shrink-0 text-right">
        <div className="text-base font-black tabular-nums text-matcha-700">{distLabel}</div>
        <div className={cn(
          'text-[10px] font-bold rounded px-1',
          'bg-matcha-50 text-matcha-600',
        )}>
          {compass}
        </div>
      </div>
    </div>
  );
}
