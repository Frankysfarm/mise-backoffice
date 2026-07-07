'use client';

/**
 * Phase 581 — Fahrer-App: Schicht-Zielerreichungs-Fortschrittsring
 *
 * Animierter SVG-Ring für das Tagesziel (Standard: 20 Lieferungen).
 * Zeigt live den aktuellen Fortschritt als Ring + Zahl + Prozent.
 *
 * Farbkodierung:
 *   < 33% → rot
 *   33–66% → amber
 *   > 66% → grün
 *   100% → emerald + Confetti-Text
 *
 * Mobile-first, Matcha-Theme, 60s Auto-Refresh
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Target } from 'lucide-react';

const RADIUS = 44;
const STROKE_WIDTH = 8;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface Stop {
  geliefert_am: string | null;
}

interface CompletedTour {
  id: string;
  stops: Stop[];
}

interface Props {
  completedTours?: CompletedTour[];
  totalDelivered?: number;
  targetDeliveries?: number;
  currentShiftStart?: string | null;
}

export function FahrerPhase581SchichtZielFortschrittsring({
  completedTours = [],
  totalDelivered,
  targetDeliveries = 20,
  currentShiftStart = null,
}: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const { delivered, pct } = useMemo(() => {
    let count = totalDelivered ?? 0;
    if (count === 0) {
      count = completedTours.reduce(
        (sum, t) => sum + t.stops.filter(s => s.geliefert_am !== null).length,
        0,
      );
    }
    const fraction = Math.min(1, count / Math.max(1, targetDeliveries));
    return { delivered: count, pct: Math.round(fraction * 100) };
  }, [completedTours, totalDelivered, targetDeliveries, tick]);

  const ringColor =
    pct >= 100 ? '#10b981' :
    pct >= 66  ? '#22c55e' :
    pct >= 33  ? '#f59e0b' : '#ef4444';

  const strokeDashoffset = CIRCUMFERENCE * (1 - Math.min(1, pct / 100));

  const shiftDurationH = currentShiftStart
    ? Math.max(0, (Date.now() - new Date(currentShiftStart).getTime()) / 3_600_000)
    : null;

  const projectedByEndOfShift = shiftDurationH && shiftDurationH > 0.25
    ? Math.round((delivered / shiftDurationH) * 8)
    : null;

  return (
    <div className="rounded-xl border border-matcha-200 bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-matcha-100">
        <Target className="h-4 w-4 text-matcha-600" />
        <span className="font-display text-sm font-bold text-matcha-800">Schicht-Tagesziel</span>
        {pct >= 100 && (
          <span className="ml-auto text-xs font-bold text-emerald-600 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> Ziel erreicht!
          </span>
        )}
      </div>

      <div className="px-4 py-4 flex items-center gap-5">
        {/* SVG Ring */}
        <div className="relative shrink-0">
          <svg width={112} height={112} viewBox="0 0 112 112">
            {/* Background track */}
            <circle
              cx={56}
              cy={56}
              r={RADIUS}
              fill="none"
              stroke="#e5e7eb"
              strokeWidth={STROKE_WIDTH}
            />
            {/* Progress arc */}
            <circle
              cx={56}
              cy={56}
              r={RADIUS}
              fill="none"
              stroke={ringColor}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={strokeDashoffset}
              transform="rotate(-90 56 56)"
              style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
            />
            {/* Center text */}
            <text x={56} y={50} textAnchor="middle" className="font-black" style={{ fontSize: 22, fontWeight: 900, fill: ringColor }}>
              {delivered}
            </text>
            <text x={56} y={66} textAnchor="middle" style={{ fontSize: 11, fill: '#6b7280' }}>
              von {targetDeliveries}
            </text>
          </svg>
        </div>

        {/* Stats */}
        <div className="flex-1 space-y-2">
          {/* Pct badge */}
          <div className="flex items-center gap-2">
            <span
              className={cn('text-2xl font-black tabular-nums',
                pct >= 100 ? 'text-emerald-600' :
                pct >= 66  ? 'text-green-600'   :
                pct >= 33  ? 'text-amber-600'   : 'text-red-600',
              )}
            >
              {pct}%
            </span>
            <span className="text-xs text-muted-foreground font-medium">Ziel</span>
          </div>

          {/* Remaining */}
          {pct < 100 && (
            <div className="text-xs text-muted-foreground">
              Noch <span className="font-bold text-foreground">{targetDeliveries - delivered}</span> Lieferungen
            </div>
          )}

          {/* Projected */}
          {projectedByEndOfShift !== null && (
            <div className="text-[11px] text-muted-foreground">
              Prognose (8h): <span className={cn('font-bold', projectedByEndOfShift >= targetDeliveries ? 'text-emerald-600' : 'text-amber-600')}>
                {projectedByEndOfShift}
              </span> Lieferungen
            </div>
          )}

          {/* Shift duration */}
          {shiftDurationH !== null && shiftDurationH > 0 && (
            <div className="text-[10px] text-muted-foreground pt-0.5 border-t border-matcha-100">
              Schicht: {shiftDurationH.toFixed(1)} h aktiv
            </div>
          )}
        </div>
      </div>

      {/* Progress bar at bottom */}
      <div className="px-4 pb-3">
        <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: ringColor }}
          />
        </div>
      </div>
    </div>
  );
}
