'use client';

// Phase 344: FahrerSchichtEnergieCheck — Erschöpfungsindikator + Pausenempfehlung

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  onlineSeit: string | null;
  stopsErledigt: number;
}

type Energielevel = 'frisch' | 'gut' | 'pause';

function getLevel(hoursActive: number, stops: number): Energielevel {
  if (hoursActive > 4 || stops > 10) return 'pause';
  if (hoursActive >= 2 || stops >= 5) return 'gut';
  return 'frisch';
}

export function FahrerSchichtEnergieCheck({ onlineSeit, stopsErledigt }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(iv);
  }, []);

  if (!onlineSeit) return null;

  const startMs = new Date(onlineSeit).getTime();
  const elapsedMs = now - startMs;
  const elapsedMin = elapsedMs / 60_000;

  if (elapsedMin < 30) return null;

  const hoursActive = elapsedMs / 3_600_000;
  const level = getLevel(hoursActive, stopsErledigt);

  const hoursDisplay = Math.floor(hoursActive);
  const minutesDisplay = Math.floor((hoursActive - hoursDisplay) * 60);

  const countdownToBreak =
    hoursActive > 3
      ? null
      : Math.max(0, Math.ceil((3 * 60) - elapsedMin));

  const levelConfig: Record<Energielevel, { label: string; desc: string; pulse: string; dot: string }> = {
    frisch: {
      label: 'Frisch',
      desc: 'Du bist fit – weiter so!',
      pulse: 'bg-green-500',
      dot: 'bg-green-400',
    },
    gut: {
      label: 'Gut',
      desc: 'Gute Energie – bleib konzentriert.',
      pulse: 'bg-amber-400',
      dot: 'bg-amber-300',
    },
    pause: {
      label: 'Erholungspause empfohlen',
      desc: 'Du bist schon lange aktiv. Bitte mach eine kurze Pause.',
      pulse: 'bg-red-500',
      dot: 'bg-red-400',
    },
  };

  const cfg = levelConfig[level];

  return (
    <div className="rounded-xl bg-gray-900 border border-gray-700 p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="relative flex-shrink-0">
          <div className={cn('w-3 h-3 rounded-full', cfg.dot)} />
          <div className={cn('absolute inset-0 rounded-full animate-ping opacity-60', cfg.pulse)} />
        </div>
        <span className="text-white text-sm font-semibold">{cfg.label}</span>
        <span className="ml-auto text-gray-400 text-xs">
          {hoursDisplay > 0 ? `${hoursDisplay}h ` : ''}{minutesDisplay}min aktiv
        </span>
      </div>
      <p className="text-gray-300 text-xs mb-2">{cfg.desc}</p>
      {countdownToBreak !== null && countdownToBreak > 0 && (
        <p className="text-gray-500 text-xs">
          Empfohlene Pause in {countdownToBreak} min
        </p>
      )}
      <div className="mt-2 flex gap-3 text-xs text-gray-400">
        <span>Stops: {stopsErledigt}</span>
      </div>
    </div>
  );
}
