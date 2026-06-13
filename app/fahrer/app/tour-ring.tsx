'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, MapPin } from 'lucide-react';

export type TourProgressRingProps = {
  totalStops: number;
  completedStops: number;
  distanceKm: number | null;
  startedAt: string | null;
  totalEtaMin: number | null;
};

function useSecTick() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
  return t;
}

export function TourProgressRing({
  totalStops,
  completedStops,
  distanceKm,
  startedAt,
  totalEtaMin,
}: TourProgressRingProps) {
  useSecTick();

  const size = 140;
  const strokeW = 9;
  const r = (size - strokeW) / 2;
  const circ = 2 * Math.PI * r;
  const pct = totalStops > 0 ? completedStops / totalStops : 0;
  const dash = pct * circ;
  const allDone = completedStops >= totalStops && totalStops > 0;

  const elapsedSec = startedAt
    ? Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
    : 0;
  const elapsedMin = Math.floor(elapsedSec / 60);

  const etaSec = totalEtaMin != null ? totalEtaMin * 60 : null;
  const remainSec = etaSec != null ? Math.max(0, etaSec - elapsedSec) : null;
  const remainMin = remainSec != null ? Math.ceil(remainSec / 60) : null;

  return (
    <div className="flex flex-col items-center gap-3 py-4">
      {/* Ring */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
          style={{ position: 'absolute', inset: 0 }}
        >
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.1)"
            strokeWidth={strokeW}
          />
          {/* Progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={allDone ? '#4ae68a' : pct > 0.5 ? '#4ae68a' : '#f59e0b'}
            strokeWidth={strokeW}
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={circ - dash}
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s' }}
          />
        </svg>
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {allDone ? (
            <CheckCircle2 className="h-10 w-10 text-accent" />
          ) : (
            <>
              <div className="font-display font-black text-3xl leading-none text-white">
                {completedStops}
                <span className="text-lg text-matcha-300">/{totalStops}</span>
              </div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-matcha-400 mt-0.5">
                Stopps
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status label */}
      <div className={cn(
        'text-sm font-bold',
        allDone ? 'text-accent' : 'text-matcha-100',
      )}>
        {allDone
          ? 'Alle Lieferungen abgeschlossen!'
          : `${totalStops - completedStops} Stopp${totalStops - completedStops !== 1 ? 's' : ''} verbleibend`}
      </div>

      {/* Meta badges */}
      <div className="flex items-center gap-3 flex-wrap justify-center">
        {distanceKm != null && distanceKm > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-matcha-200">
            <MapPin className="h-3 w-3" />
            {distanceKm.toFixed(1)} km
          </div>
        )}
        {elapsedMin > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold text-matcha-200">
            <Clock className="h-3 w-3" />
            {elapsedMin} Min unterwegs
          </div>
        )}
        {remainMin != null && !allDone && (
          <div className={cn(
            'flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold',
            remainMin <= 5 ? 'bg-red-500/20 text-red-200' :
            remainMin <= 15 ? 'bg-amber-500/20 text-amber-200' :
            'bg-accent/15 text-accent',
          )}>
            ~{remainMin} Min bis Ende
          </div>
        )}
      </div>
    </div>
  );
}
