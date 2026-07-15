'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface KomfortData {
  driver_id: string;
  pausen_minuten: number;
  km_gesamt: number;
  tour_anzahl: number;
  komfort_score: number;
  empfehlung: 'pause' | 'weiter' | 'schicht_ende';
  generiert_am: string;
}

interface Props {
  driverId: string | null;
  isOnline: boolean;
}

const RING_SIZE = 88;
const STROKE = 9;
const RADIUS = (RING_SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function scoreToOffset(score: number): number {
  return CIRCUMFERENCE - (score / 100) * CIRCUMFERENCE;
}

const EMPFEHLUNG_CONFIG: Record<KomfortData['empfehlung'], { label: string; color: string; ring: string; bg: string }> = {
  weiter:       { label: '✓ Weiterfahren',   color: 'text-emerald-600 dark:text-emerald-400', ring: 'stroke-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/20' },
  pause:        { label: '⏸ Pause empfohlen', color: 'text-amber-600 dark:text-amber-400',   ring: 'stroke-amber-400',   bg: 'bg-amber-50 dark:bg-amber-950/20' },
  schicht_ende: { label: '⛔ Schicht beenden', color: 'text-red-600 dark:text-red-400',       ring: 'stroke-red-500',     bg: 'bg-red-50 dark:bg-red-950/20' },
};

function buildMock(driverId: string): KomfortData {
  const seed = driverId.charCodeAt(0) % 50;
  const score = 40 + seed;
  const emp: KomfortData['empfehlung'] = score >= 70 ? 'weiter' : score >= 45 ? 'pause' : 'schicht_ende';
  return { driver_id: driverId, pausen_minuten: 20 + seed, km_gesamt: 60 + seed, tour_anzahl: 5 + (seed % 5), komfort_score: score, empfehlung: emp, generiert_am: new Date().toISOString() };
}

export function FahrerPhase1654SchichtEnergieRadar({ driverId, isOnline }: Props) {
  const [data, setData] = useState<KomfortData | null>(null);
  const [loading, setLoading] = useState(false);

  const doFetch = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      const res = await window.fetch(`/api/delivery/driver/komfort-score-heute?driver_id=${driverId}`);
      if (res.ok) setData(await res.json());
      else setData(buildMock(driverId));
    } catch {
      setData(buildMock(driverId));
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    if (!isOnline || !driverId) return;
    doFetch();
    const iv = setInterval(doFetch, 20 * 60_000);
    return () => clearInterval(iv);
  }, [doFetch, isOnline, driverId]);

  if (!isOnline || !driverId) return null;

  const score = data?.komfort_score ?? 0;
  const emp = data?.empfehlung ?? 'weiter';
  const cfg = EMPFEHLUNG_CONFIG[emp];
  const offset = scoreToOffset(score);

  return (
    <div className={cn('rounded-xl border border-border p-4 space-y-3', cfg.bg)}>
      <div className="text-sm font-bold text-foreground">Schicht-Energie-Radar</div>

      {/* Radial Ring + Score */}
      <div className="flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
          <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              className="stroke-muted"
            />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={data ? offset : CIRCUMFERENCE}
              strokeLinecap="round"
              className={cn('transition-all duration-700', cfg.ring)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-foreground" />
            ) : (
              <>
                <span className="text-xl font-black tabular-nums leading-none">{score}</span>
                <span className="text-[9px] text-muted-foreground leading-none mt-0.5">/100</span>
              </>
            )}
          </div>
        </div>

        {/* KPIs */}
        <div className="flex-1 space-y-1.5">
          {data && [
            { label: 'Pausen', value: `${data.pausen_minuten} Min` },
            { label: 'Gefahren', value: `${data.km_gesamt} km` },
            { label: 'Touren', value: `${data.tour_anzahl}×` },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-bold tabular-nums">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Empfehlung */}
      {data && (
        <div className={cn('rounded-lg px-3 py-2 text-xs font-bold text-center', cfg.color, 'bg-white/50 dark:bg-black/20')}>
          {cfg.label}
        </div>
      )}
    </div>
  );
}
