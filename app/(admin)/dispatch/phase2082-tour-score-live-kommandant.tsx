'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, ChevronDown, ChevronUp, Clock, MapPin, Route, Star, TrendingUp, Zap } from 'lucide-react';

/**
 * Phase 2082 — Tour-Score-Live-Kommandant (Dispatch)
 *
 * Zeigt alle aktiven Touren als vertikale Score-Cards:
 * - Fahrername + Tour-Fortschrittsring (Stops erledigt / gesamt)
 * - Score-Balken (0–100) mit Ampelfarbe
 * - Stop-Dot-Timeline (● erledigte, ○ ausstehende Stopps)
 * - Verbleibende ETA-Minuten
 * - Pünktlichkeits-Badge (pünktlich / knapp / verspätet)
 */

interface Batch {
  id: string;
  driver_id: string;
  status: string;
  started_at?: string | null;
  total_eta_min?: number | null;
}

interface Driver {
  id: string;
  vorname: string;
  nachname: string;
  status?: {
    ist_online: boolean;
    aktueller_batch_id?: string | null;
  } | null;
}

interface Stop {
  id: string;
  batch_id: string;
  reihenfolge?: number | null;
  angekommen_am?: string | null;
  geliefert_am?: string | null;
}

interface Props {
  batches: Batch[];
  drivers: Driver[];
  stops?: Stop[];
}

type Health = 'on-time' | 'tight' | 'late' | 'unknown';

function computeHealth(startedAt: string | null, etaMin: number | null, completedPct: number): Health {
  if (!startedAt || !etaMin) return 'unknown';
  const elapsedMin = (Date.now() - new Date(startedAt).getTime()) / 60_000;
  const usedPct = elapsedMin / etaMin;
  const diff = usedPct - completedPct;
  if (diff > 0.3) return 'late';
  if (diff > 0.1) return 'tight';
  return 'on-time';
}

function computeScore(completedPct: number, health: Health): number {
  let base = Math.round(completedPct * 70);
  if (health === 'on-time') base += 30;
  else if (health === 'tight') base += 15;
  else if (health === 'late') base += 0;
  return Math.min(100, Math.max(0, base));
}

const HEALTH_STYLE: Record<Health, { badge: string; label: string; color: string }> = {
  'on-time': { badge: 'bg-matcha-100 text-matcha-700', label: 'Pünktlich', color: 'bg-matcha-500' },
  tight:     { badge: 'bg-amber-100 text-amber-700',   label: 'Knapp',    color: 'bg-amber-400'   },
  late:      { badge: 'bg-red-100 text-red-700',       label: 'Verspätet', color: 'bg-red-500'    },
  unknown:   { badge: 'bg-muted text-muted-foreground', label: '–',        color: 'bg-muted-foreground' },
};

export function DispatchPhase2082TourScoreLiveKommandant({ batches, drivers, stops = [] }: Props) {
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const driverMap = useMemo(
    () => new Map(drivers.map((d) => [d.id, d])),
    [drivers],
  );

  const rows = useMemo(() => {
    const active = batches.filter((b) =>
      ['aktiv', 'unterwegs', 'assigned', 'at_restaurant', 'on_route'].includes(b.status),
    );

    return active
      .map((batch) => {
        const driver = driverMap.get(batch.driver_id);
        const batchStops = stops.filter((s) => s.batch_id === batch.id).sort(
          (a, b) => (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0),
        );
        const totalStops = batchStops.length;
        const completedStops = batchStops.filter((s) => s.geliefert_am).length;
        const completedPct = totalStops > 0 ? completedStops / totalStops : 0;
        const health = computeHealth(batch.started_at ?? null, batch.total_eta_min ?? null, completedPct);
        const score = computeScore(completedPct, health);

        const elapsedMin = batch.started_at
          ? Math.floor((Date.now() - new Date(batch.started_at).getTime()) / 60_000)
          : null;
        const remainMin =
          batch.total_eta_min && elapsedMin !== null
            ? Math.max(0, batch.total_eta_min - elapsedMin)
            : null;

        return { batch, driver, totalStops, completedStops, completedPct, health, score, elapsedMin, remainMin, batchStops };
      })
      .sort((a, b) => {
        const order: Health[] = ['late', 'tight', 'on-time', 'unknown'];
        return order.indexOf(a.health) - order.indexOf(b.health);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches, drivers, stops, tick]);

  if (rows.length === 0) return null;

  const avgScore = Math.round(rows.reduce((s, r) => s + r.score, 0) / rows.length);
  const lateCount = rows.filter((r) => r.health === 'late').length;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b hover:bg-muted/30 transition-colors"
      >
        <Route className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Score-Kommandant</span>
        {lateCount > 0 && (
          <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[9px] font-black animate-pulse">
            {lateCount}× verspätet
          </span>
        )}
        <span className="ml-auto font-mono text-sm font-black text-matcha-700">{avgScore}</span>
        <span className="text-[10px] text-muted-foreground">Ø Score</span>
        <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" /> : <ChevronDown className="h-4 w-4 text-muted-foreground ml-1" />}
      </button>

      {open && (
        <div className="divide-y">
          {rows.map(({ batch, driver, totalStops, completedStops, completedPct, health, score, elapsedMin, remainMin, batchStops }) => {
            const hs = HEALTH_STYLE[health];
            const scoreColor =
              score >= 80 ? 'text-matcha-700' :
              score >= 50 ? 'text-amber-600' :
              'text-red-600';
            const scoreBarColor =
              score >= 80 ? 'bg-matcha-500' :
              score >= 50 ? 'bg-amber-400' :
              'bg-red-500';

            const driverName = driver
              ? `${driver.vorname} ${driver.nachname.charAt(0)}.`
              : 'Unbekannt';

            return (
              <div key={batch.id} className="px-4 py-3 space-y-2">
                {/* Row 1: Fahrer + Health + ETA */}
                <div className="flex items-center gap-2">
                  <Bike className="h-4 w-4 text-matcha-600 shrink-0" />
                  <span className="text-sm font-bold text-foreground">{driverName}</span>
                  <span className={cn('ml-auto rounded-full px-2 py-0.5 text-[9px] font-bold', hs.badge)}>
                    {hs.label}
                  </span>
                  {remainMin !== null && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Clock className="h-3 w-3 text-muted-foreground" />
                      <span className="font-mono text-xs font-bold text-foreground tabular-nums">{remainMin}m</span>
                    </div>
                  )}
                </div>

                {/* Row 2: Score-Balken */}
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-3 w-3 text-muted-foreground shrink-0" />
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', scoreBarColor)}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                  <span className={cn('font-mono text-xs font-black tabular-nums shrink-0', scoreColor)}>
                    {score}
                  </span>
                </div>

                {/* Row 3: Stop-Dot-Timeline */}
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                  <div className="flex items-center gap-1 flex-wrap">
                    {totalStops > 0 ? (
                      Array.from({ length: totalStops }, (_, i) => (
                        <div
                          key={i}
                          className={cn(
                            'h-3 w-3 rounded-full border-2 transition-colors',
                            i < completedStops
                              ? 'bg-matcha-500 border-matcha-500'
                              : 'bg-transparent border-muted-foreground/40',
                          )}
                        />
                      ))
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Keine Stops</span>
                    )}
                  </div>
                  <span className="ml-auto text-[10px] text-muted-foreground font-mono tabular-nums shrink-0">
                    {completedStops}/{totalStops}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      {open && (
        <div className="flex items-center gap-2 px-4 py-2 border-t bg-muted/20">
          <Zap className="h-3 w-3 text-matcha-600" />
          <span className="text-[10px] text-muted-foreground">
            {rows.length} aktive Tour{rows.length !== 1 ? 'en' : ''} · 30s-Refresh
          </span>
        </div>
      )}
    </div>
  );
}
