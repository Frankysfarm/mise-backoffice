'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

// Phase 1112 — Wartezeit-Fortschritts-Ring (Storefront)
// Visueller SVG-Kreisring 0–100% — wie weit ist die Lieferung fortgeschritten?

interface Props {
  orderId: string;
  orderedAt: string;         // ISO timestamp
  etaMinutes: number;        // initial ETA in minutes
  locationId: string;
}

type StatusPhase = 'bestätigt' | 'zubereitung' | 'unterwegs' | 'gleich_da' | 'geliefert';

const PHASE_LABELS: Record<StatusPhase, string> = {
  bestätigt: 'Bestätigt',
  zubereitung: 'In Zubereitung',
  unterwegs: 'Unterwegs',
  gleich_da: 'Gleich da!',
  geliefert: 'Geliefert ✓',
};

const PHASE_PCT: Record<StatusPhase, number> = {
  bestätigt: 10,
  zubereitung: 35,
  unterwegs: 65,
  gleich_da: 90,
  geliefert: 100,
};

function calcProgressFromTime(orderedAt: string, etaMinutes: number): { pct: number; phase: StatusPhase; minsLeft: number } {
  const start = new Date(orderedAt).getTime();
  const now = Date.now();
  const total = etaMinutes * 60_000;
  const elapsed = now - start;
  const raw = Math.min(100, Math.max(0, (elapsed / total) * 100));

  let phase: StatusPhase = 'bestätigt';
  if (raw >= 100) phase = 'geliefert';
  else if (raw >= 80) phase = 'gleich_da';
  else if (raw >= 40) phase = 'unterwegs';
  else if (raw >= 15) phase = 'zubereitung';

  const minsLeft = Math.max(0, Math.round((total - elapsed) / 60_000));
  return { pct: Math.round(raw), phase, minsLeft };
}

const R = 44;
const CIRCUMFERENCE = 2 * Math.PI * R;

function Ring({ pct, phase }: { pct: number; phase: StatusPhase }) {
  const strokeOffset = CIRCUMFERENCE - (pct / 100) * CIRCUMFERENCE;

  const strokeColor =
    phase === 'geliefert' ? '#22c55e'
    : phase === 'gleich_da' ? '#f59e0b'
    : phase === 'unterwegs' ? '#3b82f6'
    : phase === 'zubereitung' ? '#8b5cf6'
    : '#6b7280';

  return (
    <svg viewBox="0 0 100 100" className="w-28 h-28 -rotate-90" aria-hidden>
      {/* Background track */}
      <circle
        cx="50" cy="50" r={R}
        fill="none"
        stroke="currentColor"
        strokeWidth="8"
        className="text-muted"
      />
      {/* Progress arc */}
      <circle
        cx="50" cy="50" r={R}
        fill="none"
        stroke={strokeColor}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={strokeOffset}
        className="transition-all duration-1000 ease-in-out"
      />
    </svg>
  );
}

export function Phase1112WartezeitFortschrittsRing({ orderId, orderedAt, etaMinutes, locationId }: Props) {
  const [pct, setPct] = useState(0);
  const [phase, setPhase] = useState<StatusPhase>('bestätigt');
  const [minsLeft, setMinsLeft] = useState(etaMinutes);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const tick = useCallback(() => {
    const result = calcProgressFromTime(orderedAt, etaMinutes);
    setPct(result.pct);
    setPhase(result.phase);
    setMinsLeft(result.minsLeft);
  }, [orderedAt, etaMinutes]);

  useEffect(() => {
    tick();
    intervalRef.current = setInterval(tick, 10_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tick]);

  const strokeColor =
    phase === 'geliefert' ? 'text-emerald-500'
    : phase === 'gleich_da' ? 'text-amber-500'
    : phase === 'unterwegs' ? 'text-blue-500'
    : phase === 'zubereitung' ? 'text-violet-500'
    : 'text-gray-400';

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card p-5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Lieferfortschritt</p>

      <div className="relative flex items-center justify-center">
        <Ring pct={pct} phase={phase} />
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className={cn('text-2xl font-black tabular-nums', strokeColor)}>{pct}%</span>
          {phase !== 'geliefert' && (
            <span className="text-[10px] font-semibold text-muted-foreground tabular-nums">
              {minsLeft > 0 ? `~${minsLeft} Min` : 'Gleich!'}
            </span>
          )}
        </div>
      </div>

      {/* Phase label */}
      <div className={cn('rounded-full px-3 py-1 text-xs font-bold', strokeColor,
        phase === 'geliefert' ? 'bg-emerald-100 dark:bg-emerald-900/30'
        : phase === 'gleich_da' ? 'bg-amber-100 dark:bg-amber-900/30'
        : phase === 'unterwegs' ? 'bg-blue-100 dark:bg-blue-900/30'
        : phase === 'zubereitung' ? 'bg-violet-100 dark:bg-violet-900/30'
        : 'bg-gray-100 dark:bg-gray-800'
      )}>
        {PHASE_LABELS[phase]}
      </div>

      {/* Phase stepper */}
      <div className="flex items-center gap-1 w-full justify-center">
        {(Object.keys(PHASE_PCT) as StatusPhase[]).map((p, i, arr) => (
          <div key={p} className="flex items-center gap-1">
            <div className={cn(
              'h-1.5 w-1.5 rounded-full transition-colors',
              PHASE_PCT[p] <= pct ? strokeColor.replace('text-', 'bg-') : 'bg-muted'
            )} />
            {i < arr.length - 1 && <div className="h-px w-3 bg-muted" />}
          </div>
        ))}
      </div>
    </div>
  );
}
