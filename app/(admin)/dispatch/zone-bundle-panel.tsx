'use client';

import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn, euro } from '@/lib/utils';
import { MapPin, Package, Route, TrendingUp, Zap } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  delivery_zone: string | null;
  kunde_adresse: string | null;
  gesamtbetrag: number;
  fertig_am: string | null;
  dispatch_score: number | null;
};

export function ZoneBundlePanel({ orders }: { orders: Order[] }) {
  const zoneGroups = useMemo(() => {
    const ready = orders.filter((o) => o.status === 'fertig');

    const map = new Map<string, Order[]>();
    for (const order of ready) {
      const zone = order.delivery_zone ?? 'Unbekannt';
      if (!map.has(zone)) map.set(zone, []);
      map.get(zone)!.push(order);
    }

    return Array.from(map.entries())
      .map(([zone, zoneOrders]) => {
        const total = zoneOrders.reduce((sum, o) => sum + o.gesamtbetrag, 0);
        const scores = zoneOrders
          .map((o) => o.dispatch_score)
          .filter((s): s is number => s !== null);
        const avgScore =
          scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : null;
        return { zone, orders: zoneOrders, total, avgScore };
      })
      .sort((a, b) => b.orders.length - a.orders.length);
  }, [orders]);

  if (zoneGroups.length === 0) {
    return (
      <Card className="flex items-center justify-center gap-2 p-6 text-sm text-gray-400 bg-gray-50">
        <Package className="h-4 w-4 shrink-0" />
        <span>Keine Bestellungen bereit zum Bündeln</span>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {zoneGroups.map(({ zone, orders: zoneOrders, total, avgScore }) => {
        const isBundle = zoneOrders.length >= 2;

        return (
          <Card key={zone} className="overflow-hidden bg-white">
            <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-500" />
              <span className="flex-1 text-sm font-bold text-gray-800">{zone}</span>
              <Badge
                className={cn(
                  'gap-1 border text-[10px] font-bold',
                  isBundle
                    ? 'border-green-200 bg-green-100 text-green-700'
                    : 'border-gray-200 bg-gray-100 text-gray-600',
                )}
              >
                {isBundle ? (
                  <>
                    <Zap className="h-3 w-3" />
                    Optimal bündeln
                  </>
                ) : (
                  'Einzeltour'
                )}
              </Badge>
            </div>

            <div className="px-4 py-3 space-y-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <Package className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span>
                    <span className="font-bold text-gray-800">{zoneOrders.length}</span>{' '}
                    {zoneOrders.length === 1 ? 'Bestellung' : 'Bestellungen'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-gray-600">
                  <Route className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span className="font-bold text-gray-800">{euro(total)}</span>
                </div>
                {avgScore !== null && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-600 ml-auto">
                    <TrendingUp className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                    <span>
                      Ø Score{' '}
                      <span className="font-bold text-gray-800">{avgScore}</span>
                    </span>
                  </div>
                )}
              </div>

              <ul className="flex flex-wrap gap-1.5">
                {zoneOrders.map((o) => (
                  <li
                    key={o.id}
                    className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-700 tabular-nums"
                  >
                    #{o.bestellnummer}
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
