'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Route, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Phase 2521 — Tour-Score Echtzeit-Hub (Dispatch)
 *
 * Konsolidierter Hub mit Score-Ring je aktivem Fahrer,
 * farbkodierten Stop-Dots, Fortschrittsbalken und ETA.
 * Polling: 25 Sekunden via fetch.
 */

interface Stop {
  id: string;
  reihenfolge?: number | null;
  angekommen_am?: string | null;
  geliefert_am?: string | null;
  adresse?: string | null;
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

type Health = 'on-time' | 'tight' | 'late' | 'idle' | 'done';

const HEALTH: Record<Health, {
  label: string; bg: string; border: string; text: string; dot: string; ring: string;
}> = {
  'on-time': { label: 'Pünktlich',  bg: 'bg-matcha-50 dark:bg-matcha-950/30', border: 'border-matcha-200 dark:border-matcha-800', text: 'text-matcha-700 dark:text-matcha-300', dot: 'bg-matcha-500', ring: 'text-matcha-500' },
  tight:     { label: 'Knapp',      bg: 'bg-amber-50  dark:bg-amber-950/30',   border: 'border-amber-200  dark:border-amber-800',   text: 'text-amber-700  dark:text-amber-300',   dot: 'bg-amber-400',  ring: 'text-amber-400'  },
  late:      { label: 'Verspätet', bg: 'bg-red-50    dark:bg-red-950/30',     border: 'border-red-200    dark:border-red-800',     text: 'text-red-700    dark:text-red-300',     dot: 'bg-red-500',    ring: 'text-red-500'    },
  idle:      { label: 'Wartet',    bg: 'bg-muted/30',                          border: 'border-border',                            text: 'text-muted-foreground',                  dot: 'bg-muted-foreground', ring: 'text-muted-foreground' },
  done:      { label: 'Fertig',    bg: 'bg-blue-50   dark:bg-blue-950/30',     border: 'border-blue-200   dark:border-blue-800',    text: 'text-blue-700   dark:text-blue-300',    dot: 'bg-blue-500',   ring: 'text-blue-500'   },
};

function scoreColor(score: number): string {
  if (score >= 75) return 'text-matcha-600 dark:text-matcha-400';
  if (score >= 50) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBar(score: number): string {
  if (score >= 75) return 'bg-matcha-500';
  if (score >= 50) return 'bg-amber-400';
  return 'bg-red-500';
}

function computeScore(elapsedMin: number, etaMin: number | null, done: number, total: number): number {
  const donePct = total > 0 ? done / total : 0;
  const usedPct = etaMin ? elapsedMin / Math.max(etaMin, 1) : 0;
  const timing = Math.max(0, 1 - Math.max(0, usedPct - donePct));
  return Math.round((timing * 0.6 + donePct * 0.4) * 100);
}

export function DispatchPhase2521TourScoreEchtzeitHub({ batches, drivers }: Props) {
  const [open, setOpen] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 25_000);
    return () => clearInterval(iv);
  }, []);

  const rows = useMemo(() => {
    const now = Date.now();
    const active = batches.filter(b =>
      ['unterwegs', 'on_route', 'gestartet', 'aktiv'].includes(b.status ?? '')
    );

    return active.map(b => {
      const driver = drivers.find(d => d.employee_id === (b.fahrer_id ?? ''));
      const name = driver?.employee
        ? `${driver.employee.vorname ?? ''} ${(driver.employee.nachname ?? '')[0] ?? ''}.`
        : 'Fahrer';

      const startMs = b.startzeit ? new Date(b.startzeit).getTime() : now;
      const elapsedMin = Math.floor((now - startMs) / 60_000);
      const totalStops = b.stops?.length ?? 0;
      const doneStops = b.stops?.filter(s => s.geliefert_am).length ?? 0;
      const etaMin = b.total_eta_min ?? null;
      const remainMin = etaMin ? Math.max(0, etaMin - elapsedMin) : null;
      const donePct = totalStops > 0 ? doneStops / totalStops : 0;
      const usedPct = etaMin ? elapsedMin / Math.max(etaMin, 1) : 0;

      let health: Health = 'idle';
      if (etaMin) {
        const delta = usedPct - donePct;
        if (donePct >= 1) health = 'done';
        else if (delta > 0.3) health = 'late';
        else if (delta > 0.1) health = 'tight';
        else health = 'on-time';
      } else if (totalStops > 0) {
        health = 'on-time';
      }

      const score = computeScore(elapsedMin, etaMin, doneStops, totalStops);
      return { b, name, elapsedMin, remainMin, totalStops, doneStops, donePct, score, health, etaMin };
    }).sort((a, b) => {
      const order: Health[] = ['late', 'tight', 'on-time', 'idle', 'done'];
      return order.indexOf(a.health) - order.indexOf(b.health);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches, drivers, tick]);

  if (rows.length === 0) return null;

  const avgScore = rows.length > 0
    ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length)
    : 0;
  const lateCount = rows.filter(r => r.health === 'late').length;
  const circumference = 2 * Math.PI * 16;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Route className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-xs font-bold uppercase tracking-wider">Tour-Score Echtzeit-Hub</span>
          <span className="rounded-full bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300 px-2 py-0.5 text-[10px] font-bold">
            Ø {avgScore}
          </span>
          {lateCount > 0 && (
            <span className="rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 text-[10px] font-black animate-pulse flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {lateCount} verspätet
            </span>
          )}
          <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-[10px] font-bold ml-auto">
            {rows.length} Tour{rows.length !== 1 ? 'en' : ''}
          </span>
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 ml-2" />}
      </button>

      {open && (
        <div className="border-t divide-y">
          {rows.map(({ b, name, elapsedMin, remainMin, totalStops, doneStops, donePct, score, health, etaMin }) => {
            const cfg = HEALTH[health];
            const dashOffset = circumference * (1 - score / 100);
            const isExpanded = expandedId === b.id;
            const scolor = scoreColor(score);
            const sbar = scoreBar(score);

            return (
              <div key={b.id} className={cn('px-4 py-3', cfg.bg)}>
                <div
                  className="flex items-start gap-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : b.id)}
                >
                  {/* Score-Ring */}
                  <div className="shrink-0 flex flex-col items-center gap-0.5">
                    <div className="relative h-9 w-9">
                      <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
                        <circle cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3.5" className="text-black/10 dark:text-white/10" />
                        <circle
                          cx="18" cy="18" r="16" fill="none" stroke="currentColor" strokeWidth="3.5"
                          className={cn(cfg.ring, health === 'late' && 'animate-pulse')}
                          strokeDasharray={circumference}
                          strokeDashoffset={dashOffset}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className={cn('absolute inset-0 flex items-center justify-center text-[10px] font-black', scolor)}>
                        {score}
                      </div>
                    </div>
                    <span className={cn('text-[8px] font-bold px-1 py-0.5 rounded border', cfg.bg, cfg.border, cfg.text)}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Main content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-foreground">{name}</span>
                      {b.zone && (
                        <span className="text-[9px] rounded-full border bg-white/60 dark:bg-white/10 px-1.5 py-0.5 font-bold">Zone {b.zone}</span>
                      )}
                      {remainMin !== null && (
                        <span className={cn('text-[10px] font-bold tabular-nums', cfg.text)}>
                          ~{remainMin}m verbleibend
                        </span>
                      )}
                    </div>

                    {/* Stop-Dots */}
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      {Array.from({ length: totalStops }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            'h-3 w-3 rounded-full border-2 flex items-center justify-center',
                            i < doneStops
                              ? 'border-matcha-500 bg-matcha-500 dark:border-matcha-400 dark:bg-matcha-400'
                              : 'border-border bg-background'
                          )}
                        >
                          {i < doneStops && <div className="h-1 w-1 rounded-full bg-white" />}
                        </div>
                      ))}
                      <span className="text-[9px] text-muted-foreground ml-1 font-bold">
                        {doneStops}/{totalStops}
                      </span>
                    </div>

                    {/* Fortschrittsbalken */}
                    <div className="mt-1.5 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', sbar)}
                        style={{ width: `${Math.round(donePct * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Elapsed */}
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-sm font-black tabular-nums">{elapsedMin}m</div>
                    {etaMin && (
                      <div className="text-[9px] text-muted-foreground">/{etaMin}m</div>
                    )}
                  </div>
                </div>

                {/* Expanded: Stop-Liste */}
                {isExpanded && b.stops && b.stops.length > 0 && (
                  <div className="mt-2 ml-12 space-y-1">
                    {b.stops
                      .slice()
                      .sort((a, bb) => (a.reihenfolge ?? 0) - (bb.reihenfolge ?? 0))
                      .map((stop, idx) => (
                        <div key={stop.id} className="flex items-center gap-2 text-[11px]">
                          {stop.geliefert_am
                            ? <CheckCircle2 className="h-3 w-3 text-matcha-500 shrink-0" />
                            : <div className="h-3 w-3 rounded-full border border-border shrink-0" />}
                          <span className="text-muted-foreground">Stop {idx + 1}</span>
                          {stop.adresse && (
                            <span className="text-foreground truncate">{stop.adresse}</span>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
