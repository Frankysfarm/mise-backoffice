'use client';

/**
 * Phase 1890 — Tour-Score-Visualisierung-Live (Dispatch)
 *
 * Score je aktiver Tour: Effizienz (Stopps/Zeit), Pünktlichkeit, Abschlussgrad.
 * Farbkodierung: grün ≥80, gelb 50–79, rot <50.
 * Strich-Miniaturansicht je Tour. 15-Sek-Ticker. Collapsible.
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { BarChart2, ChevronDown, ChevronUp, Bike, Target } from 'lucide-react';

interface Stop {
  geliefert_am?: string | null;
}

interface Batch {
  id: string;
  status?: string | null;
  fahrer_id?: string | null;
  startzeit?: string | null;
  total_eta_min?: number | null;
  zone?: string | null;
  stops?: Stop[];
}

interface Driver {
  employee_id?: string | null;
  employee?: { vorname?: string; nachname?: string } | null;
}

interface Props {
  batches: Batch[];
  drivers: Driver[];
  className?: string;
}

const AKTIV_STATI = new Set(['unterwegs', 'on_route', 'gestartet', 'aktiv']);

function tourScore(batch: Batch, nowMs: number): number {
  const total  = batch.stops?.length ?? 0;
  const done   = batch.stops?.filter((s) => s.geliefert_am).length ?? 0;
  const etaMin = batch.total_eta_min ?? 30;
  const startMs = batch.startzeit ? new Date(batch.startzeit).getTime() : nowMs;
  const elapsedMin = (nowMs - startMs) / 60_000;

  const abschlussScore = total > 0 ? (done / total) * 100 : 50;
  const zeitScore      = elapsedMin <= etaMin
    ? 100
    : Math.max(0, 100 - ((elapsedMin - etaMin) / etaMin) * 100);
  const effizienzScore = etaMin > 0 && elapsedMin > 0
    ? Math.min(100, (done / Math.max(1, (elapsedMin / etaMin) * total)) * 100)
    : 100;

  return Math.round((abschlussScore * 0.4 + zeitScore * 0.4 + effizienzScore * 0.2));
}

function scoreColor(score: number) {
  if (score >= 80) return { text: 'text-matcha-700 dark:text-matcha-400', bg: 'bg-matcha-500', ring: 'ring-matcha-300', badge: 'bg-matcha-100 text-matcha-800 dark:bg-matcha-900/50 dark:text-matcha-300' };
  if (score >= 50) return { text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-400', ring: 'ring-amber-300', badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' };
  return { text: 'text-red-700 dark:text-red-400', bg: 'bg-red-500', ring: 'ring-red-300', badge: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' };
}

export function DispatchPhase1890TourScoreVisualisierungLive({ batches, drivers, className }: Props) {
  const [offen, setOffen] = useState(true);
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 15_000);
    return () => clearInterval(id);
  }, []);

  const rows = useMemo(() => {
    const now = Date.now();
    return batches
      .filter((b) => AKTIV_STATI.has(b.status ?? ''))
      .map((b) => {
        const driver = drivers.find((d) => d.employee_id === (b.fahrer_id ?? ''));
        const name = driver?.employee
          ? `${driver.employee.vorname ?? ''} ${(driver.employee.nachname ?? '')[0] ?? ''}.`
          : 'Fahrer';
        const score = tourScore(b, now);
        const total = b.stops?.length ?? 0;
        const done  = b.stops?.filter((s) => s.geliefert_am).length ?? 0;
        const pct   = total > 0 ? Math.round((done / total) * 100) : 0;
        return { id: b.id, name, score, total, done, pct, zone: b.zone ?? '—' };
      })
      .sort((a, b) => a.score - b.score);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches, drivers]);

  const avgScore = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : 0;
  const avgColors = scoreColor(avgScore);

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <BarChart2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Score · Live-Visualisierung</span>
        {rows.length > 0 && (
          <span className={cn('ml-1 rounded-full px-2 py-0.5 text-[10px] font-black', avgColors.badge)}>
            Ø {avgScore} Pkt
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground">{rows.length} aktive Touren</span>
        {offen
          ? <ChevronUp className="ml-1 h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="ml-1 h-4 w-4 text-muted-foreground" />}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {rows.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-3 flex items-center justify-center gap-2">
              <Bike className="h-4 w-4" />
              Keine aktiven Touren
            </div>
          ) : (
            <div className="space-y-2.5">
              {rows.map((row) => {
                const c = scoreColor(row.score);
                return (
                  <div key={row.id} className="rounded-xl border border-border bg-muted/10 px-3 py-2.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bike className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="text-xs font-bold">{row.name}</span>
                        <span className="text-[9px] rounded-full border px-1.5 py-0.5 text-muted-foreground">
                          Zone {row.zone}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Target className="h-3 w-3 text-muted-foreground" />
                        <span className={cn('text-sm font-black tabular-nums', c.text)}>
                          {row.score}
                        </span>
                        <span className="text-[9px] text-muted-foreground">/100</span>
                      </div>
                    </div>

                    {/* Score-Balken */}
                    <div className="h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', c.bg)}
                        style={{ width: `${row.score}%` }}
                      />
                    </div>

                    {/* Stopps-Fortschritt */}
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>{row.done} von {row.total} Stopps abgeschlossen</span>
                      <span className={cn('font-bold', c.text)}>{row.pct}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[10px] text-muted-foreground text-right">Score: 40% Abschluss · 40% Zeit · 20% Effizienz · Ticker 15 Sek</p>
        </div>
      )}
    </div>
  );
}
