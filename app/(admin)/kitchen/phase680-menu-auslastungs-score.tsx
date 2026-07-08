'use client';

/**
 * Phase 680 — Tages-Menü-Auslastungs-Score
 * Welche Menüpunkte heute am häufigsten bestellt wurden, Hit-Rate in %.
 * Props: orders: Order[] (aus Kitchen client.tsx, enthält items[])
 */

import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, UtensilsCrossed, TrendingUp } from 'lucide-react';

type Item = { name?: string; menge?: number; quantity?: number };
type Order = { items?: Item[]; status?: string; created_at?: string };

export function KitchenPhase680MenuAuslastungsScore({ orders }: { orders: Order[] }) {
  const [open, setOpen] = useState(false);

  const { topItems, totalOrdersHeute } = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const heutigeOrders = orders.filter(
      (o) => !o.created_at || o.created_at.startsWith(todayStr),
    );
    const gesamt = heutigeOrders.length;

    const countMap = new Map<string, { bestellungen: number; menge: number }>();
    for (const o of heutigeOrders) {
      for (const item of o.items ?? []) {
        const name = (item.name ?? '').trim();
        if (!name) continue;
        const qty = (item.menge ?? item.quantity ?? 1);
        const prev = countMap.get(name) ?? { bestellungen: 0, menge: 0 };
        countMap.set(name, {
          bestellungen: prev.bestellungen + 1,
          menge: prev.menge + qty,
        });
      }
    }

    const sorted = [...countMap.entries()]
      .map(([name, { bestellungen, menge }]) => ({
        name,
        bestellungen,
        menge,
        hitRate: gesamt > 0 ? Math.round((bestellungen / gesamt) * 100) : 0,
      }))
      .sort((a, b) => b.bestellungen - a.bestellungen)
      .slice(0, 10);

    return { topItems: sorted, totalOrdersHeute: gesamt };
  }, [orders]);

  const maxBestellungen = Math.max(1, ...topItems.map((i) => i.bestellungen));

  if (topItems.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition"
        onClick={() => setOpen((p) => !p)}
      >
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-4 w-4 text-orange-500" />
          <span className="font-semibold text-sm">Menü-Auslastung heute</span>
          <span className="text-xs text-muted-foreground">
            Top {topItems.length} aus {totalOrdersHeute} Bestellungen
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {topItems[0] && (
            <div className="flex items-center gap-2 rounded-lg bg-orange-50 dark:bg-orange-950/20 px-3 py-2 mb-3">
              <TrendingUp className="h-4 w-4 text-orange-500 shrink-0" />
              <p className="text-xs font-medium text-orange-700 dark:text-orange-300">
                <span className="font-bold">{topItems[0].name}</span> ist heute der Bestseller
                ({topItems[0].hitRate}% aller Bestellungen)
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            {topItems.map((item, idx) => (
              <div key={item.name} className="flex items-center gap-3">
                <span className="w-5 text-right text-xs font-mono text-muted-foreground shrink-0">
                  {idx + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="text-xs font-medium truncate" title={item.name}>
                      {item.name}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {item.menge}× ({item.bestellungen} Best.)
                      </span>
                      <span
                        className={cn(
                          'text-[10px] font-bold px-1.5 py-0.5 rounded-full',
                          item.hitRate >= 50
                            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                            : item.hitRate >= 25
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                            : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {item.hitRate}%
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        item.hitRate >= 50
                          ? 'bg-orange-500'
                          : item.hitRate >= 25
                          ? 'bg-amber-400'
                          : 'bg-slate-400',
                      )}
                      style={{ width: `${Math.round((item.bestellungen / maxBestellungen) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
