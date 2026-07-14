'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// Phase 1518 — Bestelllast-Prognose-Uhr (Kitchen)
// Runde Uhr-SVG der Auslastung dieser Stunde vs. letzter Stunde + Hochrechnung;
// Props-basiert; nach Phase1513.

interface Props {
  bestellungenDieseStunde: number;
  bestellungenLetzteStunde: number;
  maxKapazitaet?: number;
  className?: string;
}

type AuslastungsLevel = 'niedrig' | 'normal' | 'hoch' | 'kritisch';

function getLevel(pct: number): AuslastungsLevel {
  if (pct < 40) return 'niedrig';
  if (pct < 70) return 'normal';
  if (pct < 90) return 'hoch';
  return 'kritisch';
}

const LEVEL_CONFIG: Record<AuslastungsLevel, { color: string; stroke: string; label: string; hint: string }> = {
  niedrig: { color: 'text-slate-500', stroke: '#94a3b8', label: 'Ruhig', hint: 'Kapazität gut nutzbar' },
  normal: { color: 'text-emerald-600 dark:text-emerald-400', stroke: '#10b981', label: 'Normal', hint: 'Auslastung im Zielbereich' },
  hoch: { color: 'text-amber-600 dark:text-amber-400', stroke: '#f59e0b', label: 'Hoch', hint: 'Priorisierung empfohlen' },
  kritisch: { color: 'text-rose-600 dark:text-rose-400', stroke: '#ef4444', label: 'Kritisch', hint: 'Maximale Kapazität erreicht!' },
};

function UhrRing({ pct, stroke, size = 80 }: { pct: number; stroke: string; size?: number }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (Math.min(pct, 100) / 100) * circ;
  const cx = size / 2;
  const cy = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="currentColor" strokeWidth={8}
        className="text-slate-100 dark:text-slate-800" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={stroke} strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
    </svg>
  );
}

export function KitchenPhase1518BestelllastPrognoseUhr({
  bestellungenDieseStunde,
  bestellungenLetzteStunde,
  maxKapazitaet = 20,
  className,
}: Props) {
  const pctJetzt = useMemo(
    () => Math.min(100, Math.round((bestellungenDieseStunde / maxKapazitaet) * 100)),
    [bestellungenDieseStunde, maxKapazitaet],
  );
  const pctLetzte = useMemo(
    () => Math.min(100, Math.round((bestellungenLetzteStunde / maxKapazitaet) * 100)),
    [bestellungenLetzteStunde, maxKapazitaet],
  );

  const level = getLevel(pctJetzt);
  const cfg = LEVEL_CONFIG[level];

  const delta = bestellungenDieseStunde - bestellungenLetzteStunde;
  const trendIcon = delta > 1
    ? <TrendingUp className="w-3.5 h-3.5 text-rose-500" />
    : delta < -1
    ? <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
    : <Minus className="w-3.5 h-3.5 text-slate-400" />;

  const hochrechnungNaechsteStunde = Math.round(bestellungenDieseStunde * 1.05 + delta * 0.5);
  const pctPrognose = Math.min(100, Math.round((hochrechnungNaechsteStunde / maxKapazitaet) * 100));

  return (
    <div className={cn('rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4', className)}>
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-slate-400" />
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Bestelllast-Uhr</span>
        <span className={cn('ml-auto text-[11px] font-bold px-2 py-0.5 rounded-full',
          level === 'kritisch' ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
          : level === 'hoch' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
          : level === 'normal' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
        )}>
          {cfg.label}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Haupt-Uhr */}
        <div className="relative shrink-0">
          <UhrRing pct={pctJetzt} stroke={cfg.stroke} size={88} />
          <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
            <span className={cn('text-lg font-black leading-none', cfg.color)}>{pctJetzt}%</span>
            <span className="text-[9px] text-slate-400 leading-none mt-0.5">jetzt</span>
          </div>
        </div>

        {/* Vergleich + Prognose */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Diese Stunde</span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-100">
              {bestellungenDieseStunde} / {maxKapazitaet}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Letzte Stunde</span>
            <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">
              {bestellungenLetzteStunde}
              <span className="ml-1 inline-flex">{trendIcon}</span>
            </span>
          </div>
          <div className="h-px bg-slate-100 dark:bg-slate-800" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">Prognose nächste h</span>
            <span className={cn('text-sm font-bold',
              pctPrognose >= 90 ? 'text-rose-600 dark:text-rose-400'
              : pctPrognose >= 70 ? 'text-amber-600 dark:text-amber-400'
              : 'text-emerald-600 dark:text-emerald-400',
            )}>
              ~{hochrechnungNaechsteStunde}
            </span>
          </div>
        </div>
      </div>

      {/* Prognose-Balken */}
      <div className="mt-3">
        <div className="flex justify-between text-[9px] text-slate-400 mb-1">
          <span>Prognose</span>
          <span>{pctPrognose}%</span>
        </div>
        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pctPrognose}%`,
              backgroundColor: pctPrognose >= 90 ? '#ef4444' : pctPrognose >= 70 ? '#f59e0b' : '#10b981',
            }}
          />
        </div>
      </div>

      <p className={cn('text-[10px] mt-2', cfg.color)}>{cfg.hint}</p>
    </div>
  );
}
