'use client';

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, Clock, MapPin, TrendingUp, AlertTriangle } from 'lucide-react';

interface Stop {
  geliefert_am?: string | null;
  order_id?: string;
  reihenfolge?: number;
}

interface Fahrer {
  vorname: string;
  nachname: string;
}

interface Batch {
  id: string;
  fahrer_id?: string | null;
  status: string;
  startzeit?: string | null;
  total_eta_min?: number | null;
  total_distance_km?: number | null;
  zone?: string | null;
  fahrer?: Fahrer | null;
  stops: Stop[];
}

interface Driver {
  employee_id?: string;
  ist_online?: boolean;
  employee?: { vorname: string; nachname: string } | null;
  vorname?: string;
  nachname?: string;
}

interface Props {
  batches: Batch[];
  drivers?: Driver[];
}

type TourHealth = 'ok' | 'tight' | 'late';

interface TourRow {
  id: string;
  driverName: string;
  zone: string | null;
  totalStops: number;
  completedStops: number;
  progressPct: number;
  elapsedMin: number;
  remainMin: number | null;
  health: TourHealth;
}

function classifyHealth(remainMin: number | null, elapsedMin: number): TourHealth {
  if (remainMin === null) return 'ok';
  if (remainMin < 0) return 'late';
  if (remainMin < 8) return 'tight';
  return 'ok';
}

const healthStyle: Record<TourHealth, { badge: string; bar: string; text: string }> = {
  ok: { badge: 'bg-matcha-100 text-matcha-700', bar: 'bg-matcha-400', text: 'text-matcha-600' },
  tight: { badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-400', text: 'text-amber-600' },
  late: { badge: 'bg-red-100 text-red-700', bar: 'bg-red-400', text: 'text-red-600' },
};

const healthLabel: Record<TourHealth, string> = {
  ok: 'Pünktlich',
  tight: 'Knapp',
  late: 'Verspätet',
};

export function DispatchAktiveTourSummary({ batches, drivers = [] }: Props) {
  const [tick, setTick] = useState(0);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 15_000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();

  const ACTIVE_STATES = new Set(['pickup', 'unterwegs', 'pending_acceptance', 'assigned', 'at_restaurant', 'on_route']);

  const rows: TourRow[] = batches
    .filter(b => ACTIVE_STATES.has(b.status))
    .map(b => {
      const totalStops = b.stops.length;
      const completedStops = b.stops.filter(s => !!s.geliefert_am).length;
      const progressPct = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;
      const elapsedMin = b.startzeit ? Math.floor((now - new Date(b.startzeit).getTime()) / 60_000) : 0;
      const etaMs = b.startzeit && b.total_eta_min != null
        ? new Date(b.startzeit).getTime() + b.total_eta_min * 60_000
        : null;
      const remainMin = etaMs != null ? Math.round((etaMs - now) / 60_000) : null;
      const health = classifyHealth(remainMin, elapsedMin);

      let driverName = 'Fahrer';
      if (b.fahrer) {
        driverName = `${b.fahrer.vorname} ${b.fahrer.nachname}`.trim();
      }

      return { id: b.id, driverName, zone: b.zone ?? null, totalStops, completedStops, progressPct, elapsedMin, remainMin, health };
    })
    .sort((a, b) => {
      const order: Record<TourHealth, number> = { late: 0, tight: 1, ok: 2 };
      return order[a.health] - order[b.health];
    });

  if (rows.length === 0) return null;

  const lateCount = rows.filter(r => r.health === 'late').length;
  const tightCount = rows.filter(r => r.health === 'tight').length;

  return (
    <Card className="border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            <Bike className="h-3.5 w-3.5" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-foreground">Aktive Touren</div>
            <div className="text-[10px] text-muted-foreground">
              {rows.length} Tour{rows.length !== 1 ? 'en' : ''} unterwegs
              {lateCount > 0 && <span className="ml-1.5 text-red-600 font-bold">· {lateCount} verspätet</span>}
              {tightCount > 0 && <span className="ml-1.5 text-amber-600 font-bold">· {tightCount} knapp</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {lateCount > 0 && <AlertTriangle className="h-4 w-4 text-red-500" />}
          <TrendingUp className={cn('h-4 w-4 transition-transform', open ? 'rotate-0' : 'rotate-180', 'text-muted-foreground')} />
        </div>
      </button>

      {open && (
        <div className="divide-y divide-stone-100">
          {rows.map(row => {
            const hs = healthStyle[row.health];
            return (
              <div key={row.id} className="flex items-center gap-3 px-4 py-3">
                {/* Health badge */}
                <div className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black min-w-[58px] text-center', hs.badge)}>
                  {healthLabel[row.health]}
                </div>

                {/* Driver + zone */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold truncate">{row.driverName}</span>
                    {row.zone && (
                      <span className="text-[9px] rounded-full bg-stone-100 border border-stone-200 px-1.5 py-0.5 font-bold">
                        Zone {row.zone}
                      </span>
                    )}
                    {row.remainMin !== null && (
                      <span className={cn('text-[10px] font-bold tabular-nums', hs.text)}>
                        {row.remainMin < 0
                          ? `${Math.abs(row.remainMin)} Min über`
                          : `~${row.remainMin} Min`}
                      </span>
                    )}
                  </div>
                  {/* Progress bar */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', hs.bar)}
                        style={{ width: `${row.progressPct}%` }}
                      />
                    </div>
                    <span className="text-[9px] font-bold tabular-nums shrink-0 text-muted-foreground">
                      {row.completedStops}/{row.totalStops} Stopps
                    </span>
                  </div>
                </div>

                {/* Elapsed */}
                <div className="shrink-0 text-right">
                  <div className="font-mono text-sm font-black tabular-nums">{row.elapsedMin}m</div>
                  <div className="text-[8px] text-muted-foreground">vergangen</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
