'use client';

import { useEffect, useState, useCallback } from 'react';
import { Package, Clock } from 'lucide-react';

interface Order {
  id: string;
  status: string;
  driver_id?: string | null;
  driver_name?: string | null;
  created_at: string;
  estimated_pickup_at?: string | null;
}

interface BatchGroup {
  driverId: string;
  driverName: string;
  bestellungen: Order[];
  pickupIn: number | null;
}

function calcPickupIn(orders: Order[]): number | null {
  const pickupTimes = orders
    .map((o) => o.estimated_pickup_at)
    .filter(Boolean)
    .map((t) => new Date(t!).getTime());
  if (pickupTimes.length === 0) return null;
  const earliest = Math.min(...pickupTimes);
  const minLeft = Math.round((earliest - Date.now()) / 60_000);
  return minLeft;
}

function groupByDriver(orders: Order[]): BatchGroup[] {
  const map = new Map<string, Order[]>();
  for (const o of orders) {
    if (!o.driver_id) continue;
    if (!['in_zubereitung', 'bereit'].includes(o.status)) continue;
    if (!map.has(o.driver_id)) map.set(o.driver_id, []);
    map.get(o.driver_id)!.push(o);
  }
  const groups: BatchGroup[] = [];
  map.forEach((bestellungen, driverId) => {
    if (bestellungen.length < 2) return;
    groups.push({
      driverId,
      driverName: bestellungen[0].driver_name ?? `Fahrer ${driverId.slice(0, 4)}`,
      bestellungen,
      pickupIn: calcPickupIn(bestellungen),
    });
  });
  return groups.sort((a, b) => (a.pickupIn ?? 99) - (b.pickupIn ?? 99));
}

export function KitchenPhase621BatchCountdownTafel({ orders }: { orders: Order[] }) {
  const [now, setNow] = useState<number>(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  const groups = groupByDriver(orders);

  if (groups.length === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <span className="text-sm font-bold text-blue-800 dark:text-blue-200 uppercase tracking-wide">
          Batch-Countdown
        </span>
        <span className="ml-auto rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
          {groups.length} Fahrer
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {groups.map((g) => {
          const minLeft = g.pickupIn;
          const dringend = minLeft !== null && minLeft <= 5;
          return (
            <div
              key={g.driverId}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 ${
                dringend
                  ? 'bg-red-100 dark:bg-red-950/30 border border-red-300 dark:border-red-700'
                  : 'bg-white dark:bg-gray-800/40 border border-blue-200 dark:border-blue-700'
              }`}
            >
              <div className="shrink-0">
                <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-700 dark:text-blue-300">
                    {g.driverName.charAt(0)}
                  </span>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {g.driverName}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {g.bestellungen.length} Bestellungen im Batch
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-1">
                <Clock className={`h-4 w-4 ${dringend ? 'text-red-500' : 'text-blue-500'}`} />
                <span
                  className={`text-lg font-black tabular-nums ${
                    dringend ? 'text-red-600 dark:text-red-400' : 'text-blue-700 dark:text-blue-300'
                  }`}
                >
                  {minLeft !== null ? (minLeft <= 0 ? 'Jetzt' : `${minLeft} Min`) : '— Min'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
