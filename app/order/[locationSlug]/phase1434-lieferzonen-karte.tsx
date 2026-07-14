'use client';

import { useState } from 'react';
import { Map, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1434 — Lieferzonen-Karte (Storefront)
 *
 * Visuelle SVG-Darstellung der Lieferzonen A/B/C/D:
 *   • Konzentrische Ringe um den Standort
 *   • Farbkodierung: A=grün, B=gelb, C=orange, D=rot
 *   • Legende mit Ø-Lieferzeiten
 *   • Props aus Location (deliveryZones: Array)
 * Nach Phase1429 in storefront.tsx.
 */

interface ZoneInfo {
  label: string;
  color: string;
  fill: string;
  stroke: string;
  lieferzeit: string;
}

const ZONES: ZoneInfo[] = [
  { label: 'D', color: 'text-rose-700 dark:text-rose-400',    fill: 'fill-rose-200/60 dark:fill-rose-900/50',    stroke: 'stroke-rose-400 dark:stroke-rose-600',    lieferzeit: '45–60 Min' },
  { label: 'C', color: 'text-orange-700 dark:text-orange-400', fill: 'fill-orange-200/60 dark:fill-orange-900/50', stroke: 'stroke-orange-400 dark:stroke-orange-600', lieferzeit: '35–45 Min' },
  { label: 'B', color: 'text-amber-700 dark:text-amber-400',   fill: 'fill-amber-200/60 dark:fill-amber-900/50',   stroke: 'stroke-amber-400 dark:stroke-amber-600',   lieferzeit: '25–35 Min' },
  { label: 'A', color: 'text-emerald-700 dark:text-emerald-400', fill: 'fill-emerald-200/60 dark:fill-emerald-900/50', stroke: 'stroke-emerald-400 dark:stroke-emerald-600', lieferzeit: '15–25 Min' },
];

const LEGEND_COLORS: Record<string, string> = {
  A: 'bg-emerald-400',
  B: 'bg-amber-400',
  C: 'bg-orange-400',
  D: 'bg-rose-400',
};

interface Props {
  locationId: string;
  activeZones?: string[];
}

const CX = 100;
const CY = 100;
const RADII = [22, 44, 66, 85];

export function StorefrontPhase1434LieferzonenKarte({ activeZones }: Props) {
  const [open, setOpen] = useState(true);

  const visibleZones = activeZones && activeZones.length > 0 ? activeZones : ['A', 'B', 'C', 'D'];

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-matcha-600 dark:text-matcha-400" />
          <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Lieferzonen-Übersicht</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            {/* SVG Zonen-Karte */}
            <div className="w-full sm:w-48 shrink-0">
              <svg
                viewBox="0 0 200 200"
                className="w-full max-w-[180px] mx-auto"
                aria-label="Lieferzonen-Karte"
              >
                {/* Zonen von außen nach innen */}
                {ZONES.map((z, i) => {
                  const r = RADII[i];
                  const isActive = visibleZones.includes(z.label);
                  if (!isActive) return null;
                  return (
                    <circle
                      key={z.label}
                      cx={CX}
                      cy={CY}
                      r={r}
                      className={cn(z.fill, z.stroke, 'stroke-[1.5]')}
                    />
                  );
                })}

                {/* Standort-Marker */}
                <circle cx={CX} cy={CY} r={5} className="fill-matcha-500 stroke-white dark:stroke-slate-900 stroke-2" />
                <circle cx={CX} cy={CY} r={2} className="fill-white dark:fill-slate-900" />

                {/* Zonen-Labels */}
                {ZONES.map((z, i) => {
                  if (!visibleZones.includes(z.label)) return null;
                  const r = RADII[i];
                  const labelR = i === 0 ? r * 0.6 : (RADII[i] + RADII[i - 1]) / 2;
                  return (
                    <text
                      key={`lbl-${z.label}`}
                      x={CX + labelR * 0.7}
                      y={CY - labelR * 0.7}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="text-[8px] font-bold fill-slate-600 dark:fill-slate-300"
                      fontSize="8"
                    >
                      {z.label}
                    </text>
                  );
                })}

                {/* Achsen-Linien */}
                {[0, 90].map((deg) => {
                  const rad = (deg * Math.PI) / 180;
                  const maxR = RADII[0];
                  return (
                    <line
                      key={deg}
                      x1={CX}
                      y1={CY}
                      x2={CX + maxR * Math.cos(rad)}
                      y2={CY - maxR * Math.sin(rad)}
                      className="stroke-white/40 dark:stroke-slate-700/60"
                      strokeWidth="0.5"
                      strokeDasharray="2 2"
                    />
                  );
                })}
              </svg>
            </div>

            {/* Legende */}
            <div className="flex-1 space-y-2 w-full">
              {['A', 'B', 'C', 'D'].filter((z) => visibleZones.includes(z)).map((zLabel) => {
                const info = ZONES.find((z) => z.label === zLabel)!;
                return (
                  <div
                    key={zLabel}
                    className="flex items-center gap-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-2"
                  >
                    <div className={cn('w-3 h-3 rounded-full shrink-0', LEGEND_COLORS[zLabel])} />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 w-12">Zone {zLabel}</span>
                    <span className={cn('text-xs font-semibold', info.color)}>{info.lieferzeit}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <p className="text-[10px] text-slate-400 dark:text-slate-500">
            Richtzeiten — tatsächliche Lieferzeit kann je nach Auslastung variieren.
          </p>
        </div>
      )}
    </div>
  );
}
