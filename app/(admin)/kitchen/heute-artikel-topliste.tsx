'use client';

// Phase 344: KitchenHeuteArtikelTopliste — Meistbestellte Artikel der aktuellen Schicht

import React, { useMemo } from 'react';
import { Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

type Item = { name: string; menge: number };
type Order = { items: Array<Item> };

interface Props {
  orders: Array<Order>;
}

export function KitchenHeuteArtikelTopliste({ orders }: Props) {
  const top5 = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const order of orders) {
      for (const item of order.items) {
        counts[item.name] = (counts[item.name] ?? 0) + item.menge;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [orders]);

  if (top5.length < 3) return null;

  const maxCount = top5[0]?.[1] ?? 1;

  return (
    <Card className="p-4 bg-white border border-matcha-100">
      <div className="flex items-center gap-2 mb-3">
        <Package className="h-4 w-4 text-matcha-600" />
        <span className="font-semibold text-sm text-gray-800">Meistbestellte Artikel</span>
      </div>
      <div className="space-y-2">
        {top5.map(([name, count], idx) => {
          const rank = idx + 1;
          const badgeClass =
            rank === 1
              ? 'bg-matcha-500 text-white'
              : rank === 2
              ? 'bg-amber-400 text-white'
              : 'bg-stone-300 text-stone-700';
          const barClass =
            rank === 1
              ? 'bg-matcha-500'
              : rank === 2
              ? 'bg-amber-400'
              : 'bg-stone-300';
          const barWidth = Math.round((count / maxCount) * 100);
          return (
            <div key={name} className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold flex-shrink-0',
                  badgeClass
                )}
              >
                {rank}
              </span>
              <span className="text-sm text-gray-700 flex-1 truncate">{name}</span>
              <span className="text-xs text-gray-500 w-8 text-right flex-shrink-0">×{count}</span>
              <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                <div
                  className={cn('h-full rounded-full', barClass)}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
