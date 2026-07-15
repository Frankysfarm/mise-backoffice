'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

/**
 * Phase 1683 — Kochzeit-Varianz-Monitor (Kitchen)
 *
 * Varianz der Zubereitungszeiten je Gericht (Min/Max/Ø); Ampel wenn Varianz >40%; useMemo.
 */

interface OrderTiming {
  product_name?: string | null;
  name?: string | null;
  cook_start?: string | null;
  cook_end?: string | null;
  prepared_at?: string | null;
  created_at?: string | null;
}

interface OrderItem {
  product_name?: string | null;
  name?: string | null;
  quantity?: number | null;
}

interface Order {
  id: string;
  status?: string | null;
  created_at?: string | null;
  prepared_at?: string | null;
  cook_start?: string | null;
  cook_end?: string | null;
  items?: OrderItem[] | null;
  timings?: OrderTiming[] | null;
}

interface Props {
  orders: Order[];
}

interface GerichtVarianz {
  name: string;
  min_min: number;
  max_min: number;
  avg_min: number;
  varianz_pct: number;
  anzahl: number;
  stufe: 'ok' | 'warnung' | 'kritisch';
}

const WARN_VARIANZ = 0.30;
const KRITISCH_VARIANZ = 0.50;

function varianzStufe(pct: number): GerichtVarianz['stufe'] {
  if (pct >= KRITISCH_VARIANZ) return 'kritisch';
  if (pct >= WARN_VARIANZ) return 'warnung';
  return 'ok';
}

const STUFE_CFG = {
  ok:       { dot: 'bg-matcha-400', bar: 'bg-matcha-400', text: 'text-matcha-700 dark:text-matcha-300' },
  warnung:  { dot: 'bg-amber-400',  bar: 'bg-amber-400',  text: 'text-amber-700 dark:text-amber-300' },
  kritisch: { dot: 'bg-red-500',    bar: 'bg-red-500',    text: 'text-red-700 dark:text-red-300' },
};

const DONE_STATUS = new Set(['delivered', 'prepared', 'ready', 'geliefert', 'fertig', 'abgeholt']);

function extractCookMinutes(order: Order): number | null {
  // cook_start / cook_end direkt
  if (order.cook_start && order.cook_end) {
    const diff = (new Date(order.cook_end).getTime() - new Date(order.cook_start).getTime()) / 60000;
    if (diff > 0 && diff < 120) return Math.round(diff);
  }
  // created_at → prepared_at
  if (order.created_at && order.prepared_at) {
    const diff = (new Date(order.prepared_at).getTime() - new Date(order.created_at).getTime()) / 60000;
    if (diff > 0 && diff < 120) return Math.round(diff);
  }
  return null;
}

function itemNamesOf(order: Order): string[] {
  return (order.items ?? [])
    .map(i => (i.product_name ?? i.name ?? '').trim())
    .filter(Boolean);
}

export function KitchenPhase1683KochzeitVarianzMonitor({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const { rows, hatKritisch, hatWarnung } = useMemo(() => {
    const doneOrders = orders.filter(o => DONE_STATUS.has(o.status ?? ''));
    const gerichte: Record<string, number[]> = {};

    for (const order of doneOrders) {
      const mins = extractCookMinutes(order);
      if (mins === null) continue;
      const names = itemNamesOf(order);
      for (const name of names.length > 0 ? names : ['Unbekannt']) {
        if (!gerichte[name]) gerichte[name] = [];
        gerichte[name].push(mins);
      }
    }

    const rows: GerichtVarianz[] = Object.entries(gerichte)
      .filter(([, times]) => times.length >= 3)
      .map(([name, times]) => {
        const min_min = Math.min(...times);
        const max_min = Math.max(...times);
        const avg_min = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
        const varianz_pct = avg_min > 0 ? (max_min - min_min) / avg_min : 0;
        return {
          name,
          min_min,
          max_min,
          avg_min,
          varianz_pct: Math.round(varianz_pct * 100) / 100,
          anzahl: times.length,
          stufe: varianzStufe(varianz_pct),
        };
      })
      .sort((a, b) => b.varianz_pct - a.varianz_pct);

    return {
      rows,
      hatKritisch: rows.some(r => r.stufe === 'kritisch'),
      hatWarnung: rows.some(r => r.stufe === 'warnung'),
    };
  }, [orders]);

  const headerColor = hatKritisch
    ? 'text-red-600 dark:text-red-400'
    : hatWarnung
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-matcha-600 dark:text-matcha-400';

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <ChefHat className={cn('h-4 w-4 shrink-0', headerColor)} />
        <span className="text-sm font-semibold flex-1 text-foreground">
          Kochzeit-Varianz-Monitor
        </span>
        {hatKritisch && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {rows.slice(0, 8).map(row => {
            const cfg = STUFE_CFG[row.stufe];
            const barPct = Math.min(100, Math.round(row.varianz_pct * 100 * 1.5));
            return (
              <div key={row.name} className="space-y-0.5">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', cfg.dot)} />
                    <span className="font-medium text-foreground truncate max-w-[120px]">{row.name}</span>
                    <span className="text-muted-foreground text-[9px] shrink-0">×{row.anzahl}</span>
                  </div>
                  <div className="flex items-center gap-1 tabular-nums shrink-0 ml-2">
                    <span className="text-muted-foreground">{row.min_min}–{row.max_min} Min</span>
                    <span className="text-foreground font-medium">Ø{row.avg_min}</span>
                    <span className={cn('font-bold', cfg.text)}>
                      ±{Math.round(row.varianz_pct * 100)}%
                    </span>
                  </div>
                </div>
                <div className="h-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', cfg.bar)}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>
            );
          })}
          <p className="text-[9px] text-muted-foreground pt-1">
            Varianz = (Max−Min)/Ø · Warnung ab 30% · Kritisch ab 50% · min. 3 Aufträge
          </p>
        </div>
      )}
    </div>
  );
}
