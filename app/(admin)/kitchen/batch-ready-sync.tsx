'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, ChefHat, Clock, Package, Zap } from 'lucide-react';

type Item = { name: string; menge: number };
type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  items: Item[];
};
type Stop = {
  batch_id: string;
  order_id: string;
  reihenfolge: number;
};
type Batch = {
  id: string;
  status: string;
  driver_id: string | null;
};

function elapsed(iso: string | null): number {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
}

function pct(elapsedMin: number, estMin: number): number {
  if (!estMin) return 0;
  return Math.min(100, Math.round((elapsedMin / estMin) * 100));
}

interface Props {
  orders: Order[];
  batches: Batch[];
  stops: Stop[];
}

export function BatchReadySyncPanel({ orders, batches, stops }: Props) {
  const groups = useMemo(() => {
    // Find active batches (not yet dispatched/delivered)
    const activeBatches = batches.filter(b =>
      ['geplant', 'assigned', 'bereit', 'pending'].includes(b.status),
    );
    if (activeBatches.length === 0) return [];

    return activeBatches
      .map(batch => {
        const batchStops = stops
          .filter(s => s.batch_id === batch.id)
          .sort((a, b) => a.reihenfolge - b.reihenfolge);

        const batchOrders = batchStops
          .map(s => orders.find(o => o.id === s.order_id))
          .filter((o): o is Order => !!o);

        if (batchOrders.length < 2) return null;

        const orderStates = batchOrders.map(o => {
          const elapsedMin = elapsed(o.bestellt_am);
          const estMin = o.geschaetzte_zubereitung_min ?? 15;
          const progress = pct(elapsedMin, estMin);
          const isReady = o.status === 'fertig';
          const isCooking = ['bestätigt', 'in_zubereitung'].includes(o.status);
          const isOverdue = isCooking && elapsedMin > estMin;
          return { order: o, elapsedMin, estMin, progress, isReady, isCooking, isOverdue };
        });

        const readyCount = orderStates.filter(s => s.isReady).length;
        const total = orderStates.length;
        const allReady = readyCount === total;
        const bottleneck = orderStates.filter(s => s.isOverdue && !s.isReady);
        const maxDelay = bottleneck.reduce((max, s) => Math.max(max, s.elapsedMin - s.estMin), 0);

        return { batch, orderStates, readyCount, total, allReady, maxDelay };
      })
      .filter(Boolean) as {
        batch: Batch;
        orderStates: ReturnType<typeof orders.map>[0][];
        readyCount: number;
        total: number;
        allReady: boolean;
        maxDelay: number;
      }[];
  }, [orders, batches, stops]);

  if (groups.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Package size={14} className="text-muted-foreground" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          Batch-Bereitschafts-Sync
        </span>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold text-muted-foreground">
          {groups.length} Batch{groups.length !== 1 ? 'es' : ''}
        </span>
      </div>

      <div className="space-y-2">
        {groups.map(({ batch, orderStates, readyCount, total, allReady, maxDelay }) => {
          const pctReady = Math.round((readyCount / total) * 100);
          return (
            <div
              key={batch.id}
              className={cn(
                'rounded-lg border p-2.5',
                allReady
                  ? 'border-matcha-300 bg-matcha-50'
                  : maxDelay > 5
                  ? 'border-red-200 bg-red-50 animate-pulse'
                  : maxDelay > 0
                  ? 'border-amber-200 bg-amber-50'
                  : 'border-border bg-muted/30',
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                {allReady ? (
                  <CheckCircle2 size={12} className="text-matcha-600 shrink-0" />
                ) : (
                  <ChefHat size={12} className="text-muted-foreground shrink-0" />
                )}
                <span className="text-[10px] font-bold text-foreground">
                  {readyCount}/{total} fertig
                </span>
                {maxDelay > 0 && !allReady && (
                  <span className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9px] font-black text-red-600">
                    <Clock size={8} />
                    +{maxDelay} Min
                  </span>
                )}
                {allReady && (
                  <span className="ml-auto inline-flex items-center gap-0.5 rounded-full bg-matcha-500/20 px-1.5 py-0.5 text-[9px] font-black text-matcha-600">
                    <Zap size={8} />
                    Bereit!
                  </span>
                )}
              </div>

              {/* Progress bar */}
              <div className="mb-2 h-1.5 rounded-full bg-black/10 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    allReady ? 'bg-matcha-500' : maxDelay > 0 ? 'bg-red-500' : 'bg-blue-500',
                  )}
                  style={{ width: `${pctReady}%` }}
                />
              </div>

              {/* Per-order mini pills */}
              <div className="flex flex-wrap gap-1">
                {(orderStates as Array<{
                  order: Order;
                  elapsedMin: number;
                  estMin: number;
                  progress: number;
                  isReady: boolean;
                  isCooking: boolean;
                  isOverdue: boolean;
                }>).map(({ order, progress, isReady, isOverdue }) => (
                  <div
                    key={order.id}
                    className={cn(
                      'flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold',
                      isReady
                        ? 'bg-matcha-500/20 text-matcha-700'
                        : isOverdue
                        ? 'bg-red-500/20 text-red-700'
                        : 'bg-blue-500/20 text-blue-700',
                    )}
                  >
                    <span>#{order.bestellnummer.replace('FF-', '')}</span>
                    {isReady ? (
                      <CheckCircle2 size={8} />
                    ) : (
                      <span className="tabular-nums">{progress}%</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
