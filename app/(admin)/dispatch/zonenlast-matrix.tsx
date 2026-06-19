'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Layers, Users, Package, AlertTriangle } from 'lucide-react';

type ReadyOrder = {
  id: string;
  delivery_zone: string | null;
  status: string;
};

type Driver = {
  employee_id: string;
  ist_online: boolean;
  aktueller_batch_id: string | null;
};

interface Props {
  orders: ReadyOrder[];
  drivers: Driver[];
}

const ZONE_COLORS: Record<string, { bg: string; border: string; text: string; bar: string }> = {
  A: { bg: 'bg-emerald-50',  border: 'border-emerald-200',  text: 'text-emerald-800',  bar: 'bg-emerald-500' },
  B: { bg: 'bg-sky-50',      border: 'border-sky-200',      text: 'text-sky-800',      bar: 'bg-sky-500'     },
  C: { bg: 'bg-amber-50',    border: 'border-amber-200',    text: 'text-amber-800',    bar: 'bg-amber-500'   },
  D: { bg: 'bg-purple-50',   border: 'border-purple-200',   text: 'text-purple-800',   bar: 'bg-purple-500'  },
  '?': { bg: 'bg-stone-50',  border: 'border-stone-200',    text: 'text-stone-700',    bar: 'bg-stone-400'   },
};

function capacityStatus(orders: number, freeDrivers: number): 'ok' | 'tight' | 'overloaded' {
  if (freeDrivers === 0 && orders > 0) return 'overloaded';
  if (orders > freeDrivers * 2) return 'overloaded';
  if (orders > freeDrivers) return 'tight';
  return 'ok';
}

export function DispatchZonenlastMatrix({ orders, drivers }: Props) {
  const matrix = useMemo(() => {
    const zones = new Map<string, { orders: number; driversFree: number; driversTotal: number }>();

    for (const o of orders) {
      if (!['fertig', 'unterwegs'].includes(o.status)) continue;
      const z = o.delivery_zone ?? '?';
      if (!zones.has(z)) zones.set(z, { orders: 0, driversFree: 0, driversTotal: 0 });
      zones.get(z)!.orders++;
    }

    // distribute online drivers (rough estimate — no zone field on driver status)
    const freeDrivers = drivers.filter((d) => d.ist_online && !d.aktueller_batch_id);
    const busyDrivers = drivers.filter((d) => d.ist_online && d.aktueller_batch_id);

    // Sort zones for display
    const sorted = [...zones.entries()].sort((a, b) => b[1].orders - a[1].orders);

    // Spread free drivers across zones proportionally to order count
    const totalOrders = sorted.reduce((s, [, v]) => s + v.orders, 0);
    sorted.forEach(([, v]) => {
      v.driversTotal = Math.round((v.orders / Math.max(1, totalOrders)) * drivers.filter((d) => d.ist_online).length);
      v.driversFree = Math.round((v.orders / Math.max(1, totalOrders)) * freeDrivers.length);
    });

    return {
      zones: sorted,
      freeCount: freeDrivers.length,
      busyCount: busyDrivers.length,
      totalPending: totalOrders,
    };
  }, [orders, drivers]);

  if (matrix.zones.length === 0) return null;

  const maxOrders = Math.max(...matrix.zones.map(([, v]) => v.orders), 1);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Layers className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">
          Zonen-Last-Matrix
        </span>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1 text-matcha-700 font-bold">
            <Users className="h-3 w-3" />{matrix.freeCount} frei
          </span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Package className="h-3 w-3" />{matrix.totalPending} best.
          </span>
        </div>
      </div>

      {/* Zone rows */}
      <div className="divide-y">
        {matrix.zones.map(([zone, data]) => {
          const colors = ZONE_COLORS[zone] ?? ZONE_COLORS['?'];
          const status = capacityStatus(data.orders, data.driversFree);
          const pct = Math.round((data.orders / maxOrders) * 100);

          const statusLabel =
            status === 'overloaded' ? 'Überlastet' :
            status === 'tight'      ? 'Knapp'      : 'OK';
          const statusColor =
            status === 'overloaded' ? 'bg-red-100 text-red-700' :
            status === 'tight'      ? 'bg-amber-100 text-amber-700' :
                                      'bg-matcha-100 text-matcha-700';

          return (
            <div key={zone} className={cn('px-4 py-2.5 flex items-center gap-3', colors.bg)}>
              {/* Zone badge */}
              <div className={cn(
                'h-8 w-8 rounded-lg grid place-items-center shrink-0 border font-black text-sm',
                colors.border, colors.text, 'bg-white/70',
              )}>
                {zone}
              </div>

              {/* Bar + counts */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1 text-[10px]">
                  <span className="font-bold text-foreground tabular-nums">{data.orders} Bestellungen</span>
                  <span className={cn('rounded-full px-2 py-0.5 font-bold', statusColor)}>
                    {statusLabel}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-black/8 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', colors.bar)}
                    style={{ width: `${Math.max(6, pct)}%` }}
                  />
                </div>
              </div>

              {/* Driver indicator */}
              <div className="shrink-0 flex flex-col items-end gap-0.5">
                <div className="flex items-center gap-1 text-[10px] font-bold">
                  <Users className="h-3 w-3 text-muted-foreground" />
                  <span className={cn(
                    data.driversFree === 0 && data.orders > 0 ? 'text-red-600' : 'text-foreground',
                  )}>
                    {data.driversFree}
                  </span>
                </div>
                {status === 'overloaded' && (
                  <AlertTriangle className="h-3 w-3 text-red-500 animate-pulse" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 bg-muted/30 border-t text-[9px] text-muted-foreground">
        Fahrer-Verteilung: Schätzung proportional zur Bestelllast
      </div>
    </div>
  );
}
