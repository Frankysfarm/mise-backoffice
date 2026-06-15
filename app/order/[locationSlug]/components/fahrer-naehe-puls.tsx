'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Clock } from 'lucide-react';

interface Props {
  status: string;
  etaLatest: string | null;
  driverName: string | null;
}

function getCountdownLabel(etaLatest: string): string {
  const diffMs = new Date(etaLatest).getTime() - Date.now();
  if (diffMs <= 0) return 'Kommt gleich an!';
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Kommt gleich an!';
  return `Ankunft in ${mins} Min`;
}

export function FahrerNaehePuls({ status, etaLatest, driverName }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (status !== 'unterwegs') return;
    const iv = setInterval(() => setTick((n) => n + 1), 1_000);
    return () => clearInterval(iv);
  }, [status]);

  if (status !== 'unterwegs') return null;

  const displayName = driverName ?? 'Dein Fahrer';

  const countdownLabel = etaLatest ? getCountdownLabel(etaLatest) : null;
  const isArriving     = etaLatest
    ? new Date(etaLatest).getTime() <= Date.now()
    : false;

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border px-4 py-3',
      'border-matcha-200 bg-matcha-50 text-matcha-800',
    )}>
      {/* Pulsierender Punkt */}
      <span className="relative flex h-3 w-3 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-matcha-500 opacity-60" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-matcha-500" />
      </span>

      {/* Fahrername + Status */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <Bike className="h-4 w-4 shrink-0 text-matcha-600" />
          <span className="text-sm font-black text-matcha-800 truncate">
            {displayName} ist unterwegs
          </span>
        </div>

        {countdownLabel && (
          <div className={cn(
            'mt-0.5 flex items-center gap-1 text-[11px] font-bold',
            isArriving ? 'text-matcha-700 font-black' : 'text-matcha-600',
          )}>
            <Clock className="h-3 w-3 shrink-0" />
            <span>{countdownLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}
