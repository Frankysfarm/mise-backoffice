'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Clock, TrendingDown, TrendingUp, Minus, Bike } from 'lucide-react';

/**
 * Phase 1867 — Live-Flotten-Gesundheits-Matrix (Dispatch)
 *
 * Zeigt alle aktiven Fahrer mit ihrem aktuellen Gesundheits-Score:
 *  - Grün  ≥75: Flotte läuft optimal
 *  - Gelb  50–74: Leichte Warnsignale
 *  - Rot   <50: Intervention empfohlen
 *
 * Berechnet client-seitig aus Batch-Daten + Fahrerliste.
 * Keine API-Calls — rein reaktiv aus Props.
 */

interface Stop {
  id: string;
  status: string;
  geliefert_am?: string | null;
  sequence?: number | null;
}

interface Batch {
  id: string;
  driver_id: string | null;
  zone?: string | null;
  state?: string;
  created_at?: string | null;
  estimated_return_at?: string | null;
  stops?: Stop[];
  dispatch_score?: number | null;
}

interface Driver {
  id: string;
  name: string;
}

interface DriverHealth {
  id: string;
  name: string;
  score: number;
  zone: string;
  activeBatches: number;
  stopsTotal: number;
  stopsDone: number;
  isLate: boolean;
  trend: 'up' | 'down' | 'flat';
}

function calcDriverHealth(driver: Driver, batches: Batch[]): DriverHealth | null {
  const myBatches = batches.filter(
    (b) => b.driver_id === driver.id &&
    ['assigned', 'at_restaurant', 'on_route', 'pending_acceptance'].includes(b.state ?? ''),
  );
  if (myBatches.length === 0) return null;

  const stopsTotal = myBatches.reduce((sum, b) => sum + (b.stops?.length ?? 0), 0);
  const stopsDone = myBatches.reduce(
    (sum, b) => sum + (b.stops?.filter((s) => ['geliefert', 'abgeschlossen', 'delivered'].includes(s.status)).length ?? 0),
    0,
  );
  const pct = stopsTotal > 0 ? stopsDone / stopsTotal : 0;

  let score = myBatches[0]?.dispatch_score != null
    ? myBatches[0].dispatch_score
    : Math.round(55 + pct * 35);

  let isLate = false;
  myBatches.forEach((b) => {
    if (b.estimated_return_at && new Date(b.estimated_return_at).getTime() < Date.now()) {
      score = Math.max(20, score - 15);
      isLate = true;
    }
  });

  const zone = myBatches[0]?.zone ?? '—';

  return {
    id: driver.id,
    name: driver.name,
    score,
    zone,
    activeBatches: myBatches.length,
    stopsTotal,
    stopsDone,
    isLate,
    trend: pct > 0.6 ? 'up' : isLate ? 'down' : 'flat',
  };
}

function healthColor(score: number) {
  if (score >= 75) return { bar: 'bg-matcha-500', badge: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300', row: 'border-matcha-200 dark:border-matcha-800' };
  if (score >= 50) return { bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', row: 'border-amber-200 dark:border-amber-700' };
  return { bar: 'bg-red-500', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', row: 'border-red-200 dark:border-red-700' };
}

const TrendIcon = ({ trend }: { trend: DriverHealth['trend'] }) => {
  if (trend === 'up') return <TrendingUp className="h-3 w-3 text-matcha-500" />;
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
};

interface Props {
  batches: Batch[];
  drivers: Driver[];
  className?: string;
}

export function DispatchPhase1867LiveFlottenGesundheitsMatrix({ batches, drivers, className }: Props) {
  const [open, setOpen] = useState(true);

  const healths = useMemo(() => {
    return drivers
      .map((d) => calcDriverHealth(d, batches))
      .filter((h): h is DriverHealth => h !== null)
      .sort((a, b) => a.score - b.score);
  }, [batches, drivers]);

  if (healths.length === 0) return null;

  const redCount = healths.filter((h) => h.score < 50).length;
  const avgScore = Math.round(healths.reduce((s, h) => s + h.score, 0) / healths.length);

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Bike className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Flotten-Gesundheit
          </span>
          <span className={cn(
            'rounded-full px-2 py-0.5 text-[10px] font-bold',
            healthColor(avgScore).badge,
          )}>
            Ø {avgScore} · {healths.length} aktiv
          </span>
          {redCount > 0 && (
            <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-bold">
              {redCount} Alarm
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t px-5 py-4 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Health-Score je Fahrer · Live aus Tour-Daten
          </div>
          {healths.map((h) => {
            const c = healthColor(h.score);
            return (
              <div key={h.id} className={cn('flex items-center gap-3 rounded-xl border px-3 py-2', c.row)}>
                <div className="shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-bold">
                  {h.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold truncate">{h.name}</span>
                    <TrendIcon trend={h.trend} />
                    {h.isLate && (
                      <span className="text-[9px] font-bold text-red-600 uppercase">Verspätet</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', c.bar)}
                        style={{ width: `${h.score}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {h.stopsDone}/{h.stopsTotal} Stopps
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <span className={cn('rounded-lg px-2 py-1 text-xs font-black', c.badge)}>
                    {h.score}
                  </span>
                  <div className="text-[9px] text-muted-foreground mt-0.5">Zone {h.zone}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
