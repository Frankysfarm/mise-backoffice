'use client';

/**
 * Phase 596 — Fahrer-App: Schicht-Navigations-Hub
 *
 * Kompakter Navigations-Hub mit CSS-Fortschrittsring (SVG), aktueller ETA
 * und Tour-Status. Bei keiner aktiven Tour: Warte-Anzeige mit Spinner.
 *
 * Dark-Card (bg-matcha-900) mit weißem Text.
 */

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Gauge, Loader2, Route } from 'lucide-react';

interface BatchStop {
  id: string;
  reihenfolge: number;
  abgeschlossen_am: string | null;
  eta_earliest: string | null;
}

interface ActiveBatch {
  id: string;
  status: string;
  stops: BatchStop[];
}

interface Props {
  driverId: string;
  activeBatch: ActiveBatch | null;
}

const RING_RADIUS = 40;
const STROKE_WIDTH = 7;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function fmtEta(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function FahrerPhase596SchichtNavHub({ driverId: _driverId, activeBatch }: Props) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10_000);
    return () => clearInterval(id);
  }, []);

  // Keine aktive Tour
  if (!activeBatch) {
    return (
      <div className="rounded-xl bg-matcha-900 overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-matcha-700">
          <Gauge className="h-4 w-4 text-matcha-400" />
          <span className="text-sm font-bold text-white uppercase tracking-wider">
            Schicht-Nav-Hub
          </span>
        </div>
        <div className="flex flex-col items-center gap-3 px-4 py-8">
          <Loader2 className="h-8 w-8 text-matcha-400 animate-spin" />
          <p className="text-sm font-bold text-matcha-300">Warte auf nächste Tour</p>
          <p className="text-[11px] text-matcha-500">Keine aktive Tour</p>
        </div>
      </div>
    );
  }

  const sorted     = [...activeBatch.stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const total      = sorted.length;
  const completed  = sorted.filter(s => s.abgeschlossen_am !== null).length;
  const nextStop   = sorted.find(s => s.abgeschlossen_am === null) ?? null;
  const pct        = total > 0 ? Math.round((completed / total) * 100) : 0;

  const ringOffset = CIRCUMFERENCE * (1 - completed / Math.max(1, total));

  const ringColor =
    pct >= 100 ? '#4ade80' :
    pct >= 50  ? '#6ee7b7' :
    '#34d399';

  const nextEta = nextStop ? fmtEta(nextStop.eta_earliest) : null;

  return (
    <div className="rounded-xl bg-matcha-900 overflow-hidden">
      {/* Kopfzeile */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-matcha-700">
        <Gauge className="h-4 w-4 text-matcha-400" />
        <span className="text-sm font-bold text-white uppercase tracking-wider">
          Schicht-Nav-Hub
        </span>
        <span className="ml-auto text-[10px] font-bold text-matcha-400 uppercase tracking-wide">
          Tour läuft
        </span>
      </div>

      <div className="px-4 py-4 flex items-center gap-4">
        {/* Fortschrittsring (SVG) */}
        <div className="relative shrink-0">
          <svg width={96} height={96} viewBox="0 0 96 96">
            {/* Hintergrundring */}
            <circle
              cx={48}
              cy={48}
              r={RING_RADIUS}
              fill="none"
              stroke="#1a3d2b"
              strokeWidth={STROKE_WIDTH}
            />
            {/* Fortschritts-Bogen */}
            <circle
              cx={48}
              cy={48}
              r={RING_RADIUS}
              fill="none"
              stroke={ringColor}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={ringOffset}
              transform="rotate(-90 48 48)"
              style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.4s ease' }}
            />
            {/* Mitte: abgeschlossen / gesamt */}
            <text
              x={48}
              y={44}
              textAnchor="middle"
              style={{ fontSize: 18, fontWeight: 900, fill: '#ffffff' }}
            >
              {completed}
            </text>
            <text
              x={48}
              y={60}
              textAnchor="middle"
              style={{ fontSize: 10, fill: '#6ee7b7' }}
            >
              von {total}
            </text>
          </svg>
        </div>

        {/* Infos rechts */}
        <div className="flex-1 space-y-3 min-w-0">
          {/* Fortschritt-Prozent */}
          <div className="flex items-center gap-2">
            <span className="text-2xl font-black text-white tabular-nums leading-none">
              {pct} %
            </span>
            <span className="text-xs text-matcha-400 font-medium">erledigt</span>
          </div>

          {/* Nächster Stopp ETA */}
          {nextEta && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-matcha-400 shrink-0" />
              <span className="text-sm font-bold text-white">
                ETA {nextEta}
              </span>
            </div>
          )}

          {/* Stopps-Überblick */}
          <div className="flex items-center gap-1.5">
            <Route className="h-3.5 w-3.5 text-matcha-400 shrink-0" />
            <span className="text-xs text-matcha-300">
              {completed} / {total} Stopps
            </span>
          </div>

          {/* Alle erledigt */}
          {completed >= total && total > 0 && (
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
              <span className="text-xs font-bold text-green-400">Tour abgeschlossen!</span>
            </div>
          )}
        </div>
      </div>

      {/* Fortschrittsbalken unten */}
      <div className="px-4 pb-4">
        <div className="h-1.5 rounded-full bg-matcha-800 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${pct}%`, backgroundColor: ringColor }}
          />
        </div>
      </div>
    </div>
  );
}
