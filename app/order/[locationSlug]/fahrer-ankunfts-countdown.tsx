'use client';

import { useEffect, useState } from 'react';
import { Bike, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  etaMin: number | null;
  status: string | null;
}

export function FahrerAnkunftsCountdown({ etaMin, status }: Props) {
  const [secsLeft, setSecsLeft] = useState<number | null>(
    etaMin != null ? etaMin * 60 : null,
  );

  // Sync if etaMin prop changes
  useEffect(() => {
    if (etaMin != null) setSecsLeft(etaMin * 60);
  }, [etaMin]);

  // Countdown tick
  useEffect(() => {
    if (secsLeft == null || secsLeft <= 0) return;
    const t = setInterval(() => setSecsLeft((s) => (s != null && s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [secsLeft != null && secsLeft > 0 ? 1 : 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const isEnRoute = status === 'unterwegs' || status === 'out_for_delivery' || status === 'picked_up';
  const isDelivered = status === 'geliefert' || status === 'delivered' || status === 'completed';

  // Only show when driver is en route and ETA ≤ 5 min (300s)
  if (!isEnRoute && !isDelivered) return null;
  if (isDelivered) {
    return (
      <div className="rounded-2xl border-2 border-emerald-400 bg-emerald-50 px-5 py-4 flex items-center gap-4 shadow-lg">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <div>
          <div className="text-base font-black text-emerald-800">Geliefert!</div>
          <div className="text-sm text-emerald-600">Guten Appetit 🍽️</div>
        </div>
      </div>
    );
  }

  const mins = secsLeft != null ? Math.floor(secsLeft / 60) : null;
  const secs = secsLeft != null ? secsLeft % 60 : null;
  const isClose = secsLeft != null && secsLeft <= 300; // ≤ 5 Min
  const isVeryClose = secsLeft != null && secsLeft <= 60; // ≤ 1 Min

  return (
    <div className={cn(
      'rounded-2xl border-2 px-5 py-4 shadow-md transition-all',
      isVeryClose
        ? 'border-emerald-500 bg-emerald-50 animate-pulse'
        : isClose
        ? 'border-matcha-400 bg-matcha-50'
        : 'border-blue-300 bg-blue-50',
    )}>
      <div className="flex items-center gap-4">
        {/* Animated bike icon */}
        <div className={cn(
          'flex h-12 w-12 shrink-0 items-center justify-center rounded-full',
          isVeryClose ? 'bg-emerald-500 text-white' : isClose ? 'bg-matcha-500 text-white' : 'bg-blue-500 text-white',
        )}>
          <Bike className={cn('h-6 w-6', isVeryClose && 'animate-bounce')} />
        </div>

        <div className="flex-1 min-w-0">
          <div className={cn(
            'text-xs font-bold uppercase tracking-widest mb-0.5',
            isVeryClose ? 'text-emerald-700' : isClose ? 'text-matcha-700' : 'text-blue-700',
          )}>
            {isVeryClose ? 'Fahrer ist fast da!' : isClose ? 'Fahrer kommt gleich' : 'Fahrer ist unterwegs'}
          </div>

          {/* Countdown display */}
          {secsLeft != null && secsLeft > 0 ? (
            <div className="flex items-baseline gap-1">
              {isClose ? (
                <>
                  <span className={cn(
                    'font-display font-black tabular-nums leading-none',
                    isVeryClose ? 'text-4xl text-emerald-700' : 'text-3xl text-matcha-700',
                  )}>
                    {mins != null && mins > 0 ? `${mins}:${String(secs ?? 0).padStart(2, '0')}` : `0:${String(secs ?? 0).padStart(2, '0')}`}
                  </span>
                  <span className="text-sm text-muted-foreground">Min</span>
                </>
              ) : (
                <>
                  <span className="font-display font-black text-2xl tabular-nums text-blue-700 leading-none">
                    ~{mins}
                  </span>
                  <span className="text-sm text-muted-foreground">Minuten</span>
                </>
              )}
            </div>
          ) : secsLeft === 0 ? (
            <div className="text-lg font-black text-emerald-700 animate-pulse">Gleich da!</div>
          ) : (
            <div className="text-sm font-bold text-blue-700">Auf dem Weg…</div>
          )}
        </div>
      </div>

      {/* Progress bar for close delivery */}
      {isClose && secsLeft != null && secsLeft > 0 && (
        <div className="mt-3 h-1.5 rounded-full bg-black/10 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-1000',
              isVeryClose ? 'bg-emerald-500' : 'bg-matcha-500',
            )}
            style={{ width: `${Math.max(2, 100 - (secsLeft / 300) * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
