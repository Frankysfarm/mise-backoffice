'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, MapPin, Zap } from 'lucide-react';

/* ── Props ───────────────────────────────────────────────────────────────────── */

interface Props {
  etaEarliest: string | null;
  driverName: string | null;
  isOnTheWay: boolean;
  secRemain: number | null;
}

/* ── Component ─────────────────────────────────────────────────────────────── */

/**
 * Shows an animated driver-approach card when the driver is less than 5 minutes away.
 * Becomes more urgent/animated as the driver gets closer.
 */
export function LiveFahrerAnnaeherung({ etaEarliest, driverName, isOnTheWay, secRemain }: Props) {
  const [pulseCount, setPulseCount] = useState(0);
  const pulseRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const minsLeft = secRemain !== null ? Math.ceil(secRemain / 60) : null;
  const isVeryClose   = minsLeft !== null && minsLeft <= 2;
  const isClose       = minsLeft !== null && minsLeft <= 5;
  const isApproaching = isOnTheWay && isClose && etaEarliest;

  /* Pulse counter for the wave rings */
  useEffect(() => {
    if (!isApproaching) { if (pulseRef.current) clearInterval(pulseRef.current); return; }
    pulseRef.current = setInterval(() => setPulseCount(c => c + 1), isVeryClose ? 800 : 1_500);
    return () => { if (pulseRef.current) clearInterval(pulseRef.current); };
  }, [isApproaching, isVeryClose]);

  if (!isApproaching) return null;

  const urgencyRing  = isVeryClose ? 'bg-red-500'    : 'bg-matcha-500';
  const urgencyOuter = isVeryClose ? 'bg-red-400/30' : 'bg-matcha-400/20';
  const urgencyText  = isVeryClose ? 'text-red-700'  : 'text-matcha-700';
  const urgencyBg    = isVeryClose ? 'bg-red-50 border-red-200' : 'bg-matcha-50 border-matcha-200';
  const label        = isVeryClose
    ? 'Fahrer ist gleich da!'
    : `${driverName ?? 'Fahrer'} ist ${minsLeft} min entfernt`;

  return (
    <div className={cn('rounded-2xl border p-4', urgencyBg)}>
      <div className="flex items-center gap-4">
        {/* Animated driver icon with pulse rings */}
        <div className="relative flex-shrink-0 flex items-center justify-center h-14 w-14">
          {/* Outer pulse ring */}
          <span
            key={`outer-${pulseCount}`}
            className={cn(
              'absolute inset-0 rounded-full animate-ping opacity-0',
              urgencyOuter,
            )}
            style={{ animationDuration: isVeryClose ? '0.8s' : '1.5s' }}
          />
          {/* Middle ring */}
          <span
            key={`mid-${pulseCount}`}
            className={cn(
              'absolute inset-2 rounded-full animate-ping opacity-0',
              urgencyOuter,
            )}
            style={{ animationDuration: isVeryClose ? '0.8s' : '1.5s', animationDelay: '0.2s' }}
          />
          {/* Core icon */}
          <div className={cn('relative z-10 flex h-10 w-10 items-center justify-center rounded-full', urgencyRing)}>
            <Bike className="h-5 w-5 text-white" />
          </div>
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <Zap className={cn('h-3.5 w-3.5 flex-shrink-0', urgencyText)} />
            <span className={cn('text-sm font-bold', urgencyText)}>{label}</span>
          </div>
          {isVeryClose ? (
            <p className="text-xs text-red-600">Bitte zur Tür gehen!</p>
          ) : (
            <div className="flex items-center gap-1 text-[10px] text-matcha-500">
              <MapPin className="h-2.5 w-2.5" />
              <span>Auf dem Weg zu dir</span>
            </div>
          )}

          {/* Countdown bar */}
          {secRemain !== null && (
            <div className="mt-1.5 h-1.5 rounded-full bg-white/70 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-1000',
                  isVeryClose ? 'bg-red-500' : 'bg-matcha-500',
                )}
                style={{ width: `${Math.max(0, 100 - Math.round((secRemain / (5 * 60)) * 100))}%` }}
              />
            </div>
          )}
        </div>

        {/* Big countdown */}
        {minsLeft !== null && minsLeft > 0 && (
          <div className="flex-shrink-0 text-right">
            <div className={cn('text-3xl font-black tabular-nums leading-none', urgencyText)}>
              {minsLeft}
            </div>
            <div className="text-[9px] text-matcha-400 uppercase tracking-wide">min</div>
          </div>
        )}
        {minsLeft !== null && minsLeft <= 0 && (
          <div className="flex-shrink-0">
            <span className={cn('text-sm font-black', urgencyText)}>Jetzt!</span>
          </div>
        )}
      </div>
    </div>
  );
}
