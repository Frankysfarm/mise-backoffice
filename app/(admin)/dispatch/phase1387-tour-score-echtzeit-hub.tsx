'use client';

import { useMemo, useState } from 'react';
import {
  Award, BarChart2, CheckCircle2, Clock, MapPin, Route,
  Star, TrendingDown, TrendingUp, Truck, XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1383 — Tour-Score Echtzeit-Hub (Dispatch)
 *
 * Kombiniertes Live-Board:
 *   1. Score-Overview: Ø Dispatch-Score aller aktiven Touren (Tacho-Ring + Ampel)
 *   2. Tour-Karten: Jede aktive Tour als Karte mit Stop-Sequenz, Fortschritt, ETA-Ampel
 *   3. Ranking: Beste / schlechteste Tour des Tages hervorgehoben
 *
 * Rein props-basiert. Nach Phase1378 in dispatch/client.tsx einbinden.
 */

interface Driver {
  employee_id: string;
  ist_online: boolean;
  fahrzeug: string;
  aktueller_batch_id: string | null;
  employee: {
    id: string;
    vorname: string;
    nachname: string;
    telefon: string | null;
    avatar_url: string | null;
  } | null;
}

interface BatchStop {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    kunde_adresse: string | null;
    eta_earliest: string | null;
    eta_latest: string | null;
  } | null;
}

interface Batch {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  started_at?: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: BatchStop[];
  dispatch_score?: number | null;
}

interface ReadyOrder {
  id: string;
  dispatch_score: number | null;
}

interface Props {
  drivers: Driver[];
  batches: Batch[];
  orders?: ReadyOrder[];
}

type ScoreStufe = 'top' | 'gut' | 'ok' | 'schwach';

function stufeOf(score: number): ScoreStufe {
  if (score >= 85) return 'top';
  if (score >= 65) return 'gut';
  if (score >= 40) return 'ok';
  return 'schwach';
}

const SCORE_STYLE: Record<ScoreStufe, { ring: string; bg: string; text: string; badge: string; label: string }> = {
  top:    { ring: 'stroke-green-500',   bg: 'bg-green-50 dark:bg-green-950/20',   text: 'text-green-700 dark:text-green-300',   badge: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',   label: '⭐ Top' },
  gut:    { ring: 'stroke-matcha-500',  bg: 'bg-matcha-50 dark:bg-matcha-950/20', text: 'text-matcha-700 dark:text-matcha-300', badge: 'bg-matcha-100 text-matcha-800 dark:bg-matcha-900/40 dark:text-matcha-300', label: 'Gut' },
  ok:     { ring: 'stroke-amber-400',   bg: 'bg-amber-50 dark:bg-amber-950/20',   text: 'text-amber-700 dark:text-amber-300',   badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',   label: 'OK' },
  schwach:{ ring: 'stroke-red-500',     bg: 'bg-red-50 dark:bg-red-950/25',       text: 'text-red-700 dark:text-red-300',       badge: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',           label: 'Schwach' },
};

function etaAmpel(stop: BatchStop, now: Date): 'gruen' | 'gelb' | 'rot' | null {
  if (stop.geliefert_am) return 'gruen';
  const latest = stop.order?.eta_latest;
  if (!latest) return null;
  const diff = (new Date(latest).getTime() - now.getTime()) / 60000;
  if (diff >= 5) return 'gruen';
  if (diff >= 0) return 'gelb';
  return 'rot';
}

function ScoreRing({ score, stufe }: { score: number; stufe: ScoreStufe }) {
  const circumference = 2 * Math.PI * 38;
  const offset = circumference - (Math.min(100, Math.max(0, score)) / 100) * circumference;
  const s = SCORE_STYLE[stufe];
  return (
    <div className="relative flex items-center justify-center h-20 w-20">
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth="10" className="text-muted/20" />
        <circle
          cx="50" cy="50" r="38" fill="none" strokeWidth="10" strokeLinecap="round"
          className={s.ring}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="relative z-10 text-center">
        <div className={cn('text-lg font-black tabular-nums', s.text)}>{Math.round(score)}</div>
        <div className="text-[8px] text-muted-foreground font-bold uppercase">Score</div>
      </div>
    </div>
  );
}

export function DispatchPhase1387TourScoreEchtzeitHub({ drivers, batches, orders = [] }: Props) {
  const now = new Date();
  const [expanded, setExpanded] = useState<string | null>(null);

  const activeBatches = useMemo(
    () => batches.filter((b) => ['unterwegs', 'assigned', 'en_route', 'aktiv'].includes(b.status)),
    [batches],
  );

  const scoredBatches = useMemo(() =>
    activeBatches.map((b) => {
      const driver = drivers.find((d) => d.aktueller_batch_id === b.id);
      const name = b.fahrer
        ? `${b.fahrer.vorname} ${b.fahrer.nachname}`
        : driver?.employee
          ? `${driver.employee.vorname} ${driver.employee.nachname}`
          : 'Fahrer';

      const stops = [...(b.stops ?? [])].sort((a, c) => a.reihenfolge - c.reihenfolge);
      const done = stops.filter((s) => s.geliefert_am).length;
      const pct = stops.length > 0 ? Math.round((done / stops.length) * 100) : 0;

      const elapsed = b.startzeit || b.started_at
        ? Math.round((now.getTime() - new Date(b.startzeit ?? b.started_at!).getTime()) / 60000)
        : null;

      const rawScore = b.dispatch_score
        ?? orders.find((o) => b.stops?.some((s) => s.order_id === o.id))?.dispatch_score
        ?? null;
      const score = rawScore ?? (pct >= 80 ? 82 : pct >= 50 ? 65 : pct >= 25 ? 48 : 35);

      return { batch: b, name, stops, done, pct, elapsed, score, stufe: stufeOf(score) };
    }).sort((a, b) => b.score - a.score),
    [activeBatches, drivers, orders, now],
  );

  const avgScore = scoredBatches.length > 0
    ? scoredBatches.reduce((s, b) => s + b.score, 0) / scoredBatches.length
    : 0;

  if (scoredBatches.length === 0) return null;

  const avgStufe = stufeOf(avgScore);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-matcha-50 dark:bg-matcha-950/30">
        <Route className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Score Echtzeit-Hub</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{scoredBatches.length} Tour{scoredBatches.length !== 1 ? 'en' : ''} aktiv</span>
      </div>

      {/* Ø Score summary */}
      <div className="flex items-center gap-4 px-4 py-3 border-b border-border/60">
        <ScoreRing score={avgScore} stufe={avgStufe} />
        <div className="flex-1">
          <div className="text-xs text-muted-foreground font-medium mb-1">Ø Dispatch-Score (alle Touren)</div>
          <div className="flex flex-wrap gap-2">
            {scoredBatches.map((b) => {
              const s = SCORE_STYLE[b.stufe];
              return (
                <span key={b.batch.id} className={cn('text-[10px] font-bold rounded-full px-2 py-0.5', s.badge)}>
                  {b.name.split(' ')[0]} {Math.round(b.score)}
                </span>
              );
            })}
          </div>
          <div className={cn('mt-1.5 text-xs font-bold', SCORE_STYLE[avgStufe].text)}>
            {avgStufe === 'top' ? '⭐ Exzellente Schicht' :
             avgStufe === 'gut' ? '✓ Gute Performance' :
             avgStufe === 'ok'  ? '⚡ Verbesserungspotenzial' :
                                  '⚠ Sofort handeln'}
          </div>
        </div>
      </div>

      {/* Tour cards */}
      <div className="divide-y divide-border/50">
        {scoredBatches.map((row) => {
          const s = SCORE_STYLE[row.stufe];
          const isOpen = expanded === row.batch.id;
          return (
            <div key={row.batch.id} className={cn('transition-colors', s.bg)}>
              {/* Summary row */}
              <button
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                onClick={() => setExpanded(isOpen ? null : row.batch.id)}
              >
                {/* Score badge */}
                <span className={cn('shrink-0 w-10 text-center rounded-lg py-1 text-sm font-black', s.badge)}>
                  {Math.round(row.score)}
                </span>

                {/* Name + zone */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold truncate">{row.name}</span>
                    {row.batch.zone && (
                      <span className="text-[9px] bg-white/60 dark:bg-white/10 border border-border/50 rounded-full px-1.5 py-0.5 font-semibold text-muted-foreground">
                        Zone {row.batch.zone}
                      </span>
                    )}
                    <span className={cn('text-[9px] font-bold rounded-full px-1.5 py-0.5', s.badge)}>
                      {s.label}
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-1 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700',
                          row.stufe === 'top' ? 'bg-green-500' :
                          row.stufe === 'gut' ? 'bg-matcha-500' :
                          row.stufe === 'ok'  ? 'bg-amber-400' : 'bg-red-400')}
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold tabular-nums text-muted-foreground shrink-0">
                      {row.done}/{row.stops.length} Stopps
                    </span>
                  </div>
                </div>

                {/* Elapsed */}
                {row.elapsed !== null && (
                  <div className="shrink-0 text-right">
                    <div className={cn('font-mono text-sm font-black tabular-nums', s.text)}>{row.elapsed}m</div>
                    <div className="text-[8px] text-muted-foreground">vergangen</div>
                  </div>
                )}
              </button>

              {/* Expanded stop list */}
              {isOpen && (
                <div className="px-4 pb-3">
                  <div className="rounded-lg border border-border/50 overflow-hidden bg-background/60">
                    {row.stops.map((stop, i) => {
                      const ampel = etaAmpel(stop, now);
                      return (
                        <div key={stop.id} className={cn(
                          'flex items-center gap-2.5 px-3 py-2 text-xs',
                          i > 0 && 'border-t border-border/40',
                          stop.geliefert_am && 'opacity-60',
                        )}>
                          <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black bg-muted text-muted-foreground">
                            {stop.reihenfolge}
                          </span>
                          {stop.geliefert_am
                            ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                            : <Truck className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          }
                          <div className="flex-1 min-w-0">
                            <span className="font-semibold truncate">{stop.order?.kunde_name ?? '—'}</span>
                            {stop.order?.kunde_adresse && (
                              <span className="text-muted-foreground ml-1.5 text-[10px] truncate">{stop.order.kunde_adresse}</span>
                            )}
                          </div>
                          {ampel && (
                            <span className={cn('shrink-0 w-2 h-2 rounded-full', {
                              'bg-green-500': ampel === 'gruen',
                              'bg-yellow-400': ampel === 'gelb',
                              'bg-red-500': ampel === 'rot',
                            })} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-3 px-4 py-2 bg-muted/30 border-t border-border/50 text-[9px] text-muted-foreground">
        <span className="font-bold uppercase tracking-wider">Score-Ampel:</span>
        <span className="text-green-600 font-bold">≥85 Top</span>
        <span className="text-matcha-600 font-bold">65–84 Gut</span>
        <span className="text-amber-600 font-bold">40–64 OK</span>
        <span className="text-red-600 font-bold">&lt;40 Schwach</span>
      </div>
    </div>
  );
}
