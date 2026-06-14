'use client';

/**
 * KitchenPrepSyncPanel — Küchen-Dispatch-Synchronisation
 *
 * Zeigt in Echtzeit welche Bestellungen den Übergangspunkt
 * Küche→Dispatch erreicht haben und welche Maßnahmen nötig sind:
 *
 * ROT   — Bestellung fertig, kein Fahrer zugewiesen (>5 Min)
 * ORANGE — Fahrer kommt in <5 Min, Essen noch nicht fertig
 * GRÜN  — Timing passt: Essen fertig wenn Fahrer ankommt
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, Bike, CheckCircle2, ChefHat, Clock, Flame, Package, Zap,
} from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_name: string;
  fertig_am: string | null;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
};

type Batch = {
  id: string;
  driver_id: string;
  status: string;
  started_at: string | null;
  total_eta_min: number | null;
};

type Stop = {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
};

type Driver = {
  id: string;
  vorname: string;
  nachname: string;
};

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

function useTick(ms = 1000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}

type SyncState = 'ready_no_driver' | 'driver_coming_not_ready' | 'in_sync' | 'unknown';

function getSyncState(
  order: Order,
  timing: KitchenTiming | undefined,
  driverEtaSec: number | null,
): { state: SyncState; readyInSec: number | null; driverInSec: number | null } {
  const now = Date.now();

  let readyInSec: number | null = null;

  if (order.status === 'fertig') {
    readyInSec = 0;
  } else if (timing?.ready_target) {
    readyInSec = Math.floor((new Date(timing.ready_target).getTime() - now) / 1000);
  } else if (order.bestellt_am) {
    const elapsed = (now - new Date(order.bestellt_am).getTime()) / 1000;
    const total = (order.geschaetzte_zubereitung_min ?? 15) * 60;
    readyInSec = total - elapsed;
  }

  const driverInSec = driverEtaSec;

  if (order.status === 'fertig' && driverInSec === null) return { state: 'ready_no_driver', readyInSec: 0, driverInSec: null };
  if (order.status === 'fertig' && driverInSec !== null) return { state: 'in_sync', readyInSec: 0, driverInSec };
  if (driverInSec !== null && driverInSec <= 300 && readyInSec !== null && readyInSec > driverInSec + 60) {
    return { state: 'driver_coming_not_ready', readyInSec, driverInSec };
  }
  if (driverInSec !== null && readyInSec !== null) {
    return { state: 'in_sync', readyInSec, driverInSec };
  }
  return { state: 'unknown', readyInSec, driverInSec: null };
}

export function KitchenPrepSyncPanel({
  orders,
  batches,
  stops,
  drivers,
  timings,
}: {
  orders: Order[];
  batches: Batch[];
  stops: Stop[];
  drivers: Driver[];
  timings: KitchenTiming[];
}) {
  useTick(5000);

  const now = Date.now();

  // Baue Fahrer-ETA-Map: order_id → Sekunden bis Fahrer zurück
  const driverEtaMap = new Map<string, { sec: number; driverId: string }>();
  for (const batch of batches) {
    if (!['unterwegs', 'on_route', 'assigned', 'pickup'].includes(batch.status)) continue;
    const etaMs = batch.started_at && batch.total_eta_min != null
      ? new Date(batch.started_at).getTime() + batch.total_eta_min * 60_000
      : null;
    if (!etaMs) continue;
    const etaSec = Math.max(0, Math.floor((etaMs - now) / 1000));
    if (etaSec > 30 * 60) continue; // >30 min ignorieren
    const batchStops = stops.filter(s => s.batch_id === batch.id && !s.geliefert_am);
    for (const s of batchStops) {
      driverEtaMap.set(s.order_id, { sec: etaSec, driverId: batch.driver_id });
    }
  }

  const timingMap = new Map(timings.map(t => [t.order_id, t]));
  const driverMap = new Map(drivers.map(d => [d.id, d]));

  // Analysiere relevante Bestellungen
  const relevantOrders = orders.filter(o =>
    ['in_zubereitung', 'bestätigt', 'fertig'].includes(o.status) && o.typ === 'lieferung',
  );

  type SyncItem = {
    order: Order;
    sync: ReturnType<typeof getSyncState>;
    driver: Driver | undefined;
  };

  const items: SyncItem[] = relevantOrders
    .map(order => {
      const eta = driverEtaMap.get(order.id);
      const sync = getSyncState(order, timingMap.get(order.id), eta?.sec ?? null);
      const driver = eta ? driverMap.get(eta.driverId) : undefined;
      return { order, sync, driver };
    })
    .filter(item => item.sync.state !== 'unknown')
    .sort((a, b) => {
      const priority: Record<SyncState, number> = {
        ready_no_driver: 0,
        driver_coming_not_ready: 1,
        in_sync: 2,
        unknown: 3,
      };
      return priority[a.sync.state] - priority[b.sync.state];
    });

  const readyNoDriver = items.filter(i => i.sync.state === 'ready_no_driver');
  const driverConflict = items.filter(i => i.sync.state === 'driver_coming_not_ready');
  const inSync = items.filter(i => i.sync.state === 'in_sync');

  // Wie lange wartet die älteste "fertig" Bestellung schon?
  const maxWaitMin = readyNoDriver.reduce((max, item) => {
    const fertigMs = item.order.fertig_am ? new Date(item.order.fertig_am).getTime() : null;
    if (!fertigMs) return max;
    const wait = Math.floor((now - fertigMs) / 60_000);
    return Math.max(max, wait);
  }, 0);

  if (items.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <ChefHat className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-sm font-bold">Küchen → Dispatch Sync</span>
        {readyNoDriver.length > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-[10px] font-black animate-pulse">
            <AlertTriangle className="h-3 w-3" />
            {readyNoDriver.length} warten auf Fahrer
            {maxWaitMin >= 5 && ` (max. ${maxWaitMin} Min)`}
          </span>
        )}
        {driverConflict.length > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-orange-100 text-orange-700 px-2 py-0.5 text-[10px] font-black">
            <Zap className="h-3 w-3" />
            {driverConflict.length} Timing-Konflikt
          </span>
        )}
        {inSync.length > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-matcha-100 text-matcha-700 px-2 py-0.5 text-[10px] font-bold">
            <CheckCircle2 className="h-3 w-3" />
            {inSync.length} im Plan
          </span>
        )}
      </div>

      {/* Bestellungen ohne Fahrer */}
      {readyNoDriver.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-black uppercase tracking-wider text-red-600">
            Fertig — kein Fahrer
          </div>
          <div className="grid gap-1.5 grid-cols-1 sm:grid-cols-2">
            {readyNoDriver.map(({ order }) => {
              const waitMin = order.fertig_am
                ? Math.floor((now - new Date(order.fertig_am).getTime()) / 60_000)
                : null;
              return (
                <div
                  key={order.id}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border-2 px-2.5 py-1.5',
                    (waitMin ?? 0) >= 10
                      ? 'border-red-500 bg-red-50 animate-pulse'
                      : (waitMin ?? 0) >= 5
                      ? 'border-red-400 bg-red-50'
                      : 'border-amber-300 bg-amber-50',
                  )}
                >
                  <Package className="h-3.5 w-3.5 text-red-600 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-black truncate">{order.bestellnummer}</span>
                      {waitMin !== null && (
                        <span className={cn(
                          'text-[10px] font-black tabular-nums shrink-0',
                          waitMin >= 10 ? 'text-red-700' : waitMin >= 5 ? 'text-orange-700' : 'text-amber-700',
                        )}>
                          {waitMin} Min
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">{order.kunde_name}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Fahrer kommt zu früh */}
      {driverConflict.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-black uppercase tracking-wider text-orange-600">
            Fahrer früher als Essen — Eile geboten!
          </div>
          <div className="grid gap-1.5 grid-cols-1 sm:grid-cols-2">
            {driverConflict.map(({ order, sync, driver }) => {
              const gapSec = (sync.readyInSec ?? 0) - (sync.driverInSec ?? 0);
              const gapMin = Math.ceil(gapSec / 60);
              const driverMin = sync.driverInSec != null ? Math.ceil(sync.driverInSec / 60) : '?';
              return (
                <div
                  key={order.id}
                  className="flex items-center gap-2 rounded-lg border-2 border-orange-400 bg-orange-50 px-2.5 py-1.5"
                >
                  <Flame className="h-3.5 w-3.5 text-orange-600 shrink-0 animate-pulse" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-black truncate">{order.bestellnummer}</span>
                      <span className="text-[10px] font-black text-orange-700 shrink-0 tabular-nums">
                        +{gapMin} Min
                      </span>
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {order.kunde_name}
                      {driver && ` · ${driver.vorname}`}
                      <span className="text-orange-600 font-bold"> in {driverMin} Min</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Im Plan */}
      {inSync.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {inSync.map(({ order, sync, driver }) => {
            const driverMin = sync.driverInSec != null ? Math.ceil(sync.driverInSec / 60) : null;
            return (
              <div
                key={order.id}
                className="inline-flex items-center gap-1 rounded-full bg-matcha-100 text-matcha-800 px-2 py-0.5 text-[10px] font-bold"
              >
                <Bike className="h-3 w-3 shrink-0" />
                {order.bestellnummer}
                {driver && ` · ${driver.vorname}`}
                {driverMin !== null && (
                  <span className="text-matcha-600 font-black"> {driverMin} Min</span>
                )}
                {order.status === 'fertig' && <CheckCircle2 className="h-2.5 w-2.5 text-matcha-600" />}
              </div>
            );
          })}
        </div>
      )}

      {/* Legende */}
      <div className="flex items-center gap-3 text-[9px] text-muted-foreground border-t pt-2 flex-wrap">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-red-500" />
          Fertig, kein Fahrer
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-orange-400" />
          Fahrer zu früh
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-matcha-500" />
          Synchron
        </span>
        <Clock className="h-2.5 w-2.5 ml-auto" />
        <span>Echtzeit</span>
      </div>
    </div>
  );
}
