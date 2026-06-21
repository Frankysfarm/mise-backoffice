'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  batchId: string;
  totalEtaMin: number;
  startedAt: string;
}

type AmpelColor = 'gruen' | 'amber' | 'rot';

function getAmpelColor(elapsed: number, total: number): AmpelColor {
  if (total <= 0) return 'gruen';
  if (elapsed < total * 0.7) return 'gruen';
  if (elapsed < total * 0.95) return 'amber';
  return 'rot';
}

function formatTime(minutes: number): string {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = Math.floor(abs % 60);
  const s = Math.floor((abs * 60) % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const AMPEL_STYLES: Record<AmpelColor, { bg: string; text: string; ring: string; dot: string; label: string }> = {
  gruen: {
    bg: 'bg-matcha-50 border-matcha-300',
    text: 'text-matcha-700',
    ring: '#5c7a4e',
    dot: 'bg-[#5c7a4e]',
    label: 'Im Zeitplan',
  },
  amber: {
    bg: 'bg-amber-50 border-amber-300',
    text: 'text-amber-700',
    ring: '#d97706',
    dot: 'bg-amber-500',
    label: 'Knapp',
  },
  rot: {
    bg: 'bg-red-50 border-red-300',
    text: 'text-red-700',
    ring: '#ef4444',
    dot: 'bg-red-500',
    label: 'Überzug',
  },
};

export function TourZeitfensterAmpel({ batchId: _batchId, totalEtaMin, startedAt }: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, []);

  const startMs = startedAt ? new Date(startedAt).getTime() : nowMs;
  const elapsedMin = (nowMs - startMs) / 60_000;
  const remainingMin = totalEtaMin - elapsedMin;
  const isOvertime = remainingMin < 0;

  const color = getAmpelColor(elapsedMin, totalEtaMin);
  const style = AMPEL_STYLES[color];

  // SVG progress ring
  const radius = 52;
  const circ = 2 * Math.PI * radius;
  const progress = Math.min(1, Math.max(0, elapsedMin / Math.max(totalEtaMin, 1)));
  const filled = progress * circ;

  return (
    <div className={cn('rounded-2xl border-2 p-5 flex flex-col items-center gap-4', style.bg)}>
      {/* Status dot + label */}
      <div className="flex items-center gap-2">
        <span className={cn('w-3 h-3 rounded-full animate-pulse', style.dot)} />
        <span className={cn('text-sm font-bold', style.text)}>{style.label}</span>
      </div>

      {/* Ring */}
      <svg width="132" height="132" viewBox="0 0 132 132">
        <circle cx="66" cy="66" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        <circle
          cx="66"
          cy="66"
          r={radius}
          fill="none"
          stroke={style.ring}
          strokeWidth="8"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.5s ease' }}
        />
        {/* Countdown text */}
        <text
          x="66"
          y="58"
          textAnchor="middle"
          fontSize="10"
          fill="#6b7280"
          fontWeight="500"
        >
          {isOvertime ? 'Überzug' : 'Verbleibend'}
        </text>
        <text
          x="66"
          y="78"
          textAnchor="middle"
          fontSize="20"
          fontWeight="800"
          fill={style.ring}
          fontFamily="monospace"
        >
          {isOvertime ? '+' : ''}{formatTime(Math.abs(remainingMin))}
        </text>
        <text
          x="66"
          y="96"
          textAnchor="middle"
          fontSize="9"
          fill="#9ca3af"
        >
          von {formatTime(totalEtaMin)} Min
        </text>
      </svg>

      {/* Stats row */}
      <div className="w-full flex justify-between text-xs text-stone-500">
        <span>Vergangen: <strong className={style.text}>{formatTime(elapsedMin)}</strong></span>
        <span>Gesamt: <strong>{totalEtaMin} Min</strong></span>
      </div>
    </div>
  );
}
