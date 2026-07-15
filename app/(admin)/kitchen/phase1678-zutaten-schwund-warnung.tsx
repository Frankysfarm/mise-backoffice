'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trash2, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

/**
 * Phase 1678 — Zutaten-Schwund-Warnung (Kitchen)
 *
 * Artikel mit hohem Schwund (Storno-Rate >10%) als Warnliste + Ampel.
 * Props-basiert, useMemo. Berechnet Schwund aus stornierten Bestellungen.
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
}

interface SchwundRow {
  name: string;
  gesamt: number;
  storniert: number;
  rate: number;
  stufe: 'ok' | 'warnung' | 'kritisch';
}

const KRITISCH_SCHWELLE = 0.20;
const WARN_SCHWELLE = 0.10;

const STORNO_STATUS = new Set(['cancelled', 'storniert', 'refunded', 'rejected']);

function stufeOf(rate: number): SchwundRow['stufe'] {
  if (rate >= KRITISCH_SCHWELLE) return 'kritisch';
  if (rate >= WARN_SCHWELLE) return 'warnung';
  return 'ok';
}

const STUFE_CFG = {
  ok:       { dot: 'bg-matcha-400',  bar: 'bg-matcha-400',  text: 'text-matcha-700 dark:text-matcha-300' },
  warnung:  { dot: 'bg-amber-400',   bar: 'bg-amber-400',   text: 'text-amber-700 dark:text-amber-300' },
  kritisch: { dot: 'bg-red-500',     bar: 'bg-red-500',     text: 'text-red-700 dark:text-red-300' },
};

function countItems(orders: Order[]): Record<string, number> {
  const c: Record<string, number> = {};
  for (const o of orders) {
    for (const item of o.items ?? []) {
      const n = (item.product_name ?? item.name ?? '').trim();
      if (!n) continue;
      c[n] = (c[n] ?? 0) + (item.quantity ?? 1);
    }
  }
  return c;
}

export function KitchenPhase1678ZutatenSchwundWarnung({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const { rows, hatKritisch, hatWarnung } = useMemo(() => {
    const gesamt = countItems(orders);
    const storno = countItems(orders.filter(o => STORNO_STATUS.has(o.status ?? '')));

    const rows: SchwundRow[] = Object.keys(gesamt)
      .map(name => {
        const g = gesamt[name];
        const s = storno[name] ?? 0;
        const rate = g > 0 ? s / g : 0;
        return { name, gesamt: g, storniert: s, rate: Math.round(rate * 1000) / 1000, stufe: stufeOf(rate) };
      })
      .filter(r => r.storniert > 0)
      .sort((a, b) => b.rate - a.rate);

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
        <Trash2 className={cn('h-4 w-4 shrink-0', headerColor)} />
        <span className="text-sm font-semibold flex-1 text-foreground">
          Zutaten-Schwund-Warnung
        </span>
        {hatKritisch && <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0" />}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {rows.slice(0, 8).map(row => {
            const cfg = STUFE_CFG[row.stufe];
            const barPct = Math.min(100, Math.round(row.rate * 100 * 3));
            return (
              <div key={row.name} className="space-y-0.5">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', cfg.dot)} />
                    <span className="font-medium text-foreground truncate max-w-[130px]">{row.name}</span>
                  </div>
                  <div className="flex items-center gap-1 tabular-nums shrink-0 ml-2">
                    <span className={cn('font-bold', cfg.text)}>
                      {Math.round(row.rate * 100)}%
                    </span>
                    <span className="text-muted-foreground text-[9px]">
                      ({row.storniert}/{row.gesamt})
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
            Schwund = Storno-Anteil · Warnung ab 10% · Kritisch ab 20%
          </p>
        </div>
      )}
    </div>
  );
}
