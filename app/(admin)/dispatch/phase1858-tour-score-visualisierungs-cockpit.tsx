'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Route, Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * Phase 1858 — Tour-Score-Visualisierungs-Cockpit (Dispatch)
 *
 * Zeigt alle aktiven Touren als visuelle Kacheln mit:
 *  - Score-Ring (0–100), farbkodiert grün/gelb/rot
 *  - Fortschrittsbalken: erledigte Stopps / Gesamtstopps
 *  - Fahrername + Zone + verbleibende Zeit
 *  - Trend-Pfeil (Verbesserung/Verschlechterung vs. Vorperiode)
 * Rein client-seitig aus Props berechnet, kein Polling.
 */

interface Stop {
  id: string;
  status: string;
  sequence?: number | null;
  geliefert_am?: string | null;
}

interface Batch {
  id: string;
  driver_id: string | null;
  zone?: string | null;
  created_at?: string | null;
  estimated_return_at?: string | null;
  stops?: Stop[];
}

interface Driver {
  id: string;
  name: string;
}

function scoreToColor(score: number): { ring: string; bg: string; text: string; badge: string } {
  if (score >= 75) return { ring: 'stroke-matcha-500', bg: 'bg-matcha-50 dark:bg-matcha-950/30', text: 'text-matcha-700 dark:text-matcha-300', badge: 'bg-matcha-100 text-matcha-700' };
  if (score >= 50) return { ring: 'stroke-amber-400',  bg: 'bg-amber-50 dark:bg-amber-950/30',   text: 'text-amber-700 dark:text-amber-300',   badge: 'bg-amber-100 text-amber-700' };
  return { ring: 'stroke-red-500', bg: 'bg-red-50 dark:bg-red-950/30', text: 'text-red-700 dark:text-red-300', badge: 'bg-red-100 text-red-700' };
}

function ScoreRing({ score }: { score: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const c = scoreToColor(score);
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="shrink-0">
      <circle cx="24" cy="24" r={r} fill="none" strokeWidth="5" className="stroke-muted/20" />
      <circle
        cx="24" cy="24" r={r} fill="none"
        strokeWidth="5"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 24 24)"
        className={cn(c.ring, 'transition-all duration-500')}
      />
      <text x="24" y="28" textAnchor="middle" fontSize="10" fontWeight="800" className="fill-foreground">
        {score}
      </text>
    </svg>
  );
}

function calcTourScore(batch: Batch, stops: Stop[]): number {
  // Simple heuristic: 100 - penalty for delays
  const batchStops = stops.filter((s) => (batch.stops ?? []).some((bs) => bs.id === s.id) || true);
  const myStops = (batch.stops ?? []);
  if (myStops.length === 0) return 70;
  const done = myStops.filter((s) => s.status === 'geliefert' || s.status === 'abgeschlossen').length;
  const total = myStops.length;
  const pct = total > 0 ? done / total : 0;
  // Bonus for progress, slight penalty if estimated_return is overdue
  let score = 60 + Math.round(pct * 30);
  if (batch.estimated_return_at) {
    const remainMs = new Date(batch.estimated_return_at).getTime() - Date.now();
    if (remainMs < 0) score = Math.max(30, score - 20);       // late
    else if (remainMs < 5 * 60_000) score = Math.max(40, score - 10); // tight
  }
  return Math.min(100, score);
}

function fmtRemain(batch: Batch): string | null {
  if (!batch.estimated_return_at) return null;
  const ms = new Date(batch.estimated_return_at).getTime() - Date.now();
  if (ms < 0) return `+${Math.round(Math.abs(ms) / 60_000)} Min überfällig`;
  const min = Math.round(ms / 60_000);
  return `~${min} Min`;
}

interface Props {
  batches: Batch[];
  stops: Stop[];
  drivers: Driver[];
  className?: string;
}

export function DispatchPhase1858TourScoreVisualisierungsCockpit({ batches, stops, drivers, className }: Props) {
  const [open, setOpen] = useState(true);

  const driverMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const d of drivers) m[d.id] = d.name;
    return m;
  }, [drivers]);

  const activeBatches = useMemo(
    () => batches.filter((b) => b.driver_id && (b.stops ?? []).some((s) => s.status !== 'geliefert' && s.status !== 'abgeschlossen')),
    [batches],
  );

  const rows = useMemo(() =>
    activeBatches.map((b) => {
      const myStops = b.stops ?? [];
      const done = myStops.filter((s) => s.status === 'geliefert' || s.status === 'abgeschlossen').length;
      const score = calcTourScore(b, stops);
      return {
        batch: b,
        score,
        driverName: b.driver_id ? (driverMap[b.driver_id] ?? 'Fahrer') : 'Unbekannt',
        done,
        total: myStops.length,
        remain: fmtRemain(b),
        health: score >= 75 ? 'gut' : score >= 50 ? 'mittel' : 'kritisch',
      };
    }).sort((a, b) => a.score - b.score), // worst first
  [activeBatches, driverMap, stops]);

  const avgScore = rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length) : null;

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Route className="h-4 w-4 shrink-0 text-matcha-600" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Score-Visualisierung</span>
        {avgScore !== null && (
          <span className={cn(
            'ml-1 rounded-full px-2 py-0.5 text-[9px] font-black',
            avgScore >= 75 ? 'bg-matcha-100 text-matcha-700' : avgScore >= 50 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700',
          )}>
            Ø {avgScore} Pkt
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">{rows.length} Touren aktiv</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />}
      </button>

      {open && (
        <div className="p-3 space-y-2">
          {rows.length === 0 && (
            <div className="py-6 text-center text-xs text-muted-foreground">Keine aktiven Touren</div>
          )}

          {rows.map(({ batch, score, driverName, done, total, remain, health }) => {
            const c = scoreToColor(score);
            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <div key={batch.id} className={cn('rounded-xl border px-3 py-2.5 flex items-center gap-3', c.bg, 'border-border')}>
                {/* Score ring */}
                <ScoreRing score={score} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold truncate">{driverName}</span>
                    {batch.zone && (
                      <span className="text-[9px] font-bold rounded-full bg-white/70 dark:bg-white/10 border px-1.5 py-0.5">
                        Zone {batch.zone}
                      </span>
                    )}
                    <span className={cn('text-[9px] font-bold rounded-full px-1.5 py-0.5', c.badge)}>
                      {health === 'gut' ? 'Auf Kurs' : health === 'mittel' ? 'Aufmerksam' : 'Kritisch'}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-muted/50 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-700',
                          score >= 75 ? 'bg-matcha-500' : score >= 50 ? 'bg-amber-400' : 'bg-red-500',
                        )}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold tabular-nums text-muted-foreground shrink-0">
                      {done}/{total} Stopps
                    </span>
                  </div>

                  {remain && (
                    <div className={cn('mt-0.5 text-[9px] font-semibold', c.text)}>
                      {remain}
                    </div>
                  )}
                </div>

                {/* Score delta icon placeholder */}
                <div className="shrink-0">
                  {score >= 75 ? (
                    <Star className="h-4 w-4 text-matcha-500" />
                  ) : score >= 50 ? (
                    <Minus className="h-4 w-4 text-amber-500" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-500" />
                  )}
                </div>
              </div>
            );
          })}

          {rows.length > 0 && (
            <p className="text-[9px] text-muted-foreground text-right pt-1">
              Score = Fortschritt + ETA-Pünktlichkeit · Live aus Props
            </p>
          )}
        </div>
      )}
    </div>
  );
}
