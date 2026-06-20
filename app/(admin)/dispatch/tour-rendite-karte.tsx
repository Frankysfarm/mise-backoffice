'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Euro, Route as RouteIcon, TrendingUp, Package, Zap } from 'lucide-react';

type BatchStop = {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  order?: { gesamtbetrag?: number } | null;
};

type Batch = {
  id: string;
  status: string;
  fahrer_id: string | null;
  startzeit?: string | null;
  total_eta_min: number | null;
  total_distance_km: number | null;
  zone: string | null;
  fahrer: { vorname: string; nachname: string } | null;
  stops: BatchStop[];
};

interface Props {
  batches: Batch[];
}

type TourRow = {
  id: string;
  driverName: string;
  zone: string | null;
  totalRevenue: number;
  deliveredRevenue: number;
  totalStops: number;
  completedStops: number;
  distanceKm: number | null;
  eurPerStop: number | null;
  eurPerKm: number | null;
  efficiencyScore: number;
  grade: 'A' | 'B' | 'C' | 'D';
};

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

export function DispatchTourRenditeKarte({ batches }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 25_000);
    return () => clearInterval(iv);
  }, []);

  const active = batches.filter((b) =>
    ['unterwegs', 'on_route', 'aktiv', 'assigned', 'gestartet'].includes(b.status),
  );

  if (active.length === 0) return null;

  const rows: TourRow[] = active.map((b) => {
    const totalRevenue = b.stops.reduce((s, stop) => s + (stop.order?.gesamtbetrag ?? 0), 0);
    const deliveredRevenue = b.stops
      .filter((s) => s.geliefert_am)
      .reduce((s, stop) => s + (stop.order?.gesamtbetrag ?? 0), 0);
    const totalStops = b.stops.length;
    const completedStops = b.stops.filter((s) => s.geliefert_am).length;
    const distanceKm = b.total_distance_km ?? null;
    const eurPerStop = totalStops > 0 ? totalRevenue / totalStops : null;
    const eurPerKm = distanceKm && distanceKm > 0 ? totalRevenue / distanceKm : null;

    // Efficiency score: higher EUR/stop = better (50+ = A)
    const epsScore = eurPerStop ? Math.min(100, (eurPerStop / 20) * 100) : 0;
    const epkScore = eurPerKm ? Math.min(100, (eurPerKm / 5) * 100) : 0;
    const loadScore = totalStops >= 3 ? 100 : (totalStops / 3) * 100;
    const efficiencyScore = Math.round((epsScore * 0.5 + epkScore * 0.3 + loadScore * 0.2));

    const grade: TourRow['grade'] =
      efficiencyScore >= 80 ? 'A' :
      efficiencyScore >= 60 ? 'B' :
      efficiencyScore >= 40 ? 'C' : 'D';

    return {
      id: b.id,
      driverName: b.fahrer ? `${b.fahrer.vorname} ${b.fahrer.nachname[0]}.` : 'Fahrer',
      zone: b.zone,
      totalRevenue,
      deliveredRevenue,
      totalStops,
      completedStops,
      distanceKm,
      eurPerStop,
      eurPerKm,
      efficiencyScore,
      grade,
    };
  }).sort((a, b) => b.efficiencyScore - a.efficiencyScore);

  const gradeStyle: Record<string, { bg: string; text: string; border: string }> = {
    A: { bg: 'bg-matcha-50',  text: 'text-matcha-700', border: 'border-matcha-200' },
    B: { bg: 'bg-blue-50',    text: 'text-blue-700',   border: 'border-blue-200'   },
    C: { bg: 'bg-amber-50',   text: 'text-amber-700',  border: 'border-amber-200'  },
    D: { bg: 'bg-red-50',     text: 'text-red-700',    border: 'border-red-200'    },
  };

  const totalAllRevenue = rows.reduce((s, r) => s + r.totalRevenue, 0);
  const avgScore = Math.round(rows.reduce((s, r) => s + r.efficiencyScore, 0) / rows.length);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
        <Euro className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Tour-Rendite · Live</span>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground font-medium">
            Ø Score: <span className={cn('font-black', avgScore >= 70 ? 'text-matcha-700' : avgScore >= 50 ? 'text-amber-600' : 'text-red-600')}>{avgScore}</span>
          </span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold text-muted-foreground">
            {fmtEur(totalAllRevenue)} total
          </span>
        </div>
      </div>

      {/* Tour rows */}
      <div className="divide-y">
        {rows.map((row) => {
          const gs = gradeStyle[row.grade];
          return (
            <div key={row.id} className={cn('px-4 py-3', gs.bg)}>
              <div className="flex items-start gap-3">
                {/* Grade badge */}
                <div className={cn(
                  'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-lg font-black border',
                  gs.text, gs.border, 'bg-white/60',
                )}>
                  {row.grade}
                </div>

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold">{row.driverName}</span>
                    {row.zone && (
                      <span className="text-[9px] rounded-full bg-white/60 border px-1.5 py-0.5 font-bold">
                        Zone {row.zone}
                      </span>
                    )}
                  </div>

                  {/* KPI mini-grid */}
                  <div className="mt-1.5 grid grid-cols-3 gap-1">
                    <div className="rounded bg-white/50 px-1.5 py-1 text-center">
                      <div className={cn('text-xs font-black tabular-nums', gs.text)}>
                        {row.eurPerStop ? fmtEur(row.eurPerStop) : '—'}
                      </div>
                      <div className="text-[8px] text-muted-foreground">EUR/Stop</div>
                    </div>
                    <div className="rounded bg-white/50 px-1.5 py-1 text-center">
                      <div className={cn('text-xs font-black tabular-nums', gs.text)}>
                        {row.eurPerKm ? fmtEur(row.eurPerKm) : '—'}
                      </div>
                      <div className="text-[8px] text-muted-foreground">EUR/km</div>
                    </div>
                    <div className="rounded bg-white/50 px-1.5 py-1 text-center">
                      <div className={cn('text-xs font-black tabular-nums', gs.text)}>
                        {row.completedStops}/{row.totalStops}
                      </div>
                      <div className="text-[8px] text-muted-foreground">Stops</div>
                    </div>
                  </div>

                  {/* Revenue progress bar */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-black/8 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-700',
                          row.grade === 'A' ? 'bg-matcha-500' :
                          row.grade === 'B' ? 'bg-blue-500' :
                          row.grade === 'C' ? 'bg-amber-500' : 'bg-red-500',
                        )}
                        style={{
                          width: `${row.totalRevenue > 0
                            ? Math.min(100, (row.deliveredRevenue / row.totalRevenue) * 100)
                            : 0}%`,
                        }}
                      />
                    </div>
                    <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">
                      {fmtEur(row.deliveredRevenue)} / {fmtEur(row.totalRevenue)}
                    </span>
                  </div>
                </div>

                {/* Score */}
                <div className="shrink-0 text-right">
                  <div className={cn('text-lg font-black tabular-nums', gs.text)}>{row.efficiencyScore}</div>
                  <div className="text-[8px] text-muted-foreground">Score</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 text-[9px] text-muted-foreground border-t bg-muted/10">
        Score = EUR/Stop (50%) + EUR/km (30%) + Stop-Auslastung (20%) · alle {rows.length} aktiven Tour{rows.length !== 1 ? 'en' : ''}
      </div>
    </div>
  );
}
