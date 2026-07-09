'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Flame, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

/**
 * Phase 947 — Parallel-Koch-Monitor (Kitchen)
 *
 * Zeigt wie viele Artikel gleichzeitig in Zubereitung sind vs. Küchen-Kapazität (Burner-Slots).
 * Client-seitig, kein API-Call.
 */

interface OrderItem {
  name: string;
  qty?: number;
}

interface Order {
  id: string;
  status: string;
  artikel?: OrderItem[] | null;
  items?: OrderItem[] | null;
  bestellt_am?: string | null;
  started_at?: string | null;
  zubereitung_start?: string | null;
}

interface Props {
  orders: Order[];
  burnerSlots?: number;
}

const ACTIVE_STATUSES = new Set(['zubereitung', 'in_preparation', 'preparing', 'in_kitchen', 'bestätigt', 'confirmed']);

interface SlotItem {
  articleName: string;
  count: number;
  orderIds: string[];
}

export function KitchenPhase947ParallelKochMonitor({ orders, burnerSlots = 8 }: Props) {
  const [open, setOpen] = useState(true);

  const { slotItems, totalParallelItems, usedSlots, overloadCount } = useMemo(() => {
    const activeOrders = orders.filter((o) => ACTIVE_STATUSES.has(o.status));

    // Aggregiere Artikel-Namen über alle aktiven Bestellungen
    const articleMap = new Map<string, { count: number; orderIds: string[] }>();

    for (const order of activeOrders) {
      const items = order.artikel ?? order.items ?? [];
      for (const item of items) {
        const name = item.name?.trim() ?? 'Unbekannt';
        if (!articleMap.has(name)) articleMap.set(name, { count: 0, orderIds: [] });
        const entry = articleMap.get(name)!;
        entry.count += item.qty ?? 1;
        if (!entry.orderIds.includes(order.id)) entry.orderIds.push(order.id);
      }
    }

    const slotItems: SlotItem[] = [...articleMap.entries()]
      .map(([articleName, { count, orderIds }]) => ({ articleName, count, orderIds }))
      .sort((a, b) => b.count - a.count);

    const totalParallelItems = slotItems.reduce((s, i) => s + i.count, 0);
    // Jeder unique Artikel-Typ belegt effektiv einen Brennerbereich
    const usedSlots = Math.min(slotItems.length, burnerSlots);
    const overloadCount = Math.max(0, slotItems.length - burnerSlots);

    return { slotItems, totalParallelItems, usedSlots, overloadCount };
  }, [orders, burnerSlots]);

  const capacityPct = burnerSlots > 0 ? Math.round((usedSlots / burnerSlots) * 100) : 0;
  const overloaded = slotItems.length > burnerSlots;
  const isHot = capacityPct >= 90 || overloaded;
  const isWarm = capacityPct >= 60;

  if (slotItems.length === 0) return null;

  return (
    <div className={cn(
      'rounded-xl border overflow-hidden',
      overloaded ? 'border-red-300 dark:border-red-800 bg-red-50/60 dark:bg-red-950/30'
        : isHot ? 'border-amber-300 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/30'
        : 'border-border bg-card',
    )}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/20 transition text-left"
      >
        <Flame className={cn('h-4 w-4 shrink-0', overloaded ? 'text-red-500' : isHot ? 'text-amber-500' : 'text-matcha-500')} />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Parallel-Koch-Monitor
        </span>

        {/* Kapazitäts-Badge */}
        <span className={cn(
          'ml-1 rounded-full px-2 py-0.5 text-[10px] font-black',
          overloaded
            ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
            : isHot
            ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
            : 'bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300',
        )}>
          {usedSlots}/{burnerSlots} Slots
        </span>

        {overloaded && (
          <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/50 px-2 py-0.5 text-[10px] font-black text-red-700 dark:text-red-300">
            <AlertTriangle className="h-2.5 w-2.5" />
            +{overloadCount} über Kapazität
          </span>
        )}

        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* Kapazitäts-Balken */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{slotItems.length} Artikel-Typen parallel · {totalParallelItems} Portionen gesamt</span>
              <span className={cn('font-bold', overloaded ? 'text-red-600 dark:text-red-400' : isHot ? 'text-amber-600 dark:text-amber-400' : 'text-matcha-600 dark:text-matcha-400')}>
                {capacityPct}% Kapazität
              </span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  overloaded ? 'bg-red-500' : isHot ? 'bg-amber-500' : isWarm ? 'bg-amber-400' : 'bg-matcha-500',
                )}
                style={{ width: `${Math.min(capacityPct, 100)}%` }}
              />
            </div>
            {overloaded && (
              <p className="text-[10px] font-semibold text-red-600 dark:text-red-400">
                ⚠ Überlastet! {overloadCount} Artikel-{overloadCount === 1 ? 'Typ' : 'Typen'} ohne freien Slot. Priorisierung empfohlen.
              </p>
            )}
          </div>

          {/* Artikel-Liste */}
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {slotItems.slice(0, 10).map((item, idx) => {
              const slotAvailable = idx < burnerSlots;
              return (
                <div
                  key={item.articleName}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2',
                    !slotAvailable
                      ? 'border-red-200 dark:border-red-800 bg-red-50/80 dark:bg-red-950/40'
                      : 'border-border bg-background/60',
                  )}
                >
                  <span className={cn(
                    'text-[10px] font-black w-4 text-center shrink-0',
                    !slotAvailable ? 'text-red-500' : 'text-muted-foreground',
                  )}>
                    {slotAvailable ? `S${idx + 1}` : '—'}
                  </span>
                  <span className="flex-1 text-xs font-semibold text-foreground truncate">{item.articleName}</span>
                  <span className={cn(
                    'text-xs font-black tabular-nums shrink-0',
                    item.count >= 5 ? 'text-red-600 dark:text-red-400'
                      : item.count >= 3 ? 'text-amber-600 dark:text-amber-400'
                      : 'text-matcha-600 dark:text-matcha-400',
                  )}>
                    ×{item.count}
                  </span>
                  <span className="text-[9px] text-muted-foreground shrink-0">
                    {item.orderIds.length} Bestel{item.orderIds.length === 1 ? 'lung' : 'lungen'}
                  </span>
                </div>
              );
            })}
            {slotItems.length > 10 && (
              <p className="col-span-full text-center text-[10px] text-muted-foreground">
                +{slotItems.length - 10} weitere Artikel-Typen
              </p>
            )}
          </div>

          {/* Empfehlung */}
          {overloaded && (
            <div className="rounded-lg bg-red-100 dark:bg-red-950/50 border border-red-200 dark:border-red-800 px-3 py-2 text-[11px] text-red-700 dark:text-red-300 font-medium">
              💡 Tipp: Bestellungen mit gleichen Artikeln zusammenfassen oder Küchen-Kapazität ({burnerSlots} Slots) vorübergehend erhöhen.
            </div>
          )}
          {!overloaded && isHot && (
            <div className="rounded-lg bg-amber-100 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-3 py-2 text-[11px] text-amber-700 dark:text-amber-300 font-medium">
              ⚡ Hohe Auslastung — nächste Bestellungen können Wartezeit erhöhen.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
