'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, MapPin, Navigation } from 'lucide-react';

type Props = {
  lat: number | null;
  lng: number | null;
  address: string | null;
  stopNumber: number;
  onConfirmArrival?: () => void;
};

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function StopArrivalProximity({ lat, lng, address, stopNumber, onConfirmArrival }: Props) {
  const [distM, setDistM] = useState<number | null>(null);
  const [geoUnavailable, setGeoUnavailable] = useState(false);
  const watchRef = useRef<number | null>(null);

  useEffect(() => {
    if (lat == null || lng == null) return;
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoUnavailable(true);
      return;
    }

    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const d = haversineM(pos.coords.latitude, pos.coords.longitude, lat, lng);
        setDistM(Math.round(d));
      },
      () => setGeoUnavailable(true),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 12_000 },
    );

    return () => {
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, [lat, lng]);

  if (geoUnavailable || distM === null) return null;

  const isVeryNear = distM <= 50;
  const isNear = distM <= 200;

  if (!isNear) {
    return (
      <div className="flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-[10px] text-matcha-400">
        <Navigation className="h-3 w-3 shrink-0" />
        <span>
          {distM < 1000 ? `${distM} m` : `${(distM / 1000).toFixed(1)} km`} bis Stopp {stopNumber}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-2xl border-2 p-4 transition-all duration-300',
        isVeryNear
          ? 'border-accent bg-accent/15 shadow-[0_0_28px_rgba(74,230,138,0.35)] animate-pulse'
          : 'border-amber-400/60 bg-amber-500/10',
      )}
    >
      <div className="flex items-center gap-3 mb-3">
        <div
          className={cn(
            'h-9 w-9 rounded-xl flex items-center justify-center shrink-0',
            isVeryNear ? 'bg-accent' : 'bg-amber-400',
          )}
        >
          <MapPin className="h-4 w-4 text-matcha-900" />
        </div>
        <div className="flex-1 min-w-0">
          <div className={cn('font-black text-sm', isVeryNear ? 'text-accent' : 'text-amber-300')}>
            {isVeryNear ? 'Du bist angekommen!' : `Fast da — noch ${distM} m`}
          </div>
          {address && (
            <div className="text-[10px] text-matcha-400 truncate mt-0.5">{address}</div>
          )}
        </div>
      </div>
      {onConfirmArrival && (
        <button
          onClick={onConfirmArrival}
          className={cn(
            'w-full h-11 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition active:scale-[0.97]',
            isVeryNear
              ? 'bg-accent text-matcha-900'
              : 'bg-amber-400/20 border border-amber-400/40 text-amber-300',
          )}
        >
          <CheckCircle2 className="h-4 w-4" />
          Angekommen bestätigen
        </button>
      )}
    </div>
  );
}
