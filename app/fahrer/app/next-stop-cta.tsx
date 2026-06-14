'use client';

/**
 * NextStopCta — Großer Navigation-Button für den nächsten Stopp.
 *
 * Mobile-first, daumenfreundlich. Öffnet Google Maps oder Apple Maps.
 * Props: address, lat, lng, stopNumber, isCurrentStop.
 */

import { cn } from '@/lib/utils';
import { Navigation, MapPin } from 'lucide-react';

interface NextStopCtaProps {
  address: string | null;
  lat: number | null;
  lng: number | null;
  stopNumber: number;
  isCurrentStop: boolean;
  distM?: number | null;
}

function googleMapsUrl(lat: number | null, lng: number | null, address: string | null): string {
  if (lat != null && lng != null) {
    return `https://maps.google.com/?q=${lat},${lng}`;
  }
  if (address) {
    return `https://maps.google.com/?q=${encodeURIComponent(address)}`;
  }
  return '#';
}

function appleMapsUrl(lat: number | null, lng: number | null, address: string | null): string {
  if (lat != null && lng != null) {
    return `maps://maps.apple.com/?daddr=${lat},${lng}&dirflg=d`;
  }
  if (address) {
    return `maps://maps.apple.com/?daddr=${encodeURIComponent(address)}&dirflg=d`;
  }
  return '#';
}

export function NextStopCta({
  address,
  lat,
  lng,
  stopNumber,
  isCurrentStop,
  distM,
}: NextStopCtaProps) {
  const googleUrl = googleMapsUrl(lat, lng, address);
  const appleUrl = appleMapsUrl(lat, lng, address);
  const hasTarget = lat != null || address != null;

  if (!hasTarget) return null;

  return (
    <div className={cn(
      'rounded-2xl border p-3 space-y-2.5',
      isCurrentStop
        ? 'border-accent/40 bg-accent/5'
        : 'border-white/10 bg-white/5',
    )}>
      {/* Label */}
      <div className="flex items-center gap-2 px-1">
        <div className={cn(
          'h-6 w-6 rounded-lg flex items-center justify-center text-xs font-black shrink-0',
          isCurrentStop ? 'bg-accent text-matcha-900' : 'bg-white/10 text-matcha-300',
        )}>
          {stopNumber}
        </div>
        <span className={cn(
          'text-xs font-bold uppercase tracking-wider',
          isCurrentStop ? 'text-accent' : 'text-matcha-400',
        )}>
          {isCurrentStop ? 'Aktueller Stopp' : `Stopp ${stopNumber}`}
        </span>
        {distM != null && distM > 0 && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-matcha-400">
            <MapPin className="h-3 w-3" />
            {distM < 1000 ? `${Math.round(distM)} m` : `${(distM / 1000).toFixed(1)} km`}
          </span>
        )}
      </div>

      {/* Address */}
      {address && (
        <div className="px-1 text-[11px] text-matcha-300 truncate">{address}</div>
      )}

      {/* Primary CTA — Google Maps */}
      <a
        href={googleUrl}
        target="_blank"
        rel="noreferrer"
        className={cn(
          'flex items-center justify-center gap-2.5 w-full rounded-2xl font-black text-sm text-matcha-900 transition active:scale-[0.97]',
          'min-h-[64px]',
          isCurrentStop
            ? 'bg-matcha-600 hover:bg-matcha-500 text-white'
            : 'bg-matcha-700 hover:bg-matcha-600 text-matcha-100',
        )}
      >
        <Navigation className="h-5 w-5" />
        Navigation starten
      </a>

      {/* Secondary CTA — Apple Maps */}
      <a
        href={appleUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 w-full rounded-2xl min-h-[44px] bg-white/5 border border-white/10 text-matcha-300 text-xs font-bold transition active:scale-[0.97] hover:bg-white/10"
      >
        <MapPin className="h-4 w-4" />
        Apple Maps
      </a>
    </div>
  );
}
