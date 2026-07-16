'use client';

import { useMemo, useState } from 'react';
import { ShoppingBasket, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderItem {
  name?: string;
  quantity?: number;
}

interface Order {
  id: string;
  created_at?: string;
  items?: OrderItem[];
}

interface ArtikelCount {
  name: string;
  anzahl: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

const ALERT_HIGH = 10;
const ALERT_MED = 5;

function ampelOf(n: number): 'gruen' | 'gelb' | 'rot' {
  if (n >= ALERT_HIGH) return 'rot';
  if (n >= ALERT_MED) return 'gelb';
  return 'gruen';
}

const AMPEL: Record<string, { dot: string; text: string; bar: string }> = {
  gruen: { dot: 'bg-green-500', text: 'text-green-700 dark:text-green-400', bar: 'bg-green-500' },
  gelb:  { dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', bar: 'bg-amber-500' },
  rot:   { dot: 'bg-red-500',   text: 'text-red-600 dark:text-red-400',     bar: 'bg-red-500'   },
};

export function KitchenPhase2011ZutatenVorbereitungsPrognose({
  orders,
}: {
  orders: Order[];
}) {
  const [offen, setOffen] = useState(true);

  const top5 = useMemo((): ArtikelCount[] => {
    const jetzt = Date.now();
    const eineStundeVorhin = jetzt - 60 * 60 * 1000;

    const zaehler = new Map<string, number>();

    for (const order of orders) {
      const ts = order.created_at ? new Date(order.created_at).getTime() : jetzt;
      if (ts < eineStundeVorhin) continue;

      for (const item of order.items ?? []) {
        if (!item.name) continue;
        const menge = item.quantity ?? 1;
        zaehler.set(item.name, (zaehler.get(item.name) ?? 0) + menge);
      }
    }

    return Array.from(zaehler.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, anzahl]) => ({ name, anzahl, ampel: ampelOf(anzahl) }));
  }, [orders]);

  if (!top5.length) return null;

  const maxAnzahl = Math.max(...top5.map((a) => a.anzahl), 1);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden">
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <ShoppingBasket className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Zutaten-Prognose (nächste Stunde)</span>
          <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-mono">
            Top {top5.length}
          </span>
        </div>
        {offen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {offen && (
        <div className="border-t border-slate-100 dark:border-slate-700 px-4 py-3 space-y-2.5">
          {top5.map((artikel) => {
            const c = AMPEL[artikel.ampel];
            const pct = Math.round((artikel.anzahl / maxAnzahl) * 100);
            return (
              <div key={artikel.name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={cn('w-2 h-2 rounded-full shrink-0', c.dot)} />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate">{artikel.name}</span>
                  </div>
                  <span className={cn('text-xs font-bold tabular-nums shrink-0 ml-2', c.text)}>
                    ×{artikel.anzahl}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', c.bar)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          <p className="text-[9px] text-slate-400 text-right pt-1">Basiert auf Bestellungen der letzten 60 Min</p>
        </div>
      )}
    </div>
  );
}
