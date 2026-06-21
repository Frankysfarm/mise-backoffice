'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  orderId: string;
  etaMin: number;
  placedAt: string;
  status: string;
}

const VISIBLE_STATUSES = ['in_zubereitung', 'fertig', 'unterwegs'];

type RingColor = 'gruen' | 'amber' | 'rot';

function getRingColor(remainingPct: number): RingColor {
  if (remainingPct > 50) return 'gruen';
  if (remainingPct > 20) return 'amber';
  return 'rot';
}

const RING_STYLE: Record<RingColor, { stroke: string; text: string; bg: string }> = {
  gruen: { stroke: '#5c7a4e', text: 'text-matcha-700', bg: 'bg-matcha-50' },
  amber: { stroke: '#d97706', text: 'text-amber-700', bg: 'bg-amber-50' },
  rot: { stroke: '#ef4444', text: 'text-red-700', bg: 'bg-red-50' },
};

const STATUS_LABELS: Record<string, string> = {
  in_zubereitung: 'Wird zubereitet…',
  fertig: 'Bereit zur Abholung',
  unterwegs: 'Unterwegs zu dir',
};

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function EtaLiveProgressRing({ orderId: _orderId, etaMin, placedAt, status }: Props) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(interval);
  }, []);

  if (!VISIBLE_STATUSES.includes(status)) return null;

  const startMs = placedAt ? new Date(placedAt).getTime() : nowMs;
  const totalMs = etaMin * 60_000;
  const elapsedMs = nowMs - startMs;
  const remainingMs = Math.max(0, totalMs - elapsedMs);
  const remainingSeconds = Math.floor(remainingMs / 1_000);
  const elapsedPct = Math.min(100, (elapsedMs / totalMs) * 100);
  const remainingPct = 100 - elapsedPct;

  const color = getRingColor(remainingPct);
  const style = RING_STYLE[color];

  // SVG ring
  const radius = 48;
  const circ = 2 * Math.PI * radius;
  const filled = (elapsedPct / 100) * circ;

  const statusLabel = STATUS_LABELS[status] ?? status;

  return (
    <div className={cn('flex flex-col items-center gap-3 rounded-2xl p-5', style.bg)}>
      {/* Ring */}
      <svg width="120" height="120" viewBox="0 0 120 120">
        {/* Track */}
        <circle cx="60" cy="60" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="8" />
        {/* Progress */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={style.stroke}
          strokeWidth="8"
          strokeDasharray={`${filled} ${circ - filled}`}
          strokeDashoffset={circ / 4}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        {/* Center countdown */}
        {remainingMs > 0 ? (
          <>
            <text
              x="60"
              y="55"
              textAnchor="middle"
              fontSize="9"
              fill="#9ca3af"
            >
              noch ca.
            </text>
            <text
              x="60"
              y="72"
              textAnchor="middle"
              fontSize="18"
              fontWeight="800"
              fill={style.stroke}
              fontFamily="monospace"
            >
              {formatCountdown(remainingSeconds)}
            </text>
          </>
        ) : (
          <text
            x="60"
            y="66"
            textAnchor="middle"
            fontSize="11"
            fontWeight="800"
            fill={style.stroke}
          >
            Jeden Moment
          </text>
        )}
      </svg>

      {/* Status label */}
      <p className={cn('text-sm font-semibold text-center', style.text)}>
        {statusLabel}
      </p>

      {/* ETA info */}
      <p className="text-xs text-stone-400 text-center">
        Geschätzte Lieferzeit: {etaMin} Minuten
      </p>
    </div>
  );
}
