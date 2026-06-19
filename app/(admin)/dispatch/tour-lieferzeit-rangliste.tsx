'use client';

import { useMemo } from 'react';
import { Trophy, Clock, CheckCircle2, AlertTriangle, Bike } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Batch {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: {
    id: string;
    order_id: string;
    reihenfolge: number;
    geliefert_am: string | null;
    order: { bestellnummer: string; kunde_name: string; eta_earliest: string | null; eta_latest: string | null } | null;
  }[];
}

interface Props {
  batches: Batch[];
}

type HealthLevel = 'on-time' | 'tight' | 'late' | 'unknown';

interface TourRow {
  id: string;
  driverName: string;
  zone: string | null;
  completedStops: number;
  totalStops: number;
  elapsedMin: number;
  etaMin: number | null;
  remainMin: number | null;
  health: HealthLevel;
  progressPct: number;
}

export function TourLieferzeitRangliste({ batches }: Props) {
  const now = Date.now();

  const rows: TourRow[] = useMemo(() => {
    const activeBatches = batches.filter(
      (b) => ['pickup', 'aktiv', 'unterwegs', 'zugewiesen', 'on_route', 'assigned', 'at_restaurant'].includes(b.status),
    );

    return activeBatches
      .map((b) => {
        const driverName = b.fahrer
          ? `${b.fahrer.vorname} ${b.fahrer.nachname[0]}.`
          : 'Fahrer';

        const startMs = b.startzeit ? new Date(b.startzeit).getTime() : null;
        const elapsedMin = startMs ? Math.floor((now - startMs) / 60_000) : 0;

        const totalStops = b.stops.filter((s) => s.order !== null).length;
        const completedStops = b.stops.filter((s) => s.geliefert_am !== null).length;

        const remainingStops = b.stops.filter((s) => s.geliefert_am === null && s.order !== null);
        let remainMin: number | null = null;

        // Check if any remaining stop has an ETA
        for (const stop of remainingStops) {
          const latestIso = stop.order?.eta_latest;
          if (latestIso) {
            const minsUntil = Math.floor((new Date(latestIso).getTime() - now) / 60_000);
            if (remainMin === null || minsUntil < remainMin) {
              remainMin = minsUntil;
            }
          }
        }

        // Fallback: use batch ETA
        const etaMin = b.total_eta_min;
        if (remainMin === null && startMs && etaMin) {
          remainMin = Math.floor((startMs + etaMin * 60_000 - now) / 60_000);
        }

        let health: HealthLevel = 'unknown';
        if (remainMin !== null) {
          if (remainMin >= 5) health = 'on-time';
          else if (remainMin >= 0) health = 'tight';
          else health = 'late';
        } else if (totalStops > 0) {
          health = 'unknown';
        }

        const progressPct = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

        return { id: b.id, driverName, zone: b.zone, completedStops, totalStops, elapsedMin, etaMin, remainMin, health, progressPct };
      })
      .sort((a, b) => {
        // Sort by health: late first, then tight, then unknown, then on-time
        const healthOrder: Record<HealthLevel, number> = { late: 0, tight: 1, unknown: 2, 'on-time': 3 };
        const diff = healthOrder[a.health] - healthOrder[b.health];
        if (diff !== 0) return diff;
        // Within same health level, sort by remaining time ascending
        if (a.remainMin !== null && b.remainMin !== null) return a.remainMin - b.remainMin;
        return 0;
      });
  }, [batches, now]);

  if (rows.length === 0) return null;

  const healthStyle: Record<HealthLevel, { bg: string; badge: string; barColor: string; label: string }> = {
    'on-time': { bg: 'bg-matcha-50/50',  badge: 'bg-matcha-100 text-matcha-800 border border-matcha-300', barColor: 'bg-matcha-500', label: 'Im Plan' },
    tight:     { bg: 'bg-amber-50/50',   badge: 'bg-amber-100 text-amber-800 border border-amber-300',   barColor: 'bg-amber-400',  label: 'Eng' },
    late:      { bg: 'bg-red-50/50',     badge: 'bg-red-100 text-red-800 border border-red-300',         barColor: 'bg-red-500',    label: 'Verspätet' },
    unknown:   { bg: 'bg-stone-50/50',   badge: 'bg-stone-100 text-stone-700 border border-stone-200',   barColor: 'bg-stone-400',  label: 'Unbekannt' },
  };

  const lateCount = rows.filter((r) => r.health === 'late').length;
  const onTimeCount = rows.filter((r) => r.health === 'on-time').length;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          <span className="text-xs font-bold uppercase tracking-wider">Tour-Lieferzeit-Rangliste</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
            {rows.length} aktiv
          </span>
        </div>
        <div className="flex items-center gap-2">
          {lateCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 text-[10px] font-bold">
              <AlertTriangle className="h-2.5 w-2.5" />
              {lateCount} verspätet
            </span>
          )}
          {onTimeCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-matcha-100 text-matcha-700 border border-matcha-200 px-2 py-0.5 text-[10px] font-bold">
              <CheckCircle2 className="h-2.5 w-2.5" />
              {onTimeCount} pünktlich
            </span>
          )}
        </div>
      </div>

      <div className="divide-y">
        {rows.map((row) => {
          const hs = healthStyle[row.health];
          return (
            <div key={row.id} className={cn('px-4 py-3 flex items-center gap-3', hs.bg)}>
              {/* Health badge */}
              <div className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black min-w-[58px] text-center', hs.badge)}>
                {hs.label}
              </div>

              {/* Driver + zone */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Bike className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-xs font-bold truncate">{row.driverName}</span>
                  {row.zone && (
                    <span className="text-[9px] rounded-full bg-white/60 border px-1.5 py-0.5 font-bold">
                      Zone {row.zone}
                    </span>
                  )}
                  {row.remainMin !== null && (
                    <span className={cn(
                      'text-[10px] font-bold tabular-nums',
                      row.health === 'late' ? 'text-red-600' : row.health === 'tight' ? 'text-amber-600' : 'text-matcha-600',
                    )}>
                      {row.remainMin < 0 ? `${Math.abs(row.remainMin)} Min überfällig` : `~${row.remainMin} Min verbleibend`}
                    </span>
                  )}
                </div>
                {/* Progress bar */}
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', hs.barColor)}
                      style={{ width: `${row.progressPct}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-bold tabular-nums shrink-0 text-muted-foreground">
                    {row.completedStops}/{row.totalStops}
                  </span>
                </div>
              </div>

              {/* Elapsed time */}
              <div className="shrink-0 text-right">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span className="font-mono text-sm font-black tabular-nums text-foreground">
                    {row.elapsedMin}m
                  </span>
                </div>
                <div className="text-[8px] text-muted-foreground">vergangen</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
