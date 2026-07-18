'use client';

import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Route, Trophy, Zap, Clock, MapPin, AlertTriangle, TrendingUp } from 'lucide-react';

/**
 * Phase 1000 — Tour-Score Cockpit Pro (Dispatch)
 *
 * Erweiterte Score-Visualisierung mit:
 * - Fahrer-Rangliste nach Tour-Score
 * - Farbkodierte Stopps-Fortschrittsleiste
 * - Echtzeit-ETA-Ampel pro Tour
 */

interface Stop {
  id: string;
  reihenfolge: number;
  angekommen_am?: string | null;
  geliefert_am?: string | null;
  estimated_arrival?: string | null;
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

type ScoreLevel = 'top' | 'gut' | 'mittel' | 'kritisch';

const SCORE_STYLE: Record<ScoreLevel, { ring: string; badge: string; text: string; label: string; icon: string }> = {
  top:      { ring: 'stroke-matcha-500', badge: 'bg-matcha-100 dark:bg-matcha-900/30 border-matcha-300', text: 'text-matcha-700 dark:text-matcha-300', label: 'Top',      icon: '🏆' },
  gut:      { ring: 'stroke-blue-500',   badge: 'bg-blue-100 dark:bg-blue-900/30 border-blue-300',       text: 'text-blue-700 dark:text-blue-300',     label: 'Gut',      icon: '👍' },
  mittel:   { ring: 'stroke-amber-400',  badge: 'bg-amber-100 dark:bg-amber-900/30 border-amber-300',    text: 'text-amber-700 dark:text-amber-300',   label: 'Mittel',   icon: '⚡' },
  kritisch: { ring: 'stroke-red-500',    badge: 'bg-red-100 dark:bg-red-900/30 border-red-300',          text: 'text-red-700 dark:text-red-300',        label: 'Kritisch', icon: '⚠️' },
};

function scoreLevel(score: number): ScoreLevel {
  if (score >= 80) return 'top';
  if (score >= 60) return 'gut';
  if (score >= 40) return 'mittel';
  return 'kritisch';
}

function calcScore(elapsedMin: number, etaMin: number | null, done: number, total: number): number {
  const donePct = total > 0 ? done / total : 0;
  const usedPct = etaMin ? Math.min(1.5, elapsedMin / Math.max(etaMin, 1)) : 0;
  const timing  = Math.max(0, 1 - Math.max(0, usedPct - donePct) * 2);
  const progress = donePct;
  return Math.round((timing * 0.55 + progress * 0.45) * 100);
}

export function DispatchPhase1000TourScoreCockpitPro({ batches, drivers }: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const tours = useMemo(() => {
    const now = Date.now();
    const active = batches.filter(b =>
      ['unterwegs', 'on_route', 'gestartet', 'aktiv'].includes(b.status ?? ''),
    );

    return active.map(b => {
      const driver = drivers.find(d => d.employee_id === (b.fahrer_id ?? ''));
      const name = driver?.employee
        ? `${driver.employee.vorname ?? ''} ${(driver.employee.nachname ?? '')[0] ?? ''}.`
        : 'Fahrer';

      const startMs = b.startzeit ? new Date(b.startzeit).getTime() : now;
      const elapsedMin = Math.max(0, Math.floor((now - startMs) / 60_000));
      const total = b.stops?.length ?? 0;
      const done  = b.stops?.filter(s => s.geliefert_am).length ?? 0;
      const eta   = b.total_eta_min ?? null;
      const remain = eta ? Math.max(0, eta - elapsedMin) : null;
      const score = calcScore(elapsedMin, eta, done, total);
      const level = scoreLevel(score);

      return { id: b.id, name, zone: b.zone, elapsedMin, remain, total, done, eta, score, level, stops: b.stops ?? [] };
    }).sort((a, b) => b.score - a.score);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches, drivers, tick]);

  if (tours.length === 0) return null;

  const avgScore   = Math.round(tours.reduce((s, t) => s + t.score, 0) / tours.length);
  const kritisch   = tours.filter(t => t.level === 'kritisch').length;
  const topFahrer  = tours[0];

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">Tour-Score Cockpit</span>
          <span className="rounded-full bg-matcha-100 dark:bg-matcha-900/30 border border-matcha-300 px-2 py-0.5 text-[10px] font-bold text-matcha-700 dark:text-matcha-300">
            Ø {avgScore}
          </span>
          {kritisch > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-300 px-2 py-0.5 text-[10px] font-black text-red-700 dark:text-red-300 animate-pulse">
              <AlertTriangle className="h-3 w-3" />
              {kritisch} kritisch
            </span>
          )}
          <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 px-2 py-0.5 text-[10px] font-bold text-zinc-600 dark:text-zinc-400">
            {tours.length} Touren
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t divide-y">
          {tours.map((t, idx) => {
            const s  = SCORE_STYLE[t.level];
            const scoreColor = t.score >= 80 ? 'text-matcha-700 dark:text-matcha-300' : t.score >= 60 ? 'text-blue-700 dark:text-blue-300' : t.score >= 40 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
            const barColor   = t.score >= 80 ? 'bg-matcha-500' : t.score >= 60 ? 'bg-blue-500' : t.score >= 40 ? 'bg-amber-400' : 'bg-red-500';
            const donePct    = t.total > 0 ? (t.done / t.total) * 100 : 0;

            return (
              <div key={t.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  {/* Rank + Score ring */}
                  <div className="shrink-0 flex flex-col items-center gap-0.5">
                    <span className="text-[9px] font-black text-muted-foreground">#{idx + 1}</span>
                    <div className="relative h-10 w-10">
                      <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
                        <circle cx="18" cy="18" r="14" fill="none" strokeWidth="4" className="stroke-black/10 dark:stroke-white/10" />
                        <circle
                          cx="18" cy="18" r="14" fill="none" strokeWidth="4"
                          className={s.ring}
                          strokeDasharray={`${(t.score / 100) * 87.96} 87.96`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className={cn('absolute inset-0 flex items-center justify-center text-[10px] font-black', scoreColor)}>
                        {t.score}
                      </div>
                    </div>
                    <span className={cn('text-[8px] font-bold rounded-full border px-1.5 py-0.5', s.badge, s.text)}>
                      {s.icon} {s.label}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold">{t.name}</span>
                      {t.zone && (
                        <span className="text-[9px] rounded-full border bg-muted/50 px-1.5 py-0.5 font-bold">
                          <MapPin className="h-2.5 w-2.5 inline mr-0.5" />{t.zone}
                        </span>
                      )}
                      {t.remain !== null && (
                        <span className={cn('text-[10px] font-bold tabular-nums', s.text)}>
                          <Clock className="h-2.5 w-2.5 inline mr-0.5" />~{t.remain} Min
                        </span>
                      )}
                    </div>

                    {/* Stop timeline dots */}
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {Array.from({ length: t.total }).map((_, i) => {
                        const isDone = i < t.done;
                        return (
                          <div
                            key={i}
                            className={cn(
                              'h-3 w-3 rounded-full border-2 flex items-center justify-center transition-colors',
                              isDone ? 'border-matcha-500 bg-matcha-500' : 'border-border bg-background',
                            )}
                          >
                            {isDone && <div className="h-1 w-1 rounded-full bg-white" />}
                          </div>
                        );
                      })}
                      <span className="text-[9px] text-muted-foreground ml-1 font-bold">
                        {t.done}/{t.total} Stopps
                      </span>
                    </div>

                    {/* Progress */}
                    <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', barColor)}
                        style={{ width: `${donePct}%` }}
                      />
                    </div>
                  </div>

                  {/* Elapsed */}
                  <div className="shrink-0 text-right text-[10px] font-mono font-bold tabular-nums text-muted-foreground">
                    <div>{t.elapsedMin}m</div>
                    {t.eta && <div className="text-[9px]">/ {t.eta}m</div>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer: Spitzenreiter */}
      {open && topFahrer && (
        <div className="px-4 py-2 border-t bg-muted/20 flex items-center gap-2">
          <TrendingUp className="h-3 w-3 text-matcha-600" />
          <span className="text-[10px] text-muted-foreground">
            Spitzenreiter: <strong className="text-foreground">{topFahrer.name}</strong> mit Score <strong>{topFahrer.score}</strong>
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
            <Zap className="h-3 w-3" /> Live
          </span>
        </div>
      )}
    </div>
  );
}
