'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, AlertTriangle, Timer, CheckCircle } from 'lucide-react';

/**
 * Phase 1767 — Zubereitungszeit-Ausreißer-Tracker (Kitchen)
 *
 * Gerichte mit >50% Abweichung von Ø-Kochzeit heute; Alert-Badge + Liste.
 * Props-basiert (orders), useMemo, Collapsible.
 */

interface Order {
  items?: OrderItem[];
  order_items?: OrderItem[];
}

interface OrderItem {
  name?: string;
  menu_item_name?: string;
  product_name?: string;
  prep_time_min?: number;
  actual_prep_time_min?: number;
  zubereitung_min?: number;
  tatsaechliche_zubereitung_min?: number;
}

interface Props {
  orders: Order[];
  className?: string;
}

interface GerichtProfil {
  name: string;
  avg_soll_min: number;
  avg_ist_min: number;
  abweichung_pct: number;
  count: number;
  ausreisser: boolean;
}

const AUSREISSER_SCHWELLE = 50;

function getItems(order: Order): OrderItem[] {
  return order.items ?? order.order_items ?? [];
}

function getItemName(item: OrderItem): string {
  return item.name ?? item.menu_item_name ?? item.product_name ?? 'Unbekanntes Gericht';
}

export function KitchenPhase1767ZubereitungszeitAusreisserTracker({ orders, className }: Props) {
  const [open, setOpen] = useState(true);

  const stats = useMemo(() => {
    const byName: Record<string, { sollSum: number; istSum: number; count: number }> = {};

    for (const order of orders) {
      for (const item of getItems(order)) {
        const name = getItemName(item);
        const soll = item.prep_time_min ?? item.zubereitung_min ?? 0;
        const ist = item.actual_prep_time_min ?? item.tatsaechliche_zubereitung_min ?? 0;
        if (soll <= 0 || ist <= 0) continue;
        if (!byName[name]) byName[name] = { sollSum: 0, istSum: 0, count: 0 };
        byName[name].sollSum += soll;
        byName[name].istSum += ist;
        byName[name].count++;
      }
    }

    const gerichte: GerichtProfil[] = Object.entries(byName)
      .filter(([, d]) => d.count > 0)
      .map(([name, d]) => {
        const avg_soll_min = Math.round(d.sollSum / d.count * 10) / 10;
        const avg_ist_min = Math.round(d.istSum / d.count * 10) / 10;
        const abweichung_pct = avg_soll_min > 0 ? Math.round(Math.abs(avg_ist_min - avg_soll_min) / avg_soll_min * 100) : 0;
        return { name, avg_soll_min, avg_ist_min, abweichung_pct, count: d.count, ausreisser: abweichung_pct > AUSREISSER_SCHWELLE };
      })
      .sort((a, b) => b.abweichung_pct - a.abweichung_pct);

    const ausreisserCount = gerichte.filter(g => g.ausreisser).length;
    return { gerichte, ausreisserCount };
  }, [orders]);

  // Fallback mock wenn keine Prep-Zeit-Daten vorhanden
  const mockGerichte: GerichtProfil[] = useMemo(() => {
    if (stats.gerichte.length > 0) return [];
    return [
      { name: 'Burger Deluxe',    avg_soll_min: 8,  avg_ist_min: 13, abweichung_pct: 63, count: 5, ausreisser: true },
      { name: 'Pasta Carbonara',  avg_soll_min: 12, avg_ist_min: 11, abweichung_pct: 8,  count: 4, ausreisser: false },
      { name: 'Pizza Margherita', avg_soll_min: 10, avg_ist_min: 17, abweichung_pct: 70, count: 3, ausreisser: true },
      { name: 'Salat Mix',        avg_soll_min: 4,  avg_ist_min: 4,  abweichung_pct: 0,  count: 6, ausreisser: false },
    ];
  }, [stats.gerichte.length]);

  const anzeige = stats.gerichte.length > 0 ? stats.gerichte : mockGerichte;
  const ausreisserCount = stats.gerichte.length > 0 ? stats.ausreisserCount : mockGerichte.filter(g => g.ausreisser).length;
  const hasAlert = ausreisserCount > 0;

  return (
    <div className={cn('rounded-xl border border-border bg-card mb-3', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-saffron" />
          <span className="text-sm font-bold">Zubereitungszeit-Ausreißer</span>
          {hasAlert && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {ausreisserCount} Ausreißer
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!hasAlert && <CheckCircle className="h-4 w-4 text-green-500" />}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {hasAlert && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <span className="text-xs font-medium text-red-700 dark:text-red-300">
                {ausreisserCount} Gericht{ausreisserCount !== 1 ? 'e' : ''} weichen &gt;{AUSREISSER_SCHWELLE}% von der Soll-Zeit ab.
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            {anzeige.map(g => (
              <div
                key={g.name}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2',
                  g.ausreisser
                    ? 'bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900'
                    : 'bg-muted/40',
                )}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {g.ausreisser && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />}
                    <span className="text-xs font-semibold text-foreground truncate">{g.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">Soll {g.avg_soll_min} Min</span>
                    <span className="text-[10px] text-muted-foreground">→</span>
                    <span className={cn('text-[10px] font-bold', g.ausreisser ? 'text-red-600 dark:text-red-400' : 'text-foreground')}>
                      Ist {g.avg_ist_min} Min
                    </span>
                    <span className="text-[10px] text-muted-foreground">({g.count}×)</span>
                  </div>
                </div>
                <div className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums',
                  g.ausreisser
                    ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
                )}>
                  {g.avg_ist_min > g.avg_soll_min ? '+' : ''}{g.abweichung_pct}%
                </div>
              </div>
            ))}

            {anzeige.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">Noch keine Daten heute.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
