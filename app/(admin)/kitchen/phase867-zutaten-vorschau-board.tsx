'use client';

import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Package } from 'lucide-react';

interface OrderItem {
  name: string;
  menge?: number;
  quantity?: number;
}

interface Order {
  id: string;
  status?: string;
  items?: OrderItem[];
}

interface Props {
  orders: Order[];
  locationId: string | null;
}

interface ZutatBedarf {
  name: string;
  portionen: number;
  bestellungen: number;
}

const ACTIVE_STATUSES = new Set(['neu', 'bestätigt', 'in_zubereitung', 'bereit', 'confirmed', 'preparing', 'ready']);

export function KitchenPhase867ZutatenVorschauBoard({ orders, locationId }: Props) {
  const bedarfMap = useMemo(() => {
    const map = new Map<string, ZutatBedarf>();
    for (const order of orders) {
      if (!ACTIVE_STATUSES.has(order.status ?? '')) continue;
      for (const item of order.items ?? []) {
        const key = item.name.toLowerCase().trim();
        const menge = item.menge ?? item.quantity ?? 1;
        const prev = map.get(key);
        if (prev) {
          prev.portionen += menge;
          prev.bestellungen += 1;
        } else {
          map.set(key, { name: item.name, portionen: menge, bestellungen: 1 });
        }
      }
    }
    return map;
  }, [orders]);

  const sorted = useMemo(
    () => [...bedarfMap.values()].sort((a, b) => b.portionen - a.portionen).slice(0, 10),
    [bedarfMap]
  );

  if (!locationId || sorted.length === 0) return null;

  const maxPortionen = sorted[0]?.portionen ?? 1;

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold text-foreground">Zutaten-Bedarf jetzt</span>
        <span className="ml-auto text-[10px] text-muted-foreground">{bedarfMap.size} Artikel aktiv</span>
      </div>

      <div className="space-y-1">
        {sorted.map((z) => {
          const pct = (z.portionen / maxPortionen) * 100;
          const barColor =
            z.portionen >= 10
              ? 'bg-red-500'
              : z.portionen >= 5
              ? 'bg-amber-400'
              : 'bg-matcha-500';
          return (
            <div key={z.name} className="flex items-center gap-2">
              <span className="w-28 shrink-0 truncate text-[11px] text-foreground font-medium">{z.name}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', barColor)}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-14 shrink-0 text-right text-[11px] font-bold tabular-nums text-foreground">
                {z.portionen}×
              </span>
              <span className="w-12 shrink-0 text-right text-[9px] text-muted-foreground">
                {z.bestellungen} Bestellg.
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
