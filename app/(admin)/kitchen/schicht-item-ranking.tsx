'use client';

import React, { useMemo } from 'react';
import { Trophy, ChefHat, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  orders: {
    id: string;
    status: string;
    items: { name: string; menge: number }[];
    bestellt_am: string | null;
    geschaetzte_zubereitung_min: number | null;
  }[];
}

const RANK_COLORS: Record<number, string> = {
  1: 'bg-yellow-400 text-yellow-900',
  2: 'bg-gray-300 text-gray-800',
  3: 'bg-amber-600 text-amber-50',
  4: 'bg-matcha-500 text-white',
  5: 'bg-matcha-500 text-white',
};

export function KitchenSchichtItemRanking({ orders }: Props) {
  const ranked = useMemo(() => {
    const counts: Record<string, { count: number; avgPrep: number; prepSum: number; prepN: number }> = {};
    for (const o of orders) {
      const prep = o.geschaetzte_zubereitung_min ?? 0;
      for (const item of o.items) {
        if (!counts[item.name]) counts[item.name] = { count: 0, avgPrep: 0, prepSum: 0, prepN: 0 };
        counts[item.name].count += item.menge;
        if (prep > 0) { counts[item.name].prepSum += prep; counts[item.name].prepN += 1; }
      }
    }
    return Object.entries(counts)
      .map(([name, v]) => ({ name, count: v.count, avgPrep: v.prepN > 0 ? Math.round(v.prepSum / v.prepN) : null }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [orders]);

  const maxCount = ranked[0]?.count ?? 1;

  if (ranked.length === 0) return null;

  return (
    <div className="rounded-xl border border-matcha-100 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-yellow-500" />
        <span className="text-sm font-semibold text-matcha-900">Schicht-Artikel-Ranking</span>
        <span className="ml-auto text-xs text-matcha-600">Top 5 dieser Schicht</span>
      </div>
      <div className="space-y-2">
        {ranked.map((item, i) => {
          const rank = i + 1;
          const pct = Math.round((item.count / maxCount) * 100);
          return (
            <div key={item.name} className="flex items-center gap-2">
              <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold', RANK_COLORS[rank] ?? 'bg-matcha-100 text-matcha-700')}>
                {rank}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-xs font-medium text-matcha-900">{item.name}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    {item.avgPrep !== null && (
                      <span className="flex items-center gap-0.5 text-xs text-matcha-500">
                        <ChefHat className="h-3 w-3" />{item.avgPrep}m
                      </span>
                    )}
                    <span className="flex items-center gap-0.5 text-xs font-semibold text-matcha-700">
                      <Package className="h-3 w-3" />{item.count}×
                    </span>
                  </div>
                </div>
                <div className="mt-0.5 h-1.5 w-full rounded-full bg-matcha-50">
                  <div className="h-1.5 rounded-full bg-matcha-400 transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
