'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Package, ChevronDown, ChevronUp, AlertTriangle, TrendingUp } from 'lucide-react';

/**
 * Phase 1668 — Zutaten-Verbrauchsrate-Widget (Kitchen)
 *
 * Verbrauch je Zutat (Produkt) heute vs. Gestern + Ampel wenn >130%.
 * Props-basiert, useMemo. Wenn gesternOrders fehlt, wird ein 80%-Schätzer verwendet.
 */

interface OrderItem {
  product_name?: string | null;
  name?: string | null;
  quantity?: number | null;
}

interface Order {
  id: string;
  status?: string | null;
  items?: OrderItem[] | null;
}

interface Props {
  orders: Order[];
  gesternOrders?: Order[];
}

interface ZutatRow {
  name: string;
  heute: number;
  gestern: number;
  rate: number;
  stufe: 'normal' | 'achtung' | 'kritisch';
}

const WARNSCHWELLE = 1.3;
const ACHTSCHWELLE = 1.15;

function countZutaten(orders: Order[]): Record<string, number> {
  const counter: Record<string, number> = {};
  for (const o of orders) {
    for (const item of o.items ?? []) {
      const n = (item.product_name ?? item.name ?? '').trim();
      if (!n) continue;
      const qty = item.quantity ?? 1;
      counter[n] = (counter[n] ?? 0) + qty;
    }
  }
  return counter;
}

function stufeOf(rate: number): ZutatRow['stufe'] {
  if (rate >= WARNSCHWELLE) return 'kritisch';
  if (rate >= ACHTSCHWELLE) return 'achtung';
  return 'normal';
}

const STUFE_CFG = {
  normal:   { dot: 'bg-matcha-400',  bar: 'bg-matcha-400',  label: 'text-matcha-700 dark:text-matcha-300' },
  achtung:  { dot: 'bg-amber-400',   bar: 'bg-amber-400',   label: 'text-amber-700 dark:text-amber-300' },
  kritisch: { dot: 'bg-red-500',     bar: 'bg-red-500',     label: 'text-red-700 dark:text-red-300' },
};

export function KitchenPhase1668ZutatenVerbrauchsrateWidget({ orders, gesternOrders }: Props) {
  const [open, setOpen] = useState(true);

  const { rows, hatKritisch, hatAchtung } = useMemo(() => {
    const heute = countZutaten(orders);

    let gestern: Record<string, number>;
    if (gesternOrders && gesternOrders.length > 0) {
      gestern = countZutaten(gesternOrders);
    } else {
      gestern = Object.fromEntries(
        Object.entries(heute).map(([k, v]) => [k, Math.max(1, Math.round(v * 0.8))])
      );
    }

    const allNames = [...new Set([...Object.keys(heute), ...Object.keys(gestern)])];

    const rows: ZutatRow[] = allNames
      .map(name => {
        const h = heute[name] ?? 0;
        const g = gestern[name] ?? 0;
        const rate = g > 0 ? h / g : (h > 0 ? 2 : 1);
        return { name, heute: h, gestern: g, rate: Math.round(rate * 100) / 100, stufe: stufeOf(rate) };
      })
      .sort((a, b) => b.rate - a.rate);

    const hatKritisch = rows.some(r => r.stufe === 'kritisch');
    const hatAchtung = rows.some(r => r.stufe === 'achtung');

    return { rows, hatKritisch, hatAchtung };
  }, [orders, gesternOrders]);

  const headerColor = hatKritisch
    ? 'text-red-600 dark:text-red-400'
    : hatAchtung
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-matcha-600 dark:text-matcha-400';

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-3 mb-3">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <Package className={cn('h-4 w-4 shrink-0', headerColor)} />
        <span className="text-sm font-semibold flex-1 text-foreground">
          Zutaten-Verbrauchsrate
        </span>
        {hatKritisch && (
          <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {rows.slice(0, 8).map(row => {
            const cfg = STUFE_CFG[row.stufe];
            const barPct = Math.min(100, Math.round(row.rate * 50));
            return (
              <div key={row.name} className="space-y-0.5">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', cfg.dot)} />
                    <span className="font-medium text-foreground truncate max-w-[130px]">{row.name}</span>
                  </div>
                  <div className="flex items-center gap-1 tabular-nums shrink-0 ml-2">
                    {row.stufe !== 'normal' && (
                      <TrendingUp className={cn('h-3 w-3', cfg.label)} />
                    )}
                    <span className={cn('font-bold', cfg.label)}>
                      {row.heute}x
                    </span>
                    <span className="text-muted-foreground text-[9px]">/{row.gestern}x</span>
                    <span className={cn('text-[9px] font-semibold', cfg.label)}>
                      ({row.rate >= 1 ? '+' : ''}{Math.round((row.rate - 1) * 100)}%)
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
            Heute vs. Gestern · Ampel bei &gt;115%/130% · Berechnet aus aktiven Bestellungen
          </p>
        </div>
      )}
    </div>
  );
}
