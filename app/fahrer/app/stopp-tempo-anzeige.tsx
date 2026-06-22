'use client';

import { useEffect, useState } from 'react';
import { Zap, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

type Stop = {
  id: string;
  geliefert_am: string | null;
  angekommen_am: string | null;
};

interface Props {
  stops: Stop[];
  startedAt: string | null;
  targetStopsPerHour?: number;
}

const RADIUS = 40;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function FahrerStoppTempoAnzeige({
  stops,
  startedAt,
  targetStopsPerHour = 4,
}: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!startedAt || stops.length === 0) return null;

  const completedStops = stops.filter((s) => s.geliefert_am !== null);
  if (completedStops.length === 0) return null;

  const startMs = new Date(startedAt).getTime();
  const elapsedHours = Math.max((now - startMs) / (1000 * 60 * 60), 0.0001);
  const actualStopsPerHour = completedStops.length / elapsedHours;

  const ratio = actualStopsPerHour / targetStopsPerHour;
  const progressPct = Math.min(ratio * 100, 100);
  const deltaPct = Math.round((ratio - 1) * 100);

  const strokeColor =
    ratio >= 1
      ? '#4d7c0f'   // green (matcha)
      : ratio >= 0.75
        ? '#d97706' // amber
        : '#dc2626'; // red

  const dash = (progressPct / 100) * CIRCUMFERENCE;
  const gap = CIRCUMFERENCE - dash;

  const isAhead = deltaPct >= 0;
  const DeltaIcon = isAhead ? TrendingUp : TrendingDown;
  const deltaColor = isAhead ? 'text-matcha-700' : ratio >= 0.75 ? 'text-amber-600' : 'text-red-600';
  const cardBg =
    ratio >= 1
      ? 'bg-matcha-50 border-matcha-200'
      : ratio >= 0.75
        ? 'bg-amber-50 border-amber-200'
        : 'bg-red-50 border-red-200';

  return (
    <div className={cn('rounded-2xl border p-4 space-y-3', cardBg)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <Zap className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex-1">
          Stopp-Tempo
        </span>
        <div className={cn('flex items-center gap-0.5 text-[11px] font-black', deltaColor)}>
          <DeltaIcon className="h-3 w-3 shrink-0" />
          <span>
            {isAhead ? '+' : ''}
            {deltaPct}%
          </span>
        </div>
      </div>

      {/* Ring + Stats */}
      <div className="flex items-center gap-4">
        {/* SVG Ring */}
        <div className="relative shrink-0">
          <svg width="96" height="96" viewBox="0 0 96 96">
            {/* Track */}
            <circle
              cx="48"
              cy="48"
              r={RADIUS}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="9"
            />
            {/* Progress */}
            <circle
              cx="48"
              cy="48"
              r={RADIUS}
              fill="none"
              stroke={strokeColor}
              strokeWidth="9"
              strokeDasharray={`${dash} ${gap}`}
              strokeLinecap="round"
              transform="rotate(-90 48 48)"
            />
            {/* Center: actual rate */}
            <text
              x="48"
              y="44"
              textAnchor="middle"
              style={{ fontSize: 15, fontWeight: 900, fill: 'currentColor' }}
            >
              {actualStopsPerHour.toFixed(1)}
            </text>
            <text
              x="48"
              y="57"
              textAnchor="middle"
              style={{ fontSize: 8, fill: '#6b7280', fontWeight: 600 }}
            >
              Stopps/Std
            </text>
          </svg>
        </div>

        {/* Side stats */}
        <div className="flex-1 space-y-2">
          <div className="space-y-0.5">
            <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
              Geliefert
            </div>
            <div className="text-xl font-black tabular-nums text-foreground">
              {completedStops.length}
              <span className="text-sm font-semibold text-muted-foreground ml-1">
                / {stops.length}
              </span>
            </div>
          </div>

          <div className="space-y-0.5">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">
              <Target className="h-3 w-3 shrink-0" />
              Ziel
            </div>
            <div className="text-sm font-bold text-muted-foreground tabular-nums">
              {targetStopsPerHour} Stopps/Std
            </div>
          </div>

          {/* Mini progress bar */}
          <div>
            <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${progressPct}%`,
                  backgroundColor: strokeColor,
                }}
              />
            </div>
            <div className="mt-0.5 text-[9px] text-muted-foreground">
              {Math.round(progressPct)}% des Ziels
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
