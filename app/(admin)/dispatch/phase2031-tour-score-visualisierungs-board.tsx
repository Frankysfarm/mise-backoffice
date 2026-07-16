'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Route, Clock, TrendingUp, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';

interface Batch {
  id: string;
  driver_id?: string | null;
  zone?: string | null;
  status?: string | null;
  created_at?: string;
  stops?: Stop[];
}

interface Stop {
  id: string;
  status?: string | null;
  delivered_at?: string | null;
  scheduled_for?: string | null;
  address?: string | null;
}

interface Driver {
  id: string;
  name?: string | null;
  score?: number | null;
}

interface Props {
  batches?: Batch[];
  drivers?: Driver[];
}

type Health = 'late' | 'tight' | 'ok' | 'unknown';

function healthOf(elapsedMin: number, completedPct: number): Health {
  const expectedPct = Math.min(100, elapsedMin * 3.5); // ~28 min full tour
  const delta = completedPct - expectedPct;
  if (delta < -30) return 'late';
  if (delta < -15) return 'tight';
  return 'ok';
}

const HEALTH_CONFIG: Record<Health, { bg: string; border: string; label: string; badgeClass: string; barColor: string }> = {
  late:    { bg: 'bg-red-50 dark:bg-red-900/20',    border: 'border-l-red-400',   label: 'Verspätet',  badgeClass: 'bg-red-500 text-white',       barColor: 'bg-red-400' },
  tight:   { bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-l-amber-400', label: 'Knapp',      badgeClass: 'bg-amber-400 text-white',      barColor: 'bg-amber-400' },
  ok:      { bg: 'bg-matcha-50 dark:bg-matcha-900/20', border: 'border-l-matcha-500', label: 'Pünktlich', badgeClass: 'bg-matcha-600 text-white',   barColor: 'bg-matcha-500' },
  unknown: { bg: 'bg-muted/30',                       border: 'border-l-muted-foreground/30', label: 'Unbekannt', badgeClass: 'bg-muted text-muted-foreground', barColor: 'bg-muted-foreground/40' },
};

function scoreColor(score: number | null | undefined) {
  if (!score) return 'text-muted-foreground';
  if (score >= 80) return 'text-matcha-700 dark:text-matcha-400';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

export function DispatchPhase2031TourScoreVisualisierungsBoard({ batches = [], drivers = [] }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const driverMap = useMemo(() => {
    const m = new Map<string, Driver>();
    drivers.forEach(d => d.id && m.set(d.id, d));
    return m;
  }, [drivers]);

  const activeBatches = useMemo(() => {
    const now = Date.now();
    return batches
      .filter(b => b.status !== 'completed' && b.status !== 'cancelled')
      .map(b => {
        const stops = b.stops ?? [];
        const total = stops.length;
        const done = stops.filter(s => s.status === 'delivered' || s.status === 'completed').length;
        const pct = total > 0 ? Math.round((done / total) * 100) : 0;
        const elapsed = b.created_at
          ? Math.round((now - new Date(b.created_at).getTime()) / 60000)
          : 0;
        const driver = b.driver_id ? driverMap.get(b.driver_id) : null;
        const health: Health = total === 0 ? 'unknown' : healthOf(elapsed, pct);

        return { batch: b, total, done, pct, elapsed, driver, health };
      })
      .sort((a, b) => {
        const rank: Record<Health, number> = { late: 0, tight: 1, ok: 2, unknown: 3 };
        return rank[a.health] - rank[b.health];
      });
  }, [batches, driverMap]);

  if (activeBatches.length === 0) return null;

  const lateCount = activeBatches.filter(r => r.health === 'late').length;
  const tightCount = activeBatches.filter(r => r.health === 'tight').length;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20 text-left hover:bg-muted/30 transition-colors"
      >
        <Route className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">
          Tour-Score · Visualisierungs-Board
        </span>
        {lateCount > 0 && (
          <span className="rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-black text-white">
            {lateCount} spät
          </span>
        )}
        {tightCount > 0 && (
          <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black text-white">
            {tightCount} knapp
          </span>
        )}
        <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold text-muted-foreground ml-1">
          {activeBatches.length} Tour{activeBatches.length !== 1 ? 'en' : ''}
        </span>
        {collapsed ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
      </button>

      {!collapsed && (
        <div className="divide-y divide-border">
          {activeBatches.map(row => {
            const cfg = HEALTH_CONFIG[row.health];
            return (
              <div key={row.batch.id} className={cn('px-4 py-3 border-l-4 flex items-start gap-3', cfg.bg, cfg.border)}>
                {/* Status badge */}
                <span className={cn('shrink-0 mt-0.5 rounded-full px-2 py-0.5 text-[9px] font-black min-w-[58px] text-center', cfg.badgeClass)}>
                  {cfg.label}
                </span>

                {/* Main info */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold truncate">
                      {row.driver?.name ?? 'Fahrer N/A'}
                    </span>
                    {row.batch.zone && (
                      <span className="rounded-full bg-white/60 border px-1.5 py-0.5 text-[9px] font-bold">
                        Zone {row.batch.zone}
                      </span>
                    )}
                    {row.driver?.score != null && (
                      <span className={cn('text-[9px] font-black', scoreColor(row.driver.score))}>
                        Score {row.driver.score}
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', cfg.barColor)}
                        style={{ width: `${row.pct}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold tabular-nums text-muted-foreground shrink-0">
                      {row.done}/{row.total} Stopps
                    </span>
                  </div>
                </div>

                {/* Elapsed time */}
                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm font-black tabular-nums">{row.elapsed}m</div>
                  <div className="text-[8px] text-muted-foreground">aktiv</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-4 px-4 py-2 border-t bg-muted/10 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-500" /> Spät: {lateCount}</span>
        <span className="flex items-center gap-1"><Clock className="h-3 w-3 text-amber-500" /> Knapp: {tightCount}</span>
        <span className="flex items-center gap-1 ml-auto"><CheckCircle2 className="h-3 w-3 text-matcha-500" /> {activeBatches.length - lateCount - tightCount} pünktlich</span>
      </div>
    </div>
  );
}
