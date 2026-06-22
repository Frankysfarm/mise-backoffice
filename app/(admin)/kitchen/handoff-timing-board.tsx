'use client';

/**
 * Phase 423 – KitchenHandoffTimingBoard
 * Bridges kitchen prep readiness with driver arrival ETA.
 * Shows for each active delivery order:
 *  - Cook countdown (green/yellow/red)
 *  - Expected driver arrival
 *  - Handoff gap (too early / on-time / too late)
 */

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChefHat, Bike, AlertTriangle, CheckCircle2, Zap, RefreshCw } from 'lucide-react';

type Item = { id: string; name: string; menge: number };

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_name: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  items: Item[];
};

type Timing = {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type BatchStop = {
  id: string;
  batch_id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am?: string | null;
};

type Batch = {
  id: string;
  status: string;
  total_eta_min: number | null;
  started_at: string | null;
  stops?: BatchStop[];
};

type HandoffRow = {
  order: Order;
  timing: Timing | null;
  prepRemainMin: number | null;
  driverEtaMin: number | null;
  gapMin: number | null; // positive = driver arrives after food ready, negative = food ready before driver
  urgency: 'ok' | 'tight' | 'late' | 'waiting';
};

interface Props {
  orders: Order[];
  timings: Timing[];
  batches: Batch[];
  stops?: BatchStop[];
}

function calcPrepRemain(order: Order, timing: Timing | null): number | null {
  if (timing?.ready_target) {
    return Math.round((new Date(timing.ready_target).getTime() - Date.now()) / 60_000);
  }
  const startAt = timing?.cook_start_at ? new Date(timing.cook_start_at).getTime() : null;
  const prepMin = timing?.prep_min ?? order.geschaetzte_zubereitung_min ?? 15;
  if (!startAt) {
    const bestellt = order.bestellt_am ? new Date(order.bestellt_am).getTime() : Date.now();
    const elapsed = (Date.now() - bestellt) / 60_000;
    return Math.round(prepMin - elapsed);
  }
  const elapsed = (Date.now() - startAt) / 60_000;
  return Math.round(prepMin - elapsed);
}

function calcDriverEta(batch: Batch): number | null {
  if (!batch.total_eta_min || !batch.started_at) return null;
  const elapsed = (Date.now() - new Date(batch.started_at).getTime()) / 60_000;
  return Math.max(0, Math.round(batch.total_eta_min - elapsed));
}

export function KitchenHandoffTimingBoard({ orders, timings, batches, stops = [] }: Props) {
  const [now, setNow] = useState(Date.now());
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const deliveryOrders = orders.filter(
    (o) => o.typ === 'lieferung' && ['bestätigt', 'in_zubereitung', 'fertig'].includes(o.status),
  );

  const rows: HandoffRow[] = deliveryOrders.map((order) => {
    const timing = timings.find((t) => t.order_id === order.id) ?? null;
    const prepRemainMin = calcPrepRemain(order, timing);

    const matchedBatch = batches.find((b) => {
      const batchStops = b.stops ?? stops.filter((s) => s.batch_id === b.id);
      return batchStops.some((s) => s.order_id === order.id);
    });
    const driverEtaMin = matchedBatch ? calcDriverEta(matchedBatch) : null;

    const gapMin =
      driverEtaMin !== null && prepRemainMin !== null
        ? driverEtaMin - prepRemainMin
        : null;

    let urgency: HandoffRow['urgency'] = 'ok';
    if (order.status === 'fertig' && driverEtaMin !== null && driverEtaMin > 5) {
      urgency = 'waiting'; // food ready, driver not here yet
    } else if (gapMin !== null) {
      if (gapMin < -3) urgency = 'late';       // driver arrives before food ready
      else if (gapMin < 2) urgency = 'tight';  // very close
      else urgency = 'ok';
    } else if (prepRemainMin !== null && prepRemainMin < 0) {
      urgency = 'late';
    }

    return { order, timing, prepRemainMin, driverEtaMin, gapMin, urgency };
  });

  const sorted = [...rows].sort((a, b) => {
    const urgencyOrder = { late: 0, tight: 1, waiting: 2, ok: 3 };
    return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
  });

  if (sorted.length === 0) return null;

  const lateCount = sorted.filter((r) => r.urgency === 'late').length;
  const waitingCount = sorted.filter((r) => r.urgency === 'waiting').length;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden" key={now}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-100">
            <Zap className="h-3.5 w-3.5 text-matcha-700" />
          </div>
          <span className="text-sm font-bold text-gray-900">Handoff-Timing Board</span>
          <span className="text-xs text-gray-400">({sorted.length} Lieferungen)</span>
          {lateCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              <AlertTriangle className="h-3 w-3" />
              {lateCount} kritisch
            </span>
          )}
          {waitingCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              <Clock className="h-3 w-3" />
              {waitingCount} wartet
            </span>
          )}
        </div>
        <span className="text-xs text-gray-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-stone-100 divide-y divide-stone-50">
          {/* Header */}
          <div className="grid grid-cols-[1fr_80px_80px_90px_80px] gap-2 px-4 py-1.5 bg-stone-50 text-[10px] font-bold text-gray-500 uppercase tracking-wide">
            <span>Bestellung</span>
            <span className="text-center">Status</span>
            <span className="text-center">Prep-Rest</span>
            <span className="text-center">Fahrer-ETA</span>
            <span className="text-center">Handoff</span>
          </div>

          {sorted.map((row) => {
            const { order, prepRemainMin, driverEtaMin, gapMin, urgency } = row;

            const urgencyBg = {
              late: 'bg-red-50 hover:bg-red-100/60',
              tight: 'bg-amber-50 hover:bg-amber-100/60',
              waiting: 'bg-blue-50 hover:bg-blue-100/60',
              ok: 'hover:bg-stone-50',
            }[urgency];

            const prepColor =
              prepRemainMin === null
                ? 'text-gray-400'
                : prepRemainMin <= 0
                ? 'text-red-600 font-black'
                : prepRemainMin <= 3
                ? 'text-amber-600 font-bold'
                : 'text-matcha-700 font-semibold';

            const gapLabel =
              gapMin === null
                ? '—'
                : gapMin <= -3
                ? `${Math.abs(gapMin)}m zu früh`
                : gapMin >= 0 && gapMin <= 2
                ? '✓ perfekt'
                : `${gapMin}m Puffer`;

            const gapColor =
              gapMin === null
                ? 'text-gray-400'
                : gapMin < -3
                ? 'text-red-600 font-bold'
                : gapMin <= 2
                ? 'text-matcha-700 font-bold'
                : 'text-blue-600';

            const statusBadge = {
              bestätigt: { label: 'Bestätigt', cls: 'bg-stone-100 text-stone-600' },
              in_zubereitung: { label: 'Kocht', cls: 'bg-amber-100 text-amber-700' },
              fertig: { label: 'Fertig', cls: 'bg-matcha-100 text-matcha-700' },
            }[order.status as 'bestätigt' | 'in_zubereitung' | 'fertig'] ?? {
              label: order.status,
              cls: 'bg-gray-100 text-gray-600',
            };

            return (
              <div
                key={order.id}
                className={cn(
                  'grid grid-cols-[1fr_80px_80px_90px_80px] gap-2 items-center px-4 py-2.5 text-sm transition-colors',
                  urgencyBg,
                )}
              >
                {/* Order info */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    {urgency === 'late' && <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />}
                    {urgency === 'waiting' && <Clock className="h-3 w-3 text-blue-500 shrink-0" />}
                    {urgency === 'ok' && <CheckCircle2 className="h-3 w-3 text-matcha-500 shrink-0" />}
                    <span className="font-mono text-xs font-bold text-gray-700">#{order.bestellnummer}</span>
                    <span className="text-xs text-gray-500 truncate">{order.kunde_name}</span>
                  </div>
                  <div className="text-[10px] text-gray-400 mt-0.5 truncate">
                    {order.items.slice(0, 2).map((i) => i.name).join(', ')}
                    {order.items.length > 2 && ` +${order.items.length - 2}`}
                  </div>
                </div>

                {/* Status */}
                <div className="flex justify-center">
                  <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold', statusBadge.cls)}>
                    {statusBadge.label}
                  </span>
                </div>

                {/* Prep remain */}
                <div className="text-center">
                  <div className={cn('text-sm tabular-nums', prepColor)}>
                    {prepRemainMin === null ? '—' : prepRemainMin <= 0 ? 'überfällig' : `${prepRemainMin} Min`}
                  </div>
                  <div className="text-[9px] text-gray-400 flex items-center justify-center gap-0.5">
                    <ChefHat className="h-2.5 w-2.5" /> Küche
                  </div>
                </div>

                {/* Driver ETA */}
                <div className="text-center">
                  <div className="text-sm tabular-nums font-semibold text-gray-700">
                    {driverEtaMin === null ? '—' : driverEtaMin === 0 ? 'da!' : `${driverEtaMin} Min`}
                  </div>
                  <div className="text-[9px] text-gray-400 flex items-center justify-center gap-0.5">
                    <Bike className="h-2.5 w-2.5" /> Fahrer
                  </div>
                </div>

                {/* Handoff gap */}
                <div className="text-center">
                  <div className={cn('text-xs tabular-nums', gapColor)}>{gapLabel}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
