'use client';

/**
 * Phase 685 — Tour-Visualisierungs-Board
 * Zeigt alle aktiven Touren als visuelle Swimlane mit Stopp-Fortschritt, ETA und Status.
 * Props: batches[], stops[], drivers[]
 */

import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Route, ChevronDown, ChevronUp, Check, Clock, Bike, Package } from 'lucide-react';

type Batch = {
  id: string;
  driver_id?: string | null;
  status?: string;
  started_at?: string | null;
  total_eta_min?: number | null;
  zone?: string | null;
};
type Stop = {
  id: string;
  batch_id?: string;
  geliefert_am?: string | null;
  kunde_name?: string;
  address?: string;
  adresse?: string;
  order_id?: string;
  stop_nr?: number;
};
type Driver = {
  id: string;
  name?: string;
};

export function DispatchPhase685TourVisualisierungsBoard({
  batches,
  stops,
  drivers,
}: {
  batches: Batch[];
  stops: Stop[];
  drivers: Driver[];
}) {
  const [open, setOpen] = useState(true);

  const activeBatches = useMemo(
    () => batches.filter((b) => b.status === 'unterwegs' || b.status === 'on_route' || b.status === 'active' || b.status === 'pickup'),
    [batches],
  );

  const rows = useMemo(() =>
    activeBatches.map((batch) => {
      const driver = drivers.find((d) => d.id === batch.driver_id);
      const batchStops = stops
        .filter((s) => s.batch_id === batch.id)
        .sort((a, b) => (a.stop_nr ?? 0) - (b.stop_nr ?? 0));
      const delivered = batchStops.filter((s) => s.geliefert_am).length;
      const total = batchStops.length;

      let elapsedMin: number | null = null;
      let remainMin: number | null = null;
      if (batch.started_at) {
        elapsedMin = Math.floor((Date.now() - new Date(batch.started_at).getTime()) / 60_000);
        if (batch.total_eta_min != null) {
          remainMin = Math.max(0, batch.total_eta_min - elapsedMin);
        }
      }

      return { batch, driver, batchStops, delivered, total, elapsedMin, remainMin };
    })
    .sort((a, b) => {
      if (a.remainMin !== null && b.remainMin !== null) return a.remainMin - b.remainMin;
      return 0;
    }),
    [activeBatches, stops, drivers],
  );

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-blue-500 shrink-0" />
          <span className="font-semibold text-sm">Tour-Visualisierung</span>
          <span className="text-xs text-muted-foreground">
            {rows.length} Tour{rows.length !== 1 ? 'en' : ''} laufend
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {rows.map(({ batch, driver, batchStops, delivered, total, elapsedMin, remainMin }) => {
            const progressPct = total > 0 ? Math.round((delivered / total) * 100) : 0;
            const isLate = remainMin !== null && remainMin <= 5 && delivered < total;
            return (
              <div
                key={batch.id}
                className={cn(
                  'rounded-xl border p-3',
                  isLate ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20'
                         : 'border-border bg-muted/20',
                )}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Bike className={cn('h-4 w-4 shrink-0', isLate ? 'text-red-500' : 'text-blue-500')} />
                    <span className="font-bold text-sm">{driver?.name ?? 'Fahrer'}</span>
                    {batch.zone && (
                      <span className="text-[10px] rounded-full border px-1.5 py-0.5 font-bold text-muted-foreground">
                        Zone {batch.zone}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {elapsedMin !== null && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {elapsedMin} Min
                      </span>
                    )}
                    {remainMin !== null && (
                      <span className={cn('font-bold', isLate ? 'text-red-600 dark:text-red-400' : 'text-matcha-600 dark:text-matcha-400')}>
                        ~{remainMin} Min verbl.
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Package className="h-3 w-3" />
                      {delivered}/{total}
                    </span>
                  </div>
                </div>

                {/* Gesamtfortschritt */}
                <div className="h-2 rounded-full bg-black/10 mb-3 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700',
                      isLate ? 'bg-red-500' : progressPct === 100 ? 'bg-matcha-500' : 'bg-blue-500',
                    )}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                {/* Stopp-Zeitleiste */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1">
                  {batchStops.map((stop, idx) => {
                    const isDone = !!stop.geliefert_am;
                    const isCurrent = !isDone && batchStops.slice(0, idx).every((s) => s.geliefert_am);
                    return (
                      <React.Fragment key={stop.id}>
                        {idx > 0 && (
                          <div className={cn('h-0.5 flex-1 min-w-4',
                            idx <= delivered ? 'bg-blue-400' : 'bg-muted-foreground/30',
                          )} />
                        )}
                        <div
                          className={cn(
                            'flex-shrink-0 flex flex-col items-center gap-0.5',
                          )}
                          title={stop.kunde_name ?? stop.adresse ?? stop.address ?? `Stopp ${idx + 1}`}
                        >
                          <div className={cn(
                            'h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-black border-2 transition',
                            isDone
                              ? 'bg-matcha-500 border-matcha-500 text-white'
                              : isCurrent
                              ? 'bg-blue-500 border-blue-500 text-white animate-pulse'
                              : 'bg-background border-muted-foreground/30 text-muted-foreground',
                          )}>
                            {isDone ? <Check className="h-3 w-3" /> : idx + 1}
                          </div>
                          <span className="text-[8px] text-muted-foreground truncate max-w-10 text-center leading-tight">
                            {stop.kunde_name?.split(' ')[0] ?? `S${idx + 1}`}
                          </span>
                        </div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
