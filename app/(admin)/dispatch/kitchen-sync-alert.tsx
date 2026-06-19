'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, AlertTriangle, CheckCircle2, Clock, Bike, RefreshCw } from 'lucide-react';

interface ReadyOrder {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  fertig_am: string | null;
  dispatch_score: number | null;
  delivery_zone: string | null;
}

interface Batch {
  id: string;
  status: string;
  fahrer_id: string | null;
  stops: { order_id: string; geliefert_am: string | null }[];
  fahrer?: { vorname: string; nachname: string } | null;
}

interface Props {
  readyOrders: ReadyOrder[];
  batches: Batch[];
}

function minutesWaiting(fertigAm: string | null): number {
  if (!fertigAm) return 0;
  return Math.floor((Date.now() - new Date(fertigAm).getTime()) / 60_000);
}

export function DispatchKitchenSyncAlert({ readyOrders, batches }: Props) {
  const [, tick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => tick(n => n + 1), 15_000);
    return () => clearInterval(iv);
  }, []);

  // Build order → batch map
  const orderToBatch = new Map<string, Batch>();
  for (const b of batches) {
    for (const s of b.stops) {
      if (!s.geliefert_am) orderToBatch.set(s.order_id, b);
    }
  }

  const unassigned = readyOrders.filter(o => {
    const b = orderToBatch.get(o.id);
    return !b || !b.fahrer_id;
  });

  const assigned = readyOrders.filter(o => {
    const b = orderToBatch.get(o.id);
    return b && b.fahrer_id;
  });

  const criticalOrders = unassigned.filter(o => minutesWaiting(o.fertig_am) >= 5);

  if (readyOrders.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className={cn(
        'flex items-center gap-2 px-4 py-3 border-b',
        criticalOrders.length > 0 ? 'bg-red-50 border-red-200' : 'bg-muted/30',
      )}>
        <ChefHat size={14} className={criticalOrders.length > 0 ? 'text-red-500' : 'text-muted-foreground'} />
        <span className={cn(
          'text-xs font-bold uppercase tracking-wider',
          criticalOrders.length > 0 ? 'text-red-700' : 'text-muted-foreground',
        )}>
          Küchen-Sync
        </span>
        {criticalOrders.length > 0 && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-red-100 border border-red-300 text-red-700 px-2 py-0.5 text-[10px] font-black animate-pulse">
            <AlertTriangle size={9} />
            {criticalOrders.length} Kritisch
          </span>
        )}
        {criticalOrders.length === 0 && readyOrders.length > 0 && (
          <span className="ml-auto rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-[10px] font-bold">
            {readyOrders.length} Fertig
          </span>
        )}
      </div>

      <div className="p-3 space-y-2">
        {/* Critical: unassigned and waiting */}
        {unassigned.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-red-500 flex items-center gap-1">
              <AlertTriangle size={9} />
              Ohne Fahrer ({unassigned.length})
            </div>
            {unassigned.map(order => {
              const waitMin = minutesWaiting(order.fertig_am);
              const isCritical = waitMin >= 5;
              return (
                <div
                  key={order.id}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2',
                    isCritical
                      ? 'border-red-300/70 bg-red-50'
                      : 'border-amber-300/70 bg-amber-50',
                  )}
                >
                  <div className={cn(
                    'h-1.5 w-1.5 rounded-full shrink-0',
                    isCritical ? 'bg-red-500 animate-pulse' : 'bg-amber-500',
                  )} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-gray-800 truncate">
                      {order.kunde_name}
                    </div>
                    <div className="text-[9px] text-gray-500">
                      #{order.bestellnummer}
                      {order.delivery_zone && ` · ${order.delivery_zone}`}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={cn(
                      'text-xs font-black tabular-nums',
                      isCritical ? 'text-red-600' : 'text-amber-600',
                    )}>
                      {waitMin}m
                    </div>
                    <div className="text-[9px] text-gray-400">wartend</div>
                  </div>
                  {order.dispatch_score != null && (
                    <div className={cn(
                      'ml-1 shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-black',
                      order.dispatch_score >= 80 ? 'bg-emerald-100 text-emerald-700'
                        : order.dispatch_score >= 60 ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700',
                    )}>
                      S:{order.dispatch_score}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Assigned: show driver assignment */}
        {assigned.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 flex items-center gap-1">
              <CheckCircle2 size={9} />
              Zugewiesen ({assigned.length})
            </div>
            {assigned.map(order => {
              const batch = orderToBatch.get(order.id);
              const driverName = batch?.fahrer
                ? `${batch.fahrer.vorname} ${batch.fahrer.nachname[0]}.`
                : '–';
              return (
                <div key={order.id} className="flex items-center gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50/60 px-3 py-1.5">
                  <Bike size={11} className="text-emerald-500 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-[11px] font-semibold text-gray-700 truncate">
                      {order.kunde_name}
                    </div>
                  </div>
                  <span className="text-[9px] text-emerald-600 font-bold shrink-0">{driverName}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
