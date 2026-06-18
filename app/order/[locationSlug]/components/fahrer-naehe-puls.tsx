'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Clock, MapPin } from 'lucide-react';

interface Props {
  status: string;
  etaLatest: string | null;
  driverName: string | null;
  driverLat?: number | null;
  driverLng?: number | null;
  orderLat?: number | null;
  orderLng?: number | null;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getCountdownInfo(etaLatest: string): { label: string; secs: number; isClose: boolean } {
  const diffMs = new Date(etaLatest).getTime() - Date.now();
  const secs = Math.floor(diffMs / 1000);
  if (secs <= 0) return { label: 'Kommt gleich an!', secs: 0, isClose: true };
  const mins = Math.floor(secs / 60);
  if (mins < 1) {
    const s = secs % 60;
    return { label: `0:${String(s).padStart(2, '0')}`, secs, isClose: true };
  }
  if (mins <= 10) {
    const s = secs % 60;
    return { label: `${mins}:${String(s).padStart(2, '0')} Min`, secs, isClose: mins <= 3 };
  }
  return { label: `ca. ${mins} Min`, secs, isClose: false };
}

export function FahrerNaehePuls({
  status, etaLatest, driverName,
  driverLat, driverLng, orderLat, orderLng,
}: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (status !== 'unterwegs') return;
    const iv = setInterval(() => setTick((n) => n + 1), 1_000);
    return () => clearInterval(iv);
  }, [status]);

  if (status !== 'unterwegs') return null;

  const displayName = driverName ?? 'Dein Fahrer';

  const countdownInfo = etaLatest ? getCountdownInfo(etaLatest) : null;
  const isArriving = countdownInfo ? countdownInfo.secs <= 0 : false;
  const isClose = countdownInfo?.isClose ?? false;

  const distKm =
    driverLat != null && driverLng != null && orderLat != null && orderLng != null
      ? haversineKm(driverLat, driverLng, orderLat, orderLng)
      : null;

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors duration-500',
      isArriving
        ? 'border-matcha-400 bg-matcha-100 text-matcha-900'
        : isClose
        ? 'border-amber-300 bg-amber-50 text-amber-900'
        : 'border-matcha-200 bg-matcha-50 text-matcha-800',
    )}>
      {/* Pulsierender Punkt */}
      <span className="relative flex h-3 w-3 shrink-0">
        <span className={cn(
          'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
          isClose ? 'bg-amber-500' : 'bg-matcha-500',
        )} />
        <span className={cn(
          'relative inline-flex h-3 w-3 rounded-full',
          isClose ? 'bg-amber-500' : 'bg-matcha-500',
        )} />
      </span>

      {/* Fahrername + Status */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Bike className={cn('h-4 w-4 shrink-0', isClose ? 'text-amber-600' : 'text-matcha-600')} />
          <span className={cn(
            'text-sm font-black truncate',
            isArriving ? 'text-matcha-900' : isClose ? 'text-amber-900' : 'text-matcha-800',
          )}>
            {isArriving ? `${displayName} ist da!` : `${displayName} ist unterwegs`}
          </span>
        </div>

        <div className="mt-0.5 flex items-center gap-2 flex-wrap">
          {countdownInfo && (
            <div className={cn(
              'flex items-center gap-1 text-[11px] font-bold tabular-nums',
              isArriving ? 'text-matcha-700' : isClose ? 'text-amber-700' : 'text-matcha-600',
            )}>
              <Clock className="h-3 w-3 shrink-0" />
              <span>{countdownInfo.label}</span>
            </div>
          )}
          {distKm !== null && distKm > 0.05 && (
            <div className="flex items-center gap-1 text-[11px] text-matcha-500">
              <MapPin className="h-3 w-3 shrink-0" />
              <span>~{distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`}</span>
            </div>
          )}
        </div>
      </div>

      {/* Urgency-Badge */}
      {isClose && !isArriving && (
        <div className="shrink-0 rounded-full bg-amber-500 px-2.5 py-1 text-[10px] font-black text-white animate-pulse">
          Gleich da!
        </div>
      )}
    </div>
  );
}
