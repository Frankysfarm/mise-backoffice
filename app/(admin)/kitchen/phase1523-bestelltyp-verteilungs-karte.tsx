'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { PieChart, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Phase 1523 — Bestelltyp-Verteilungs-Karte (Kitchen)
// Pie-Chart SVG: Eigenlieferung vs. Abholung vs. Tisch + Anteil % + Trend vs. Vorwoche; Props-basiert.

interface BestelltypDaten {
  eigenlieferung: number;
  abholung: number;
  tisch: number;
}

interface Props {
  aktuell: BestelltypDaten;
  vorwoche?: BestelltypDaten | null;
  className?: string;
}

type Bestelltyp = 'eigenlieferung' | 'abholung' | 'tisch';

const TYP_CONFIG: Record<Bestelltyp, { label: string; emoji: string; fill: string; textColor: string; badgeBg: string }> = {
  eigenlieferung: {
    label: 'Eigenlieferung',
    emoji: '🚗',
    fill: '#3b82f6',
    textColor: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  },
  abholung: {
    label: 'Abholung',
    emoji: '🏃',
    fill: '#10b981',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  },
  tisch: {
    label: 'Tisch',
    emoji: '🍽️',
    fill: '#f59e0b',
    textColor: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  },
};

const TYPEN: Bestelltyp[] = ['eigenlieferung', 'abholung', 'tisch'];

interface PieSlice {
  typ: Bestelltyp;
  anteil: number;
  startAngle: number;
  endAngle: number;
}

function buildSlices(daten: BestelltypDaten): PieSlice[] {
  const total = daten.eigenlieferung + daten.abholung + daten.tisch;
  if (total === 0) {
    return TYPEN.map(typ => ({ typ, anteil: 0, startAngle: 0, endAngle: 0 }));
  }
  const slices: PieSlice[] = [];
  let cursor = -Math.PI / 2;
  for (const typ of TYPEN) {
    const count = daten[typ];
    const anteil = count / total;
    const spanAngle = anteil * 2 * Math.PI;
    slices.push({ typ, anteil, startAngle: cursor, endAngle: cursor + spanAngle });
    cursor += spanAngle;
  }
  return slices;
}

function polarToXY(angle: number, r: number, cx: number, cy: number): [number, number] {
  return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
}

function buildArcPath(startAngle: number, endAngle: number, r: number, cx: number, cy: number): string {
  const span = endAngle - startAngle;
  if (span <= 0 || span >= 2 * Math.PI) {
    return `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.001} ${cy - r} Z`;
  }
  const [sx, sy] = polarToXY(startAngle, r, cx, cy);
  const [ex, ey] = polarToXY(endAngle, r, cx, cy);
  const largeArc = span > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${sx.toFixed(2)} ${sy.toFixed(2)} A ${r} ${r} 0 ${largeArc} 1 ${ex.toFixed(2)} ${ey.toFixed(2)} Z`;
}

function trendIcon(aktuell: number, vorwoche: number | undefined): React.ReactNode {
  if (vorwoche === undefined) return null;
  const delta = aktuell - vorwoche;
  if (delta > 1) return <TrendingUp className="w-3 h-3 text-emerald-500" />;
  if (delta < -1) return <TrendingDown className="w-3 h-3 text-rose-500" />;
  return <Minus className="w-3 h-3 text-slate-400" />;
}

export function KitchenPhase1523BestelltypVerteilungsKarte({ aktuell, vorwoche, className }: Props) {
  const slices = useMemo(() => buildSlices(aktuell), [aktuell]);
  const total = aktuell.eigenlieferung + aktuell.abholung + aktuell.tisch;

  const cx = 52;
  const cy = 52;
  const r = 44;
  const SIZE = 104;

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4', className)}>
      <div className="flex items-center gap-2 mb-3">
        <PieChart className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Bestelltyp-Verteilung</span>
        <span className="ml-auto text-[10px] text-slate-400">{total} gesamt</span>
      </div>

      <div className="flex items-center gap-4">
        {/* Pie SVG */}
        <div className="shrink-0">
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            {total === 0 ? (
              <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e2e8f0" strokeWidth={2} />
            ) : (
              slices.map(slice => (
                <path
                  key={slice.typ}
                  d={buildArcPath(slice.startAngle, slice.endAngle, r, cx, cy)}
                  fill={TYP_CONFIG[slice.typ].fill}
                  opacity={0.9}
                  style={{ transition: 'opacity 0.2s' }}
                />
              ))
            )}
            {/* Donut hole */}
            <circle cx={cx} cy={cy} r={22} fill="white" className="dark:fill-slate-900" />
            <text x={cx} y={cy + 5} textAnchor="middle"
              className="text-[10px] fill-slate-500"
              style={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}>
              {total}
            </text>
          </svg>
        </div>

        {/* Legende */}
        <div className="flex-1 space-y-2">
          {slices.map(slice => {
            const cfg = TYP_CONFIG[slice.typ];
            const pct = total > 0 ? Math.round(slice.anteil * 100) : 0;
            const vwCount = vorwoche?.[slice.typ];
            return (
              <div key={slice.typ} className="flex items-center gap-2">
                <span className="text-base leading-none shrink-0">{cfg.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] text-slate-600 dark:text-slate-300 font-medium truncate">
                      {cfg.label}
                    </span>
                    {trendIcon(aktuell[slice.typ], vwCount)}
                  </div>
                  <div className="h-1 bg-slate-100 dark:bg-slate-800 rounded-full mt-0.5 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, backgroundColor: cfg.fill }}
                    />
                  </div>
                </div>
                <span className={cn('text-xs font-bold shrink-0 w-8 text-right', cfg.textColor)}>
                  {pct}%
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {vorwoche && (
        <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[10px] text-slate-400 text-right">
          Vergleich: Vorwoche {vorwoche.eigenlieferung + vorwoche.abholung + vorwoche.tisch} Bestellungen
        </div>
      )}
    </div>
  );
}
