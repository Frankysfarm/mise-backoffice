'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Route, MapPin, Clock, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '@/components/ui/card';

// Phase 1471 — Tour-Score-Live-Visualisierung (Dispatch)
// Zeigt alle aktiven Touren als farbkodierte Score-Karten mit Stop-Fortschritt,
// ETA-Abweichung und Fahrer-Score; sortiert Worst-First; 30s-Polling.

interface Stop {
  id: string;
  geliefert_am?: string | null;
  eta?: string | null;
  adresse?: string | null;
}

interface Driver {
  id: string;
  name?: string | null;
  score?: number | null;
}

interface Batch {
  id: string;
  fahrer_id?: string | null;
  zone?: string | null;
  created_at?: string | null;
  abgefahren_am?: string | null;
  stops?: Stop[];
  score?: number | null;
}

interface Props {
  batches: Batch[];
  drivers: Driver[];
}

function calcScore(batch: Batch): number {
  if (batch.score != null) return Math.min(100, Math.max(0, batch.score));
  const stops = batch.stops ?? [];
  if (stops.length === 0) return 75;
  const done = stops.filter((s) => !!s.geliefert_am).length;
  return Math.round(50 + (done / stops.length) * 50);
}

function getScoreFarbe(score: number): 'gruen' | 'gelb' | 'orange' | 'rot' {
  if (score >= 85) return 'gruen';
  if (score >= 70) return 'gelb';
  if (score >= 55) return 'orange';
  return 'rot';
}

const FARB_CFG = {
  gruen:  { bar: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800' },
  gelb:   { bar: 'bg-amber-400',   badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',         border: 'border-amber-200 dark:border-amber-800' },
  orange: { bar: 'bg-orange-500',  badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',     border: 'border-orange-200 dark:border-orange-800' },
  rot:    { bar: 'bg-rose-500',    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300',             border: 'border-rose-300 dark:border-rose-700' },
};

function fmtElapsed(iso: string | null | undefined): string {
  if (!iso) return '—';
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function DispatchPhase1471TourScoreLiveVisualisierung({ batches, drivers }: Props) {
  const [tick, setTick] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const driverMap = useMemo(() => {
    const m = new Map<string, Driver>();
    drivers.forEach((d) => m.set(d.id, d));
    return m;
  }, [drivers]);

  const rows = useMemo(() => {
    return batches
      .filter((b) => (b.stops?.length ?? 0) > 0)
      .map((b) => {
        const driver = driverMap.get(b.fahrer_id ?? '');
        const stops = b.stops ?? [];
        const doneStops = stops.filter((s) => !!s.geliefert_am).length;
        const totalStops = stops.length;
        const pct = totalStops > 0 ? Math.round((doneStops / totalStops) * 100) : 0;
        const score = calcScore(b);
        const farbe = getScoreFarbe(score);
        const elapsed = fmtElapsed(b.abgefahren_am ?? b.created_at);
        return { batch: b, driver, doneStops, totalStops, pct, score, farbe, elapsed };
      })
      .sort((a, b) => a.score - b.score);
  }, [batches, driverMap, tick]);

  if (rows.length === 0) return null;

  const worstCount = rows.filter((r) => r.farbe === 'rot').length;

  return (
    <Card className="overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition"
        onClick={() => setCollapsed((c) => !c)}
      >
        <Route className="h-4 w-4 shrink-0 text-matcha-600" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Score Live</span>
        {worstCount > 0 && (
          <span className="text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 rounded-full px-2 py-0.5">
            {worstCount} kritisch
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">{rows.length} Touren</span>
        {collapsed
          ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="divide-y">
          {rows.map(({ batch, driver, doneStops, totalStops, pct, score, farbe, elapsed }) => {
            const cfg = FARB_CFG[farbe];
            return (
              <div key={batch.id} className="px-4 py-3 flex items-center gap-3">
                {/* Score badge */}
                <div className={cn('shrink-0 w-12 h-12 rounded-xl flex flex-col items-center justify-center border', cfg.border, 'bg-white dark:bg-card')}>
                  <Star className="h-3 w-3 text-muted-foreground mb-0.5" />
                  <span className="text-base font-black tabular-nums leading-none">{score}</span>
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold truncate">
                      {driver?.name ?? `Fahrer ${batch.fahrer_id?.slice(-4) ?? '?'}`}
                    </span>
                    {batch.zone && (
                      <span className="text-[9px] rounded-full border px-1.5 py-0.5 font-bold bg-muted">
                        Zone {batch.zone}
                      </span>
                    )}
                    <span className={cn('text-[9px] rounded-full px-1.5 py-0.5 font-bold', cfg.badge)}>
                      {farbe === 'gruen' ? 'Gut' : farbe === 'gelb' ? 'OK' : farbe === 'orange' ? 'Risiko' : 'Kritisch'}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', cfg.bar)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold tabular-nums text-muted-foreground shrink-0">
                      {doneStops}/{totalStops}
                    </span>
                  </div>

                  {/* Meta row */}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-2.5 w-2.5" />
                      {totalStops - doneStops} offen
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {elapsed}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
