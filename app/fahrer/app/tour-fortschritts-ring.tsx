'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  stops: {
    id: string;
    geliefert_am: string | null;
    reihenfolge: number;
  }[];
  batchStartedAt: string | null;
  totalEtaMin: number | null;
}

function useSecTick() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
  return t;
}

function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const RING_SIZE = 180;
const STROKE_W = 12;
const RADIUS = (RING_SIZE - STROKE_W) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CX = RING_SIZE / 2;
const CY = RING_SIZE / 2;

export function TourFortschrittsRing({ stops, batchStartedAt, totalEtaMin }: Props) {
  useSecTick();

  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const total = sorted.length;
  const completed = sorted.filter((s) => s.geliefert_am != null).length;
  const allDone = total > 0 && completed >= total;

  const pct = total > 0 ? completed / total : 0;
  const dashOffset = CIRCUMFERENCE - pct * CIRCUMFERENCE;

  // Time since start
  const elapsedSec = batchStartedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(batchStartedAt).getTime()) / 1000))
    : 0;

  // ETA remaining
  const etaSec = totalEtaMin != null ? totalEtaMin * 60 : null;
  const remainSec = etaSec != null ? Math.max(0, etaSec - elapsedSec) : null;
  const remainMin = remainSec != null ? Math.ceil(remainSec / 60) : null;
  const isOverdue = etaSec != null && elapsedSec > etaSec && !allDone;

  const ringColor = allDone ? '#4ade80' : isOverdue ? '#f87171' : '#4ade80';
  const trackColor = 'rgba(255,255,255,0.08)';

  return (
    <div className="flex flex-col items-center gap-4 bg-matcha-900 rounded-2xl px-6 py-6">

      {/* SVG donut ring */}
      <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          className="-rotate-90"
          style={{ position: 'absolute', inset: 0 }}
        >
          {/* Track */}
          <circle
            cx={CX}
            cy={CY}
            r={RADIUS}
            fill="none"
            stroke={trackColor}
            strokeWidth={STROKE_W}
          />
          {/* Progress arc */}
          <circle
            cx={CX}
            cy={CY}
            r={RADIUS}
            fill="none"
            stroke={ringColor}
            strokeWidth={STROKE_W}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s' }}
          />
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
          {allDone ? (
            <CheckCircle2 className="text-matcha-400" size={48} />
          ) : (
            <>
              <div className="text-white font-black leading-none" style={{ fontSize: '2.8rem' }}>
                {completed}
                <span className="text-matcha-400 font-bold" style={{ fontSize: '1.4rem' }}>
                  /{total}
                </span>
              </div>
              <div className="text-matcha-400 text-[11px] font-bold uppercase tracking-widest mt-1">
                Stopps
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status line */}
      <div className={cn(
        'text-base font-bold text-center',
        allDone ? 'text-matcha-300' : 'text-white',
      )}>
        {allDone
          ? 'Tour abgeschlossen!'
          : `${total - completed} Stopp${total - completed !== 1 ? 's' : ''} verbleibend`}
      </div>

      {/* Time badges */}
      <div className="flex items-center gap-3 flex-wrap justify-center">
        {batchStartedAt && (
          <div className="flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/70">
            <Clock size={12} className="text-matcha-400" />
            <span className="tabular-nums">{formatDuration(elapsedSec)}</span>
            <span className="text-white/40">seit Start</span>
          </div>
        )}
        {remainMin != null && !allDone && (
          <div className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold',
            isOverdue
              ? 'bg-red-500/20 text-red-300'
              : remainMin <= 5
              ? 'bg-orange-500/20 text-orange-300'
              : 'bg-matcha-700/40 text-matcha-300',
          )}>
            <Clock size={12} />
            {isOverdue
              ? `${Math.ceil((elapsedSec - (etaSec ?? 0)) / 60)} Min über ETA`
              : `~${remainMin} Min übrig`}
          </div>
        )}
      </div>

      {/* Stop dots */}
      {total > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          {sorted.map((s) => {
            const done = s.geliefert_am != null;
            return (
              <div
                key={s.id}
                title={`Stopp ${s.reihenfolge}`}
                className={cn(
                  'rounded-full transition-all duration-500',
                  done
                    ? 'bg-matcha-400 w-3 h-3'
                    : 'bg-white/20 w-2.5 h-2.5',
                )}
              />
            );
          })}
        </div>
      )}

    </div>
  );
}
