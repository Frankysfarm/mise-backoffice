'use client';

import { useEffect, useRef, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  orderedAt: string | null;
  etaMinutes: number;
  orderType: string;
};

const RADIUS = 36;
const CIRC = 2 * Math.PI * RADIUS;

function ringColor(pct: number): string {
  if (pct <= 0.5) return '#4caf73'; // matcha green
  if (pct <= 0.8) return '#f59e0b'; // amber
  return '#ef4444'; // red
}

export function LiveWartezeitRing({ orderedAt, etaMinutes, orderType }: Props) {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!orderedAt) return;
    function tick() {
      const now = Date.now();
      const start = new Date(orderedAt!).getTime();
      setElapsed(Math.floor((now - start) / 1000));
    }
    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [orderedAt]);

  if (orderType !== 'lieferung' || !orderedAt) return null;

  const totalSec = etaMinutes * 60;
  const remainSec = Math.max(0, totalSec - elapsed);
  const remainMin = Math.ceil(remainSec / 60);
  const pct = totalSec > 0 ? Math.min(1, elapsed / totalSec) : 0;
  const dashOffset = CIRC * (1 - pct);
  const color = ringColor(pct);
  const done = remainSec === 0;

  return (
    <div className="flex flex-col items-center gap-2 py-4">
      <div className="relative">
        <svg width="96" height="96" className="-rotate-90">
          <circle
            cx="48" cy="48" r={RADIUS}
            fill="none"
            stroke="#f5f5f4"
            strokeWidth="8"
          />
          <circle
            cx="48" cy="48" r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {done ? (
            <span className="text-2xl">✓</span>
          ) : (
            <>
              <span className="text-xl font-black tabular-nums leading-none" style={{ color }}>
                {remainMin}
              </span>
              <span className="text-[10px] text-stone-500 font-semibold mt-0.5">min</span>
            </>
          )}
        </div>
      </div>

      <div className="text-center">
        <div className={cn('text-sm font-bold', done ? 'text-matcha-600' : 'text-stone-700')}>
          {done ? 'Lieferung unterwegs!' : `Noch ca. ${remainMin} Min`}
        </div>
        <div className="text-xs text-stone-400 flex items-center justify-center gap-1 mt-0.5">
          <Clock className="h-3 w-3" />
          Bestellt um {new Date(orderedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  );
}
