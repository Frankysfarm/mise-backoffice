'use client';

/**
 * KitchenItemSyncPanel — Phase 249
 *
 * Erkennt identische Artikel über mehrere aktive Bestellungen hinweg
 * und empfiehlt der Küche, diese Positionen zusammen zuzubereiten.
 * Unterscheidet sich von batch-prep-grouping: Gruppierung nach ARTIKEL
 * statt nach Tour/Fahrer — optimiert die Stations-Auslastung.
 */

import { useMemo } from 'react';
import { ChefHat, Layers, Flame, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

type OrderItem = {
  name: string;
  menge: number;
};

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  items: OrderItem[];
};

interface Props {
  orders: Order[];
}

type ItemGroup = {
  name: string;
  totalMenge: number;
  orders: Array<{ bestellnummer: string; menge: number; elapsedMin: number }>;
};

export function KitchenItemSyncPanel({ orders }: Props) {
  const activeOrders = orders.filter(
    (o) => o.status === 'bestätigt' || o.status === 'in_zubereitung',
  );

  const groups = useMemo((): ItemGroup[] => {
    const now = Date.now();
    const map = new Map<string, ItemGroup>();

    for (const order of activeOrders) {
      const elapsedMin = order.bestellt_am
        ? Math.floor((now - new Date(order.bestellt_am).getTime()) / 60_000)
        : 0;

      for (const item of order.items) {
        const key = item.name.toLowerCase().trim();
        if (!map.has(key)) {
          map.set(key, { name: item.name, totalMenge: 0, orders: [] });
        }
        const g = map.get(key)!;
        g.totalMenge += item.menge;
        g.orders.push({ bestellnummer: order.bestellnummer, menge: item.menge, elapsedMin });
      }
    }

    return Array.from(map.values())
      .filter((g) => g.orders.length >= 2)
      .sort((a, b) => {
        const aMaxUrgency = Math.max(...a.orders.map((o) => o.elapsedMin));
        const bMaxUrgency = Math.max(...b.orders.map((o) => o.elapsedMin));
        return bMaxUrgency - aMaxUrgency || b.totalMenge - a.totalMenge;
      });
  }, [activeOrders]);

  if (groups.length === 0) return null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-matcha-50">
        <Layers className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-matcha-700">
          Artikel-Batch-Tipp
        </span>
        <Badge className="ml-auto bg-matcha-500 text-white border-0 text-[9px] px-2">
          {groups.length} Artikel × mehrere Orders
        </Badge>
      </div>

      <div className="divide-y">
        {groups.map((group) => {
          const maxElapsed = Math.max(...group.orders.map((o) => o.elapsedMin));
          const isUrgent = maxElapsed >= 15;
          const isCritical = maxElapsed >= 20;

          return (
            <div key={group.name} className={cn(
              'flex items-start gap-3 px-4 py-2.5',
              isCritical && 'bg-red-50',
            )}>
              <div className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black',
                isCritical ? 'bg-red-500 text-white' :
                isUrgent   ? 'bg-amber-400 text-amber-900' :
                             'bg-matcha-100 text-matcha-800',
              )}>
                {group.totalMenge}×
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-foreground truncate">
                    {group.name}
                  </span>
                  {isCritical && (
                    <Flame size={12} className="text-red-500 shrink-0 animate-pulse" />
                  )}
                </div>

                <div className="flex flex-wrap gap-1 mt-1">
                  {group.orders.map((o, i) => (
                    <span
                      key={i}
                      className={cn(
                        'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
                        o.elapsedMin >= 20 ? 'bg-red-100 text-red-700' :
                        o.elapsedMin >= 15 ? 'bg-amber-100 text-amber-700' :
                                             'bg-matcha-100 text-matcha-700',
                      )}
                    >
                      #{o.bestellnummer}
                      {o.menge > 1 && ` · ${o.menge}×`}
                    </span>
                  ))}
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-end gap-0.5">
                <div className={cn(
                  'flex items-center gap-0.5 text-[10px] font-bold',
                  isCritical ? 'text-red-600' : isUrgent ? 'text-amber-600' : 'text-muted-foreground',
                )}>
                  <Clock size={9} />
                  {maxElapsed} Min
                </div>
                <ChefHat size={12} className={
                  isCritical ? 'text-red-500' : isUrgent ? 'text-amber-500' : 'text-matcha-500'
                } />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
