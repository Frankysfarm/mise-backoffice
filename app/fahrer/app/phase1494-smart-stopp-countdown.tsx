'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Navigation2, MapPin, Clock, CheckCircle2 } from 'lucide-react';

// Phase 1494 — Smart-Stopp-Countdown (Fahrer-App)
// Zeigt den nächsten Stopp mit Distanz, ETA-Ring (SVG), Countdown und
// direktem Navigations-Button. isOnline-Guard. 10s-Tick. Nach Phase 1489.

interface Stop {
  id: string;
  address?: string | null;
  customer_name?: string | null;
  estimated_arrival?: string | null;
  distance_km?: number | null;
  geliefert_am?: string | null;
  sequence?: number | null;
}

interface Props {
  isOnline: boolean;
  nextStop: Stop | null;
  totalStops: number;
  doneStops: number;
}

const RING_SIZE = 72;
const RING_STROKE = 7;
const RING_R = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRC = 2 * Math.PI * RING_R;

function getCountdown(isoStr: string): { min: number; sec: number; totalSec: number } {
  const diff = Math.max(0, new Date(isoStr).getTime() - Date.now());
  const totalSec = Math.floor(diff / 1000);
  return { min: Math.floor(totalSec / 60), sec: totalSec % 60, totalSec };
}

function openNavigation(address: string) {
  const query = encodeURIComponent(address);
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad/.test(ua)) {
    window.open(`maps://maps.apple.com/?q=${query}`, '_blank');
  } else {
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  }
}

export function FahrerPhase1494SmartStoppCountdown({ isOnline, nextStop, totalStops, doneStops }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 1_000);
    return () => clearInterval(iv);
  }, []);

  if (!isOnline || !nextStop) return null;

  const hasEta = !!nextStop.estimated_arrival;
  const countdown = hasEta ? getCountdown(nextStop.estimated_arrival!) : null;

  // Ring progress: based on done vs total stops
  const ringPct = totalStops > 0 ? doneStops / totalStops : 0;
  const dashOffset = RING_CIRC * (1 - ringPct);

  // Color based on remaining time
  let ringColor = '#10b981'; // emerald
  let textColor = 'text-emerald-400';
  let urgency = 'ok';
  if (countdown) {
    if (countdown.totalSec < 120) { ringColor = '#f43f5e'; textColor = 'text-rose-400'; urgency = 'kritisch'; }
    else if (countdown.totalSec < 300) { ringColor = '#f97316'; textColor = 'text-orange-400'; urgency = 'dringend'; }
    else if (countdown.totalSec < 600) { ringColor = '#fbbf24'; textColor = 'text-amber-400'; urgency = 'bald'; }
  }

  return (
    <div className={cn(
      'rounded-2xl border p-4 space-y-3 transition-all',
      urgency === 'kritisch'
        ? 'bg-rose-950/60 border-rose-700 animate-pulse'
        : urgency === 'dringend'
        ? 'bg-orange-950/40 border-orange-700'
        : 'bg-slate-900/80 border-slate-700',
    )}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Navigation2 className="h-4 w-4 text-sky-400" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
          Nächster Stopp
        </span>
        <span className="ml-auto text-[10px] font-semibold text-slate-500 tabular-nums">
          {doneStops + 1}/{totalStops}
        </span>
      </div>

      {/* Ring + info */}
      <div className="flex items-center gap-4">
        {/* SVG Ring */}
        <div className="relative shrink-0">
          <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
            <circle
              cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
              fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={RING_STROKE}
            />
            <circle
              cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_R}
              fill="none" strokeWidth={RING_STROKE} strokeLinecap="round"
              strokeDasharray={RING_CIRC} strokeDashoffset={dashOffset}
              stroke={ringColor}
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {countdown ? (
              <>
                <span className={cn('text-sm font-black tabular-nums leading-tight', textColor)}>
                  {countdown.min}:{String(countdown.sec).padStart(2, '0')}
                </span>
                <span className="text-[8px] text-slate-500 uppercase tracking-wide">Min</span>
              </>
            ) : (
              <MapPin className="h-5 w-5 text-slate-400" />
            )}
          </div>
        </div>

        {/* Address + details */}
        <div className="flex-1 min-w-0 space-y-1">
          {nextStop.customer_name && (
            <div className="text-[10px] font-semibold text-slate-400 truncate">
              {nextStop.customer_name}
            </div>
          )}
          <div className="text-sm font-bold text-white leading-snug truncate">
            {nextStop.address ?? 'Adresse nicht verfügbar'}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-slate-400">
            {nextStop.distance_km != null && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {nextStop.distance_km.toFixed(1)} km
              </span>
            )}
            {countdown && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                ~{countdown.min} Min
              </span>
            )}
            <span className="flex items-center gap-1 text-emerald-500">
              <CheckCircle2 className="h-3 w-3" />
              {doneStops} erledigt
            </span>
          </div>
        </div>
      </div>

      {/* Navigation button */}
      {nextStop.address && (
        <button
          onClick={() => openNavigation(nextStop.address!)}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white text-sm font-bold py-2.5 transition-colors"
        >
          <Navigation2 className="h-4 w-4" />
          Navigieren
        </button>
      )}
    </div>
  );
}
