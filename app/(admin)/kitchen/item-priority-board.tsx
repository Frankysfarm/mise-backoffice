'use client';

/**
 * ItemPriorityBoard — Welche Artikel JETZT zubreiten?
 * Aggregiert alle Items aus aktiven Bestellungen (bestätigt / in_zubereitung),
 * gruppiert nach Artikel-Name, sortiert nach Dringlichkeit (Ready-Target / Wartezeit).
 * Hilft der Küche schnell zu sehen: „2× Burger + 1× Pommes brauche ich in 3 Min"
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Clock, Flame, Target, Timer } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  items: { id: string; name: string; menge: number; notiz: string | null }[];
};

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

type AggregatedItem = {
  name: string;
  totalMenge: number;
  orders: { bestellnummer: string; menge: number; notiz: string | null }[];
  earliestReadyMs: number | null; // When the EARLIEST order with this item must be done
  urgencyLabel: string;
  urgencyLevel: 'critical' | 'warn' | 'ok';
};

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT(n => n + 1), 5000);
    return () => clearInterval(iv);
  }, []);
}

function fmtCountdown(ms: number): string {
  if (ms < 0) return `${Math.ceil(-ms / 60_000)} Min überfällig`;
  const min = Math.floor(ms / 60_000);
  return `in ${min} Min`;
}

export function ItemPriorityBoard({
  orders,
  timings,
}: {
  orders: Order[];
  timings: KitchenTiming[];
}) {
  useTick();

  const now = Date.now();
  const activeOrders = orders.filter(o => ['bestätigt', 'in_zubereitung'].includes(o.status));
  if (activeOrders.length === 0) return null;

  // Build timing lookup: order_id → ready target timestamp
  const readyTargetMs = new Map<string, number>();
  for (const t of timings) {
    if (t.ready_target && (t.status === 'scheduled' || t.status === 'cooking')) {
      readyTargetMs.set(t.order_id, new Date(t.ready_target).getTime());
    }
  }

  // Aggregate items across all active orders
  const itemMap = new Map<string, AggregatedItem>();
  for (const order of activeOrders) {
    // Get ready target for this order, or estimate from bestellt_am + prep_min
    let readyMs = readyTargetMs.get(order.id) ?? null;
    if (!readyMs && order.bestellt_am) {
      const prepMin = order.geschaetzte_zubereitung_min ?? 15;
      readyMs = new Date(order.bestellt_am).getTime() + prepMin * 60_000;
    }

    for (const item of (order.items ?? [])) {
      const key = item.name.toLowerCase().trim();
      if (!itemMap.has(key)) {
        itemMap.set(key, {
          name: item.name,
          totalMenge: 0,
          orders: [],
          earliestReadyMs: null,
          urgencyLabel: '',
          urgencyLevel: 'ok',
        });
      }
      const agg = itemMap.get(key)!;
      agg.totalMenge += item.menge;
      agg.orders.push({ bestellnummer: order.bestellnummer, menge: item.menge, notiz: item.notiz });
      if (readyMs !== null && (agg.earliestReadyMs === null || readyMs < agg.earliestReadyMs)) {
        agg.earliestReadyMs = readyMs;
      }
    }
  }

  // Compute urgency for each aggregated item
  const items: AggregatedItem[] = [];
  for (const item of itemMap.values()) {
    if (item.earliestReadyMs !== null) {
      const msLeft = item.earliestReadyMs - now;
      item.urgencyLabel = fmtCountdown(msLeft);
      item.urgencyLevel = msLeft < 0 ? 'critical' : msLeft < 5 * 60_000 ? 'warn' : 'ok';
    } else {
      item.urgencyLabel = 'Keine Zeitangabe';
      item.urgencyLevel = 'ok';
    }
    items.push(item);
  }

  // Sort by urgency: critical first, then warn, then ok; within same level by earliest ready
  items.sort((a, b) => {
    const levelOrder = { critical: 0, warn: 1, ok: 2 };
    if (levelOrder[a.urgencyLevel] !== levelOrder[b.urgencyLevel]) {
      return levelOrder[a.urgencyLevel] - levelOrder[b.urgencyLevel];
    }
    if (a.earliestReadyMs !== null && b.earliestReadyMs !== null) {
      return a.earliestReadyMs - b.earliestReadyMs;
    }
    return 0;
  });

  const criticalCount = items.filter(i => i.urgencyLevel === 'critical').length;
  const warnCount = items.filter(i => i.urgencyLevel === 'warn').length;

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/50">
        <ChefHat className="h-4 w-4 text-orange-500" />
        <span className="text-xs font-black uppercase tracking-wider text-foreground">
          Artikel-Priorität · {items.length} verschiedene
        </span>
        {criticalCount > 0 && (
          <span className="ml-1 rounded-full bg-red-600 text-white px-2 py-0.5 text-[9px] font-black animate-pulse">
            {criticalCount} überfällig
          </span>
        )}
        {warnCount > 0 && (
          <span className="ml-1 rounded-full bg-orange-500 text-white px-2 py-0.5 text-[9px] font-black">
            {warnCount} dringend
          </span>
        )}
        <div className="flex-1" />
        <span className="text-[9px] text-muted-foreground">{activeOrders.length} aktive Bestellungen</span>
      </div>

      {/* Item Grid */}
      <div className="p-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {items.map(item => (
          <div
            key={item.name}
            className={cn(
              'rounded-xl border px-2.5 py-2 space-y-1',
              item.urgencyLevel === 'critical'
                ? 'border-red-400 bg-red-50 animate-pulse'
                : item.urgencyLevel === 'warn'
                ? 'border-orange-300 bg-orange-50'
                : 'border-border bg-card',
            )}
          >
            {/* Quantity + Name */}
            <div className="flex items-center gap-1.5">
              <span className={cn(
                'text-lg font-black leading-none tabular-nums shrink-0',
                item.urgencyLevel === 'critical' ? 'text-red-700'
                : item.urgencyLevel === 'warn' ? 'text-orange-700'
                : 'text-foreground',
              )}>
                {item.totalMenge}×
              </span>
              <span className="text-[11px] font-bold text-foreground leading-tight line-clamp-2 flex-1">
                {item.name}
              </span>
            </div>

            {/* Urgency */}
            <div className={cn(
              'flex items-center gap-1 text-[10px] font-bold',
              item.urgencyLevel === 'critical' ? 'text-red-600'
              : item.urgencyLevel === 'warn' ? 'text-orange-600'
              : 'text-muted-foreground',
            )}>
              {item.urgencyLevel === 'critical'
                ? <Flame className="h-2.5 w-2.5 shrink-0" />
                : item.urgencyLevel === 'warn'
                ? <Timer className="h-2.5 w-2.5 shrink-0" />
                : <Clock className="h-2.5 w-2.5 shrink-0" />
              }
              <span className="truncate">{item.urgencyLabel}</span>
            </div>

            {/* Orders contributing this item */}
            {item.orders.length > 1 && (
              <div className="text-[8px] text-muted-foreground">
                {item.orders.map(o => `#${o.bestellnummer}(${o.menge})`).join(' ')}
              </div>
            )}

            {/* Notizen (if any) */}
            {item.orders.some(o => o.notiz) && (
              <div className="text-[9px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 leading-snug">
                {item.orders.filter(o => o.notiz).map(o => o.notiz).join(' · ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
