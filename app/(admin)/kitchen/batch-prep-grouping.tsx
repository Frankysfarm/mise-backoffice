'use client';

/**
 * KitchenBatchPrepGrouping — Phase 113
 *
 * Zeigt kochende/bereite Bestellungen gruppiert nach Tour/Batch,
 * damit die Küche weiß, welche Orders zusammen für denselben Fahrer sind.
 * Hilft, mehrere Bestellungen gleichzeitig fertig zu machen.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, CheckCircle2, Clock, Package, Bike, Layers } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_name: string;
  geschaetzte_zubereitung_min: number | null;
  bestellt_am: string | null;
  items: { name: string; menge: number }[];
};

type BatchStop = {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
};

type Batch = {
  id: string;
  status: string;
  started_at: string | null;
  total_eta_min: number | null;
};

type Driver = {
  id: string;
  vorname: string;
  nachname: string;
};

function useSecondTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 5_000);
    return () => clearInterval(t);
  }, []);
}

function fmt(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min <= 0) return 'Jetzt';
  return `${min} Min`;
}

const STATUS_ICON: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  bestätigt:      { icon: Clock,        color: 'text-blue-500',   label: 'Angenommen' },
  in_zubereitung: { icon: ChefHat,      color: 'text-orange-500', label: 'In Zubereitung' },
  fertig:         { icon: Package,      color: 'text-matcha-600', label: 'Fertig' },
};

export function KitchenBatchPrepGrouping({
  orders,
  batches,
  stops,
  drivers,
}: {
  orders: Order[];
  batches: Batch[];
  stops: BatchStop[];
  drivers: Driver[];
}) {
  useSecondTick();
  const now = Date.now();

  // Only show active batches that are on_route, assigned, at_restaurant (waiting for orders)
  const activeBatches = batches.filter((b) =>
    ['assigned', 'at_restaurant', 'pending_acceptance', 'unterwegs', 'on_route'].includes(b.status),
  );

  if (activeBatches.length === 0) return null;

  // Group stops by batch, filter orders that are in kitchen stages
  const kitchenStatuses = new Set(['bestätigt', 'in_zubereitung', 'fertig']);

  const groups = activeBatches
    .map((batch) => {
      const batchStops = stops
        .filter((s) => s.batch_id === batch.id && !s.geliefert_am)
        .sort((a, b) => a.reihenfolge - b.reihenfolge);

      const batchOrders = batchStops
        .map((s) => orders.find((o) => o.id === s.order_id))
        .filter((o): o is Order => !!o && kitchenStatuses.has(o.status));

      if (batchOrders.length === 0) return null;

      const driver = drivers.find((d) =>
        // Check if any stop batch has a driver assigned — use batch_id heuristic via driver state
        false, // drivers list doesn't have batch_id here; skip for now
      );

      const etaMs = batch.started_at && batch.total_eta_min != null
        ? new Date(batch.started_at).getTime() + batch.total_eta_min * 60_000
        : null;

      const allReady = batchOrders.every((o) => o.status === 'fertig');
      const anyInProgress = batchOrders.some((o) => o.status === 'in_zubereitung');

      return { batch, batchOrders, etaMs, allReady, anyInProgress };
    })
    .filter(Boolean) as {
      batch: Batch;
      batchOrders: Order[];
      etaMs: number | null;
      allReady: boolean;
      anyInProgress: boolean;
    }[];

  if (groups.length === 0) return null;

  // Only render if at least one group has multiple orders (single orders don't need grouping view)
  const multiOrderGroups = groups.filter((g) => g.batchOrders.length >= 2);
  if (multiOrderGroups.length === 0) return null;

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
      <div className="flex items-center gap-2 bg-blue-100 border-b border-blue-200 px-4 py-2.5">
        <Layers className="h-4 w-4 text-blue-700" />
        <span className="text-xs font-black uppercase tracking-wider text-blue-800">
          Batch-Zubereitung
        </span>
        <span className="ml-1 text-[10px] font-bold text-blue-600">
          — diese Orders gleichzeitig fertig machen
        </span>
        <span className="ml-auto rounded-full bg-blue-600 text-white px-2 py-0.5 text-[10px] font-black">
          {multiOrderGroups.length}
        </span>
      </div>

      <div className="divide-y divide-blue-100">
        {multiOrderGroups.map(({ batch, batchOrders, etaMs, allReady, anyInProgress }) => {
          const remainMs = etaMs != null ? etaMs - now : null;
          const isOverdue = remainMs != null && remainMs < 0;
          const eta = remainMs != null ? Math.abs(remainMs) : null;

          return (
            <div key={batch.id} className="px-4 py-3 space-y-2">
              {/* Batch Header */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <Bike className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                  <span className="text-[11px] font-black text-blue-800">
                    {batchOrders.length} Orders in einer Tour
                  </span>
                </div>
                {etaMs != null && (
                  <span className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black',
                    isOverdue
                      ? 'bg-red-100 text-red-700 animate-pulse'
                      : remainMs != null && remainMs < 600_000
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-blue-100 text-blue-700',
                  )}>
                    <Clock className="h-2.5 w-2.5" />
                    {isOverdue ? `+${fmt(eta!)} überfällig` : `Fahrer in ${fmt(eta ?? 0)}`}
                  </span>
                )}
                <span className={cn(
                  'ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black',
                  allReady ? 'bg-matcha-100 text-matcha-700' : anyInProgress ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600',
                )}>
                  {allReady ? (
                    <><CheckCircle2 className="h-2.5 w-2.5" /> Alle bereit</>
                  ) : anyInProgress ? (
                    <><ChefHat className="h-2.5 w-2.5" /> Kocht noch</>
                  ) : (
                    <><Clock className="h-2.5 w-2.5" /> Warte</>
                  )}
                </span>
              </div>

              {/* Order Pills */}
              <div className="flex flex-wrap gap-1.5">
                {batchOrders.map((order, i) => {
                  const meta = STATUS_ICON[order.status] ?? { icon: Clock, color: 'text-gray-500', label: order.status };
                  const Icon = meta.icon;
                  return (
                    <div
                      key={order.id}
                      className={cn(
                        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5',
                        order.status === 'fertig'
                          ? 'bg-matcha-50 border-matcha-200'
                          : order.status === 'in_zubereitung'
                          ? 'bg-orange-50 border-orange-200'
                          : 'bg-white border-gray-200',
                      )}
                    >
                      <span className={cn('text-[10px] font-bold text-blue-600 shrink-0')}>#{i + 1}</span>
                      <Icon className={cn('h-3 w-3 shrink-0', meta.color)} />
                      <div className="min-w-0">
                        <div className="text-[10px] font-black text-gray-800 truncate max-w-[80px]">
                          {order.bestellnummer}
                        </div>
                        <div className="text-[9px] text-gray-500 truncate max-w-[80px]">
                          {order.kunde_name}
                        </div>
                      </div>
                      {order.status === 'fertig' && (
                        <CheckCircle2 className="h-3 w-3 text-matcha-500 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Item consolidation hint */}
              {(() => {
                const itemCounts: Record<string, number> = {};
                for (const o of batchOrders) {
                  for (const it of o.items ?? []) {
                    itemCounts[it.name] = (itemCounts[it.name] ?? 0) + it.menge;
                  }
                }
                const shared = Object.entries(itemCounts).filter(([, count]) => count >= 2);
                if (shared.length === 0) return null;
                return (
                  <div className="rounded-lg bg-blue-100/60 border border-blue-200 px-2.5 py-1.5">
                    <div className="text-[9px] font-black text-blue-700 uppercase tracking-wider mb-1">
                      Gemeinsam zubereiten:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {shared.map(([name, count]) => (
                        <span key={name} className="text-[10px] font-bold text-blue-800 bg-white/70 rounded px-1.5 py-0.5 border border-blue-200">
                          {count}× {name}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>
    </div>
  );
}
