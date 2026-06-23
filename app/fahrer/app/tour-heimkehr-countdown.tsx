'use client';

import { useEffect, useState } from 'react';
import { Home, Clock, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Stop {
  id: string;
  geliefert_am: string | null;
}

interface Props {
  stops: Stop[];
  startedAt: string | null;
  totalEtaMin: number | null;
}

function formatMin(min: number): string {
  if (min <= 0) return '0 Min';
  if (min < 60) return `${min} Min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} Std` : `${h} Std ${m} Min`;
}

export function TourHeimkehrCountdown({ stops, startedAt, totalEtaMin }: Props) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(iv);
  }, []);

  if (!startedAt || !totalEtaMin || stops.length === 0) return null;

  const startMs = new Date(startedAt).getTime();
  const elapsedMin = Math.floor((now - startMs) / 60_000);
  const pendingStops = stops.filter((s) => !s.geliefert_am).length;
  const doneStops = stops.length - pendingStops;

  const remainMin = Math.max(0, totalEtaMin - elapsedMin);
  const progressPct = Math.min(100, Math.round((elapsedMin / totalEtaMin) * 100));

  const isLate = elapsedMin > totalEtaMin;
  const isAlmostDone = remainMin <= 10 && pendingStops <= 1;

  if (pendingStops === 0) return null;

  return (
    <div className={cn(
      'rounded-2xl border-2 p-4',
      isLate ? 'border-red-400 bg-red-900/30' :
      isAlmostDone ? 'border-matcha-400 bg-matcha-900/30' : 'border-white/20 bg-white/10',
    )}>
      <div className="flex items-center gap-2 mb-3">
        <div className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full',
          isLate ? 'bg-red-500 text-white' :
          isAlmostDone ? 'bg-matcha-500 text-white' : 'bg-white/20 text-white',
        )}>
          <Home className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-bold text-white">
            {isAlmostDone ? 'Fast zu Hause!' : isLate ? 'Tour überfällig' : 'Heimkehr-Timer'}
          </div>
          <div className="text-[10px] text-white/70">
            {doneStops}/{stops.length} Stopps erledigt
          </div>
        </div>
        <div className="ml-auto text-right">
          <div className={cn(
            'text-2xl font-black tabular-nums leading-none',
            isLate ? 'text-red-300' : isAlmostDone ? 'text-matcha-300' : 'text-white',
          )}>
            {isLate ? `+${elapsedMin - totalEtaMin}` : formatMin(remainMin)}
          </div>
          <div className="text-[9px] text-white/60">{isLate ? 'Min überfällig' : 'verbleibend'}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 rounded-full bg-white/20 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-1000',
            isLate ? 'bg-red-400' : isAlmostDone ? 'bg-matcha-400' : 'bg-blue-400',
          )}
          style={{ width: `${Math.min(100, progressPct)}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[10px] text-white/60 flex items-center gap-1">
          <Clock className="h-3 w-3" /> {elapsedMin} Min unterwegs
        </span>
        <span className="text-[10px] text-white/60">
          {pendingStops} Stop{pendingStops !== 1 ? 'ps' : ''} übrig
        </span>
      </div>

      {isAlmostDone && (
        <div className="mt-2 flex items-center gap-1.5 rounded-xl bg-matcha-700/40 px-3 py-2">
          <CheckCircle2 className="h-4 w-4 text-matcha-300 shrink-0" />
          <span className="text-xs font-bold text-matcha-200">Letzter Stopp — gleich fertig!</span>
        </div>
      )}
    </div>
  );
}
