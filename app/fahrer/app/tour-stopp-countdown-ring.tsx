'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, MapPin, Navigation } from 'lucide-react';

interface Props {
  etaMin: number | null;
  stopNummer: number;
  gesamtStops: number;
  adresse: string;
  kundeVorname: string;
  distanzKm: number | null;
  onNavigate?: () => void;
}

const RING_RADIUS = 40;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export function TourStoppCountdownRing({
  etaMin, stopNummer, gesamtStops, adresse, kundeVorname, distanzKm, onNavigate,
}: Props) {
  const [secsLeft, setSecsLeft] = useState<number | null>(
    etaMin !== null ? etaMin * 60 : null,
  );
  const [initialSecs] = useState<number | null>(
    etaMin !== null ? etaMin * 60 : null,
  );

  useEffect(() => {
    if (secsLeft === null) return;
    if (secsLeft <= 0) return;
    const iv = setInterval(() => setSecsLeft((s) => (s !== null ? Math.max(0, s - 1) : null)), 1000);
    return () => clearInterval(iv);
  }, [secsLeft]);

  const progress = initialSecs && secsLeft !== null
    ? Math.max(0, Math.min(1, (initialSecs - secsLeft) / initialSecs))
    : 0;

  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);

  const ringColor = secsLeft !== null
    ? secsLeft < 120 ? '#ef4444' : secsLeft < 300 ? '#f59e0b' : '#4d7c35'
    : '#4d7c35';

  const displayTime = secsLeft !== null
    ? secsLeft < 60
      ? `${secsLeft}s`
      : `${Math.floor(secsLeft / 60)}:${String(secsLeft % 60).padStart(2, '0')}`
    : '--';

  const statusText = secsLeft === null
    ? 'Navigiere'
    : secsLeft === 0
    ? 'Angekommen!'
    : secsLeft < 120
    ? 'Fast da!'
    : secsLeft < 300
    ? 'Bald ankommen'
    : 'Unterwegs';

  return (
    <div className="rounded-2xl border-2 border-matcha-200 bg-white p-4 flex gap-4 items-center">
      {/* Ring timer */}
      <div className="relative flex-shrink-0 flex items-center justify-center">
        <svg width="96" height="96" viewBox="0 0 96 96" className="-rotate-90">
          {/* Background circle */}
          <circle
            cx="48" cy="48" r={RING_RADIUS}
            fill="none"
            stroke="#e7e5e4"
            strokeWidth="8"
          />
          {/* Progress circle */}
          <circle
            cx="48" cy="48" r={RING_RADIUS}
            fill="none"
            stroke={ringColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-lg font-black tabular-nums leading-none"
            style={{ color: ringColor }}
          >
            {secsLeft === 0 ? <CheckCircle2 className="h-6 w-6" /> : displayTime}
          </span>
          <span className="text-[9px] text-stone-400 font-semibold mt-0.5">
            {stopNummer}/{gesamtStops}
          </span>
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span
            className="text-xs font-black uppercase tracking-wider"
            style={{ color: ringColor }}
          >
            {statusText}
          </span>
          <span className="text-[9px] text-stone-400 font-semibold">
            Stopp {stopNummer} von {gesamtStops}
          </span>
        </div>

        <div className="text-sm font-bold text-stone-800 truncate">{kundeVorname}</div>
        <div className="flex items-center gap-1 mt-0.5">
          <MapPin className="h-3 w-3 text-stone-400 shrink-0" />
          <span className="text-[11px] text-stone-500 truncate">{adresse}</span>
        </div>

        {distanzKm !== null && (
          <div className="flex items-center gap-1 mt-1">
            <Clock className="h-3 w-3 text-stone-400" />
            <span className="text-[11px] text-stone-500">{distanzKm.toFixed(1)} km entfernt</span>
          </div>
        )}

        {/* Navigate button */}
        <button
          onClick={onNavigate}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 py-2 text-xs font-bold text-white active:scale-95 transition-transform"
        >
          <Navigation className="h-3.5 w-3.5" />
          Navigation starten
        </button>
      </div>
    </div>
  );
}
