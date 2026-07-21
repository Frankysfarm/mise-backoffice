'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Route, ChevronDown, ChevronUp, TrendingUp, Trophy, Target } from 'lucide-react';

/**
 * Phase 2853 — Tour-Score Visualisierung Ultimate
 *
 * Echtzeit-Score-Anzeige (0–100) je aktiver Tour + Tour-Visualisierung.
 * Score berechnet aus Pünktlichkeit, Stopp-Fortschritt, ETA-Verbrauch.
 * Rangliste der Fahrer nach Live-Score + Fortschrittsbalken je Stopp.
 */

interface Stop {
  id: string;
  reihenfolge: number;
  geliefert_am?: string | null;
  angekommen_am?: string | null;
}

interface Batch {
  id: string;
  status?: string | null;
  fahrer_id?: string | null;
  zone?: string | null;
  startzeit?: string | null;
  total_eta_min?: number | null;
  stops?: Stop[];
}

interface Driver {
  employee_id?: string | null;
  employee?: { vorname?: string | null; nachname?: string | null } | null;
}

interface Props {
  batches: Batch[];
  drivers: Driver[];
  locationId?: string | null;
}

type Health = 'excellent' | 'good' | 'warning' | 'critical';

function healthFromScore(score: number): Health {
  if (score >= 85) return 'excellent';
  if (score >= 65) return 'good';
  if (score >= 45) return 'warning';
  return 'critical';
}

const HEALTH_CFG: Record<Health, { bar: string; bg: string; border: string; text: string; trophy: string }> = {
  excellent: { bar: 'bg-matcha-500',  bg: 'bg-matcha-50 dark:bg-matcha-900/20',   border: 'border-matcha-200 dark:border-matcha-700', text: 'text-matcha-700 dark:text-matcha-300',   trophy: 'text-yellow-500' },
  good:      { bar: 'bg-blue-500',    bg: 'bg-blue-50 dark:bg-blue-900/20',       border: 'border-blue-200 dark:border-blue-700',     text: 'text-blue-700 dark:text-blue-300',       trophy: 'text-blue-400'   },
  warning:   { bar: 'bg-amber-400',   bg: 'bg-amber-50 dark:bg-amber-900/20',     border: 'border-amber-200 dark:border-amber-700',   text: 'text-amber-700 dark:text-amber-300',     trophy: 'text-amber-400'  },
  critical:  { bar: 'bg-red-500',     bg: 'bg-red-50 dark:bg-red-900/20',         border: 'border-red-200 dark:border-red-700',       text: 'text-red-700 dark:text-red-300',         trophy: 'text-red-500'    },
};

function computeScore(elapsedMin: number, etaMin: number | null, done: number, total: number): number {
  const donePct = total > 0 ? done / total : 0;
  const timePct = etaMin ? elapsedMin / Math.max(etaMin, 1) : donePct;
  const timing = Math.max(0, 1 - Math.max(0, timePct - donePct) * 2);
  return Math.round((timing * 0.55 + donePct * 0.45) * 100);
}

function driverName(b: Batch, drivers: Driver[]): string {
  const d = drivers.find(dr => dr.employee_id === (b.fahrer_id ?? ''));
  if (!d?.employee) return 'Fahrer';
  const { vorname = '', nachname = '' } = d.employee;
  return `${vorname} ${(nachname ?? '')[0] ?? ''}.`.trim();
}

export function DispatchPhase2853TourScoreVisualisierungUltimate({ batches, drivers }: Props) {
  const [open, setOpen] = useState(true);

  const rows = useMemo(() => {
    const now = Date.now();
    const active = batches.filter(b =>
      ['unterwegs', 'on_route', 'gestartet', 'aktiv'].includes(b.status ?? ''),
    );
    return active.map(b => {
      const startMs = b.startzeit ? new Date(b.startzeit).getTime() : now;
      const elapsedMin = Math.max(0, (now - startMs) / 60_000);
      const totalStops = b.stops?.length ?? 0;
      const doneStops = b.stops?.filter(s => s.geliefert_am).length ?? 0;
      const arrivedStops = b.stops?.filter(s => s.angekommen_am).length ?? 0;
      const score = computeScore(elapsedMin, b.total_eta_min ?? null, doneStops, totalStops);
      const health = healthFromScore(score);
      const remainMin = b.total_eta_min ? Math.max(0, b.total_eta_min - elapsedMin) : null;
      const stops = (b.stops ?? []).slice().sort((a, x) => a.reihenfolge - x.reihenfolge);
      return { id: b.id, name: driverName(b, drivers), zone: b.zone ?? '?', score, health, totalStops, doneStops, arrivedStops, elapsedMin, remainMin, stops };
    }).sort((a, b) => b.score - a.score);
  }, [batches, drivers]);

  const avgScore = rows.length ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition border-b"
      >
        <Route className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="font-display text-sm font-bold flex-1 text-left">Tour-Score Visualisierung</span>
        <div className="flex items-center gap-1 text-[10px] tabular-nums">
          <TrendingUp className="h-3 w-3 text-matcha-500" />
          <span className="font-bold text-matcha-700 dark:text-matcha-300">Ø {avgScore}</span>
        </div>
        <span className="text-[10px] text-muted-foreground ml-1">{rows.length} Touren</span>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {open && (
        <div className="p-3 space-y-3">
          {rows.length === 0 ? (
            <div className="text-center text-[11px] text-muted-foreground py-6">Keine aktiven Touren</div>
          ) : (
            rows.map((row, idx) => {
              const cfg = HEALTH_CFG[row.health];
              return (
                <div key={row.id} className={cn('rounded-lg border p-3 space-y-2', cfg.bg, cfg.border)}>
                  {/* Header */}
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold tabular-nums text-muted-foreground w-5 shrink-0">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-sm flex-1 truncate">{row.name}</span>
                    <span className="text-[9px] text-muted-foreground px-1.5 py-0.5 bg-muted/60 rounded">{row.zone}</span>
                    {idx === 0 && <Trophy className={cn('h-3.5 w-3.5 shrink-0', cfg.trophy)} />}
                    <div className="text-right shrink-0">
                      <div className={cn('text-xl font-black tabular-nums leading-none', cfg.text)}>{row.score}</div>
                      <div className="text-[8px] text-muted-foreground">Score</div>
                    </div>
                  </div>

                  {/* Score Bar */}
                  <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                    <div className={cn('h-full rounded-full transition-all', cfg.bar)} style={{ width: `${row.score}%` }} />
                  </div>

                  {/* KPI Strip */}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <div className="text-[10px] font-bold tabular-nums">{row.doneStops}/{row.totalStops}</div>
                      <div className="text-[8px] text-muted-foreground">Stopps</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold tabular-nums">{Math.round(row.elapsedMin)}m</div>
                      <div className="text-[8px] text-muted-foreground">Unterwegs</div>
                    </div>
                    <div>
                      <div className="text-[10px] font-bold tabular-nums">
                        {row.remainMin != null ? `${Math.round(row.remainMin)}m` : '—'}
                      </div>
                      <div className="text-[8px] text-muted-foreground">Rest-ETA</div>
                    </div>
                  </div>

                  {/* Stop Dots Visualisierung */}
                  {row.totalStops > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {row.stops.map(s => (
                        <div
                          key={s.id}
                          className={cn(
                            'h-3 w-3 rounded-full border-2 flex-shrink-0 transition-colors',
                            s.geliefert_am
                              ? 'bg-matcha-500 border-matcha-600'
                              : s.angekommen_am
                                ? 'bg-amber-400 border-amber-500'
                                : 'bg-muted border-muted-foreground/30',
                          )}
                          title={`Stopp ${s.reihenfolge}`}
                        />
                      ))}
                      <span className="text-[8px] text-muted-foreground self-center ml-1">
                        {row.doneStops} ✓ {row.arrivedStops - row.doneStops > 0 ? `${row.arrivedStops - row.doneStops} @ ` : ''}
                        {row.totalStops - row.arrivedStops} ausstehend
                      </span>
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div className="flex items-center justify-between text-[9px] text-muted-foreground border-t pt-2 mt-1">
            <span className="flex items-center gap-1"><Target className="h-3 w-3" /> Ziel: Score ≥85</span>
            <span>Team-Ø: <strong className="text-foreground">{avgScore}</strong>/100</span>
          </div>
        </div>
      )}
    </div>
  );
}
