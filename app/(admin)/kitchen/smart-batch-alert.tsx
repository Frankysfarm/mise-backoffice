'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Package, Route, Zap, MapPin } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  delivery_zone: string | null;
  fertig_am: string | null;
  items: { name: string; menge: number }[];
};

type BatchOpportunity = {
  zone: string;
  orders: Order[];
  avgWaitMin: number;
  itemCount: number;
};

function findBatchOpportunities(orders: Order[]): BatchOpportunity[] {
  const ready = orders.filter(
    (o) => o.status === 'fertig' && o.typ === 'lieferung' && o.delivery_zone,
  );

  const byZone = new Map<string, Order[]>();
  for (const o of ready) {
    const z = o.delivery_zone!;
    if (!byZone.has(z)) byZone.set(z, []);
    byZone.get(z)!.push(o);
  }

  const result: BatchOpportunity[] = [];
  const now = Date.now();
  byZone.forEach((zoneOrders, zone) => {
    if (zoneOrders.length < 2) return;
    const totalWait = zoneOrders.reduce((s, o) => {
      return s + (o.fertig_am ? now - new Date(o.fertig_am).getTime() : 0);
    }, 0);
    const avgWaitMin = Math.round(totalWait / zoneOrders.length / 60_000);
    const itemCount = zoneOrders.reduce((s, o) => s + o.items.reduce((si, i) => si + i.menge, 0), 0);
    result.push({ zone, orders: zoneOrders, avgWaitMin, itemCount });
  });

  return result.sort((a, b) => b.orders.length - a.orders.length);
}

export function KitchenSmartBatchAlert({ orders }: { orders: Order[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const opportunities = findBatchOpportunities(orders).filter(
    (op) => !dismissed.has(`${op.zone}-${op.orders.map((o) => o.id).sort().join(',')}`),
  );

  if (opportunities.length === 0) return null;

  return (
    <div className="space-y-2">
      {opportunities.slice(0, 2).map((op) => {
        const key = `${op.zone}-${op.orders.map((o) => o.id).sort().join(',')}`;
        return (
          <div
            key={key}
            className="flex items-start gap-3 rounded-xl border-2 border-blue-300 bg-blue-50 px-4 py-3 shadow-sm"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
              <Route className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-display text-sm font-bold text-blue-900">
                  Batch-Chance: Zone {op.zone}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-200 px-2 py-0.5 text-[10px] font-black text-blue-800">
                  <MapPin className="h-2.5 w-2.5" />
                  {op.orders.length} Bestellungen
                </span>
                {op.avgWaitMin > 5 && (
                  <span className={cn(
                    'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold',
                    op.avgWaitMin > 15 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700',
                  )}>
                    Ø {op.avgWaitMin} Min Wartezeit
                  </span>
                )}
              </div>
              <div className="mt-1 text-[11px] text-blue-700">
                {op.orders.map((o) => o.bestellnummer).join(' · ')}
                {' · '}
                {op.itemCount} Artikel gesamt
              </div>
              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-blue-600">
                <Zap className="h-2.5 w-2.5" />
                Gemeinsam dispatchen spart Fahrzeit — an Dispatch weiterleiten!
              </div>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button
                onClick={() => setDismissed((prev) => new Set([...prev, key]))}
                className="rounded-md bg-blue-100 border border-blue-200 px-2.5 py-1 text-[10px] font-bold text-blue-700 hover:bg-blue-200 transition"
              >
                OK
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
