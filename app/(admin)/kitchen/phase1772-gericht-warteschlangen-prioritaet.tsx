'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, Clock, ListOrdered } from 'lucide-react';

/**
 * Phase 1772 — Gericht-Warteschlangen-Priorität (Kitchen)
 *
 * Welches Gericht hat die längste Wartezeit heute?
 * Priorisierungsliste + Alert wenn >15 Min; useMemo; Props orders; Collapsible.
 */

interface OrderItem {
  name?: string;
  menu_item_name?: string;
  product_name?: string;
  menge?: number;
  quantity?: number;
}

interface Order {
  id?: string;
  status?: string;
  created_at?: string;
  createdAt?: string;
  items?: OrderItem[];
  order_items?: OrderItem[];
}

interface Props {
  orders: Order[];
  className?: string;
}

interface GerichtWarteschlange {
  name: string;
  anzahl: number;
  aelteste_bestellung_vor_min: number;
  avg_wartezeit_min: number;
  kritisch: boolean;
}

const ALERT_SCHWELLE_MIN = 15;

function getItems(order: Order): OrderItem[] {
  return order.items ?? order.order_items ?? [];
}

function getItemName(item: OrderItem): string {
  return item.name ?? item.menu_item_name ?? item.product_name ?? 'Unbekannt';
}

function getItemMenge(item: OrderItem): number {
  return item.menge ?? item.quantity ?? 1;
}

function getOrderTimestamp(order: Order): number {
  const raw = order.created_at ?? order.createdAt;
  if (!raw) return Date.now();
  return new Date(raw).getTime();
}

export function KitchenPhase1772GerichtWarteschlangenPrioritaet({ orders, className }: Props) {
  const [open, setOpen] = useState(true);

  const warteschlange = useMemo<GerichtWarteschlange[]>(() => {
    const now = Date.now();
    const byName: Record<string, { mengen: number; timestamps: number[] }> = {};

    for (const order of orders) {
      const status = order.status ?? '';
      if (!['accepted', 'preparing', 'in_progress', 'pending'].includes(status)) continue;
      const ts = getOrderTimestamp(order);

      for (const item of getItems(order)) {
        const name = getItemName(item);
        const menge = getItemMenge(item);
        if (!byName[name]) byName[name] = { mengen: 0, timestamps: [] };
        byName[name].mengen += menge;
        byName[name].timestamps.push(ts);
      }
    }

    return Object.entries(byName)
      .map(([name, d]) => {
        const oldest = Math.min(...d.timestamps);
        const aelteste_bestellung_vor_min = Math.round((now - oldest) / 60000);
        const avg_wartezeit_min = Math.round(
          d.timestamps.reduce((s, t) => s + (now - t), 0) / d.timestamps.length / 60000,
        );
        return {
          name,
          anzahl: d.mengen,
          aelteste_bestellung_vor_min,
          avg_wartezeit_min,
          kritisch: aelteste_bestellung_vor_min > ALERT_SCHWELLE_MIN,
        };
      })
      .sort((a, b) => b.aelteste_bestellung_vor_min - a.aelteste_bestellung_vor_min);
  }, [orders]);

  const kritischeGerichte = warteschlange.filter(g => g.kritisch);
  const hasKritisch = kritischeGerichte.length > 0;

  if (warteschlange.length === 0) return null;

  return (
    <div className={cn('rounded-xl border border-border bg-card mb-3', className)}>
      <button
        className="flex w-full items-center justify-between px-4 py-3"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-saffron" />
          <span className="text-sm font-bold">Gericht-Warteschlange</span>
          {hasKritisch && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {kritischeGerichte.length} Kritisch
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {hasKritisch && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <p className="text-xs font-bold text-red-800 dark:text-red-200">
                {kritischeGerichte.length} Gericht{kritischeGerichte.length > 1 ? 'e' : ''} warten länger als {ALERT_SCHWELLE_MIN} Minuten!
              </p>
            </div>
          )}

          <div className="space-y-1.5">
            {warteschlange.map((g, i) => (
              <div
                key={g.name}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 border',
                  g.kritisch
                    ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                    : 'bg-muted/40 border-transparent',
                )}
              >
                <span className={cn(
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-black',
                  g.kritisch ? 'bg-red-500 text-white' : 'bg-saffron/20 text-saffron',
                )}>
                  {i + 1}
                </span>

                <div className="flex-1 min-w-0">
                  <p className={cn('text-xs font-bold truncate', g.kritisch ? 'text-red-800 dark:text-red-200' : 'text-foreground')}>
                    {g.name}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{g.anzahl}× in Warteschlange</span>
                    <span className="text-[10px] text-muted-foreground">·</span>
                    <span className="text-[10px] text-muted-foreground">Ø {g.avg_wartezeit_min} Min Wartezeit</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Clock className={cn('h-3.5 w-3.5', g.kritisch ? 'text-red-500' : 'text-muted-foreground')} />
                  <span className={cn(
                    'text-xs font-black tabular-nums',
                    g.kritisch ? 'text-red-700 dark:text-red-300' : 'text-foreground',
                  )}>
                    {g.aelteste_bestellung_vor_min} Min
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
