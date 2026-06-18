'use client';

import { useEffect, useRef, useState } from 'react';
import { Navigation, MapPin, Vibrate } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  nextStopLat: number | null;
  nextStopLng: number | null;
  nextStopName: string;
  nextStopAddress: string | null;
  /** Radius in Metern, ab der der Alert auslöst. Default 250m */
  triggerRadiusM?: number;
  onArrived?: () => void;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

type AlertState = 'idle' | 'approaching' | 'arrived';

export function ProximityStopAlert({
  nextStopLat,
  nextStopLng,
  nextStopName,
  nextStopAddress,
  triggerRadiusM = 250,
  onArrived,
}: Props) {
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [alertState, setAlertState] = useState<AlertState>('idle');
  const [locationError, setLocationError] = useState(false);
  const arrivedRef = useRef(false);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!nextStopLat || !nextStopLng) return;
    if (!navigator.geolocation) return;

    arrivedRef.current = false;
    setAlertState('idle');

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        const dist = haversineM(latitude, longitude, nextStopLat, nextStopLng);
        setDistanceM(Math.round(dist));
        setLocationError(false);

        if (dist <= triggerRadiusM && !arrivedRef.current) {
          arrivedRef.current = true;
          setAlertState('arrived');
          // Vibration: 3 kurze Pulse
          if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200, 100, 400]);
          }
          onArrived?.();
        } else if (dist <= triggerRadiusM * 2) {
          setAlertState((s) => (s === 'arrived' ? s : 'approaching'));
        }
      },
      () => setLocationError(true),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 10_000 },
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [nextStopLat, nextStopLng, triggerRadiusM, onArrived]);

  if (!nextStopLat || !nextStopLng) return null;
  if (locationError) return null;

  if (alertState === 'idle' && (distanceM === null || distanceM > triggerRadiusM * 2)) return null;

  const isArrived = alertState === 'arrived';
  const isApproaching = alertState === 'approaching';

  return (
    <div
      className={cn(
        'fixed bottom-24 left-4 right-4 z-50 rounded-2xl border-2 px-4 py-3.5 shadow-2xl transition-all duration-300',
        isArrived
          ? 'bg-matcha-600 border-matcha-400 text-white animate-bounce'
          : 'bg-amber-500 border-amber-400 text-white',
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn(
          'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
          isArrived ? 'bg-white/20' : 'bg-white/20',
        )}>
          {isArrived ? (
            <MapPin className="h-5 w-5" />
          ) : (
            <Navigation className="h-5 w-5 animate-pulse" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-display font-black text-base leading-tight">
            {isArrived ? 'Ziel erreicht!' : 'Fast da — noch ' + (distanceM !== null ? `${distanceM} m` : '…')}
          </div>
          <div className="text-[11px] font-bold opacity-80 truncate mt-0.5">
            {nextStopName}
            {nextStopAddress && ` · ${nextStopAddress}`}
          </div>
        </div>

        {distanceM !== null && !isArrived && (
          <div className="shrink-0 text-right">
            <div className="font-mono font-black text-xl tabular-nums leading-none">
              {distanceM < 1000 ? `${distanceM}m` : `${(distanceM / 1000).toFixed(1)}km`}
            </div>
          </div>
        )}
      </div>

      {isArrived && (
        <div className="mt-2 rounded-xl bg-white/15 px-3 py-2 text-xs font-bold text-white text-center">
          Lieferung bestätigen und Zahlung abschließen
        </div>
      )}
    </div>
  );
}
