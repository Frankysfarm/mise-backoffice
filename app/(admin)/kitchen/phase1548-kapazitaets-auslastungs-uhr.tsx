'use client';

import React, { useMemo } from 'react';

interface Props {
  aktiveBestellungen?: number;
  maxKapazitaet?: number;
}

const RING = 56;
const STROKE = 6;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

function getColor(pct: number) {
  if (pct >= 90) return { stroke: '#ef4444', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-950/40 border-red-300 dark:border-red-700', label: 'Überlast', icon: '🔴' };
  if (pct >= 70) return { stroke: '#f97316', text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-950/40 border-orange-300 dark:border-orange-700', label: 'Hoch', icon: '🟠' };
  if (pct >= 40) return { stroke: '#eab308', text: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-100 dark:bg-yellow-950/40 border-yellow-300 dark:border-yellow-700', label: 'Mittel', icon: '🟡' };
  return { stroke: '#22c55e', text: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-950/40 border-green-300 dark:border-green-700', label: 'Niedrig', icon: '🟢' };
}

export function KitchenPhase1548KapazitaetsAuslastungsUhr({
  aktiveBestellungen = 0,
  maxKapazitaet = 20,
}: Props) {
  const pct = useMemo(
    () => Math.min(100, Math.round((aktiveBestellungen / Math.max(maxKapazitaet, 1)) * 100)),
    [aktiveBestellungen, maxKapazitaet],
  );
  const color = getColor(pct);
  const dash = (pct / 100) * CIRC;
  const frei = maxKapazitaet - aktiveBestellungen;

  return (
    <div className={`rounded-xl border p-4 ${color.bg}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">⏱</span>
        <h3 className="text-sm font-semibold">Kapazitäts-Auslastung</h3>
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full bg-white/50 dark:bg-black/20 ${color.text}`}>
          {color.icon} {color.label}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <svg width={RING} height={RING} className="flex-shrink-0" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={RING / 2} cy={RING / 2} r={R} fill="none" stroke="currentColor" strokeWidth={STROKE} className="text-black/10 dark:text-white/10" />
          <circle
            cx={RING / 2} cy={RING / 2} r={R} fill="none"
            stroke={color.stroke} strokeWidth={STROKE}
            strokeDasharray={`${dash} ${CIRC}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />
        </svg>
        <div className="flex-1 space-y-1">
          <div className={`text-2xl font-bold font-mono ${color.text}`}>{pct}%</div>
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold">{aktiveBestellungen}</span> / {maxKapazitaet} Bestellungen
          </div>
          <div className="text-[11px] text-muted-foreground">
            {frei > 0 ? `${frei} freie Slot${frei !== 1 ? 's' : ''}` : 'Kapazität erschöpft!'}
          </div>
        </div>
        <div className="hidden sm:flex flex-col gap-1 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />0–39%</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />40–69%</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />70–89%</div>
          <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />90%+</div>
        </div>
      </div>
      {pct >= 90 && (
        <div className="mt-3 rounded-lg bg-red-500/10 dark:bg-red-500/20 border border-red-400 dark:border-red-700 px-3 py-1.5">
          <p className="text-xs font-semibold text-red-700 dark:text-red-300">
            ⚠ Überlast! Neue Bestellungen verzögern sich.
          </p>
        </div>
      )}
    </div>
  );
}
