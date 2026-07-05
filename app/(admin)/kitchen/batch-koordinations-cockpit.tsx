'use client';

import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Bike, CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp, Package } from 'lucide-react';

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

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  geschaetzte_zubereitung_min: number | null;
  fertig_am: string | null;
};

type Driver = {
  id: string;
  vorname: string;
  nachname: string;
  status: { last_update: string | null } | null;
};

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  estimated_ready_at: string | null;
  actual_ready_at: string | null;
};

interface Props {
  batches: Batch[];
  stops: Stop[];
  orders: Order[];
  drivers: Driver[];
  timings: KitchenTiming[];
}

type HandoffStatus = 'bereit' | 'in_zubereitung' | 'warten' | 'unterwegs';

interface BatchInfo {
  batch: Batch;
  driver: Driver | null;
  stopCount: number;
  deliveredCount: number;
  handoffStatus: HandoffStatus;
  etaMinutes: number | null;
  allOrdersReady: boolean;
  pendingOrders: Order[];
}

function computeHandoff(
  batch: Batch,
  batchStops: Stop[],
  orders: Order[],
  timings: KitchenTiming[],
): { status: HandoffStatus; allReady: boolean; pending: Order[] } {
  if (batch.status === 'unterwegs' || batch.status === 'in_delivery') {
    return { status: 'unterwegs', allReady: true, pending: [] };
  }
  const orderIds = batchStops.map(s => s.order_id);
  const batchOrders = orders.filter(o => orderIds.includes(o.id));
  const pending = batchOrders.filter(o => !['fertig', 'geliefert', 'abgeschlossen'].includes(o.status));
  const allReady = pending.length === 0;

  if (allReady) return { status: 'bereit', allReady: true, pending: [] };
  const anyInPrep = batchOrders.some(o => o.status === 'in_zubereitung');
  return { status: anyInPrep ? 'in_zubereitung' : 'warten', allReady: false, pending };
}

const HANDOFF_CFG: Record<HandoffStatus, { label: string; bg: string; text: string; border: string; icon: typeof ChefHat }> = {
  bereit:         { label: 'Bereit',         bg: 'bg-matcha-50',  text: 'text-matcha-800',  border: 'border-matcha-400', icon: CheckCircle2 },
  in_zubereitung: { label: 'In Zubereitung', bg: 'bg-amber-50',   text: 'text-amber-800',   border: 'border-amber-400',  icon: ChefHat      },
  warten:         { label: 'Wartet',          bg: 'bg-blue-50',    text: 'text-blue-800',    border: 'border-blue-400',   icon: Clock        },
  unterwegs:      { label: 'Unterwegs',       bg: 'bg-slate-50',   text: 'text-slate-700',   border: 'border-slate-300',  icon: Bike         },
};

export function KitchenBatchKoordinationsCockpit({ batches, stops, orders, drivers, timings }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const activeBatches = useMemo(() => {
    return batches
      .filter(b => !['abgeschlossen', 'completed', 'cancelled', 'storniert'].includes(b.status))
      .map((batch): BatchInfo => {
        const batchStops    = stops.filter(s => s.batch_id === batch.id);
        const deliveredCount = batchStops.filter(s => s.geliefert_am).length;
        const driver        = drivers.find(d => d.id === batch.driver_id) ?? null;
        const { status, allReady, pending } = computeHandoff(batch, batchStops, orders, timings);

        const etaMinutes = batch.started_at && batch.total_eta_min
          ? Math.max(0, Math.round(batch.total_eta_min - (Date.now() - new Date(batch.started_at).getTime()) / 60_000))
          : batch.total_eta_min ?? null;

        return {
          batch,
          driver,
          stopCount: batchStops.length,
          deliveredCount,
          handoffStatus: status,
          etaMinutes,
          allOrdersReady: allReady,
          pendingOrders: pending,
        };
      })
      .sort((a, b) => {
        const order: HandoffStatus[] = ['bereit', 'in_zubereitung', 'warten', 'unterwegs'];
        return order.indexOf(a.handoffStatus) - order.indexOf(b.handoffStatus);
      });
  }, [batches, stops, orders, drivers, timings]);

  if (activeBatches.length === 0) return null;

  const readyCount    = activeBatches.filter(b => b.handoffStatus === 'bereit').length;
  const criticalCount = activeBatches.filter(b => b.handoffStatus === 'warten').length;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
        <Package size={16} className="text-muted-foreground shrink-0" />
        <span className="text-sm font-bold text-foreground flex-1">Batch-Koordinations-Cockpit</span>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="rounded-full bg-amber-500 text-white px-2 py-0.5 text-[9px] font-bold">
              {criticalCount} wartend
            </span>
          )}
          {readyCount > 0 && (
            <span className="rounded-full bg-matcha-600 text-white px-2 py-0.5 text-[9px] font-bold">
              {readyCount} bereit
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">{activeBatches.length} Touren</span>
        </div>
      </div>

      {/* Batch rows */}
      <div className="divide-y divide-border">
        {activeBatches.map(info => {
          const cfg   = HANDOFF_CFG[info.handoffStatus];
          const Icon  = cfg.icon;
          const isExp = expanded.has(info.batch.id);
          const driverName = info.driver
            ? `${info.driver.vorname} ${info.driver.nachname.charAt(0)}.`
            : 'Fahrer?';

          return (
            <div key={info.batch.id} className={cn('transition-colors', cfg.bg)}>
              <button
                onClick={() => setExpanded(prev => {
                  const next = new Set(prev);
                  isExp ? next.delete(info.batch.id) : next.add(info.batch.id);
                  return next;
                })}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
              >
                {/* Status dot */}
                <span className={cn('rounded-full p-1.5 shrink-0', cfg.border, 'border')}>
                  <Icon size={12} className={cfg.text} />
                </span>

                {/* Driver + status */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn('text-xs font-bold', cfg.text)}>{driverName}</span>
                    <span className={cn('rounded-full border px-2 py-0.5 text-[9px] font-semibold', cfg.border, cfg.text)}>
                      {cfg.label}
                    </span>
                    {info.pendingOrders.length > 0 && (
                      <span className="rounded-full bg-amber-500 text-white px-2 py-0.5 text-[9px] font-bold">
                        {info.pendingOrders.length} nicht fertig
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {info.deliveredCount}/{info.stopCount} geliefert
                    {info.etaMinutes !== null && info.handoffStatus === 'unterwegs'
                      ? ` · ETA ~${info.etaMinutes} Min`
                      : ''}
                  </div>
                </div>

                {/* ETA badge */}
                {info.etaMinutes !== null && info.handoffStatus !== 'unterwegs' && (
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                    ~{info.etaMinutes} Min
                  </span>
                )}
                {isExp ? <ChevronUp size={14} className="shrink-0 text-muted-foreground" /> : <ChevronDown size={14} className="shrink-0 text-muted-foreground" />}
              </button>

              {/* Expanded: pending orders */}
              {isExp && info.pendingOrders.length > 0 && (
                <div className="px-4 pb-3 pt-0 space-y-1">
                  {info.pendingOrders.map(o => {
                    const timing = timings.find(t => t.order_id === o.id);
                    const readyAt = timing?.estimated_ready_at ?? null;
                    const minLeft = readyAt
                      ? Math.max(0, Math.round((new Date(readyAt).getTime() - Date.now()) / 60_000))
                      : null;
                    return (
                      <div key={o.id} className="flex items-center gap-2 rounded-lg bg-white/60 border border-border px-3 py-2">
                        <ChefHat size={12} className="text-amber-600 shrink-0" />
                        <span className="text-xs font-mono text-foreground flex-1">#{o.bestellnummer}</span>
                        <span className="text-[10px] text-muted-foreground capitalize">{o.status.replace(/_/g, ' ')}</span>
                        {minLeft !== null && (
                          <span className={cn('text-[9px] font-bold rounded-full px-1.5 py-0.5',
                            minLeft <= 2 ? 'bg-red-500 text-white' :
                            minLeft <= 5 ? 'bg-amber-500 text-white' :
                            'bg-slate-200 text-slate-700')}>
                            ~{minLeft} Min
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {isExp && info.pendingOrders.length === 0 && (
                <div className="px-4 pb-3 flex items-center gap-2 text-[11px] text-matcha-700">
                  <CheckCircle2 size={12} /> Alle Bestellungen fertig — bereit zur Abfahrt
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
