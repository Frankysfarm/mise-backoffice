'use client';

// Phase 1252 — Tisch-Zubereitungs-Cockpit (Kitchen)
// Zeigt welche Artikel gerade parallel zubereitet werden (Top 5 nach Menge)
// und wie viele Stationen belegt sind.

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, ChefHat, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  status?: string;
  items?: Array<{ name?: string; quantity?: number; category?: string }>;
  created_at?: string | null;
}

interface Props {
  orders: Order[];
  maxStationen?: number;
}

const AKTIVE_STATUSES = new Set(['confirmed', 'preparing', 'bestätigt', 'in_zubereitung']);

export function KitchenPhase1252TischZubereitungsCockpit({ orders, maxStationen = 5 }: Props) {
  const [open, setOpen] = useState(true);

  const { parallelArtikel, belegteStationen, gesamtArtikelAnzahl } = useMemo(() => {
    const aktiveOrders = orders.filter((o) => AKTIVE_STATUSES.has(o.status ?? ''));

    // Artikel-Map: name → { quantity, category }
    const artikelMap = new Map<string, { menge: number; category: string }>();
    const kategorien = new Set<string>();

    for (const order of aktiveOrders) {
      for (const item of order.items ?? []) {
        const name = (item.name ?? '').trim();
        if (!name) continue;
        const qty = item.quantity ?? 1;
        const cat = (item.category ?? 'Sonstige').trim();
        kategorien.add(cat);

        const existing = artikelMap.get(name);
        if (existing) {
          existing.menge += qty;
        } else {
          artikelMap.set(name, { menge: qty, category: cat });
        }
      }
    }

    // Top 5 nach Menge
    const alle = [...artikelMap.entries()].map(([name, { menge, category }]) => ({
      name,
      menge,
      category,
    }));
    alle.sort((a, b) => b.menge - a.menge);
    const parallelArtikel = alle.slice(0, 5);

    const gesamtArtikelAnzahl = alle.reduce((s, a) => s + a.menge, 0);
    const belegteStationen = Math.min(kategorien.size, maxStationen);

    return { parallelArtikel, belegteStationen, gesamtArtikelAnzahl };
  }, [orders, maxStationen]);

  const hatAktiveOrders = parallelArtikel.length > 0;

  return (
    <div className="rounded-xl border shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-3 text-left',
          'bg-gradient-to-r from-amber-500 to-orange-500',
        )}
      >
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-white shrink-0" />
          <span className="font-bold text-sm text-white tracking-wide">Tisch-Cockpit</span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-black',
              belegteStationen >= maxStationen
                ? 'bg-red-600 text-white'
                : 'bg-white/20 text-white',
            )}
          >
            {belegteStationen}/{maxStationen} Stationen
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-white shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-white shrink-0" />
        )}
      </button>

      {/* Body */}
      {open && (
        <div className="bg-white dark:bg-background p-4 space-y-4">
          {hatAktiveOrders ? (
            <>
              {/* Artikel-Grid */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {parallelArtikel.map((artikel) => (
                  <div
                    key={artikel.name}
                    className={cn(
                      'rounded-lg border-2 border-amber-300 bg-amber-50 dark:bg-amber-950/30',
                      'px-3 py-2.5 flex flex-col gap-1',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-bold text-amber-900 dark:text-amber-100 leading-tight">
                        {artikel.name}
                      </span>
                      <span className="shrink-0 rounded-full bg-amber-500 text-white text-xs font-black px-2 py-0.5 tabular-nums">
                        ×{artikel.menge}
                      </span>
                    </div>
                    <span className="text-[10px] rounded-full border border-amber-300 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-semibold px-2 py-0.5 self-start">
                      {artikel.category}
                    </span>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-2 border-t pt-3">
                <Layers className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                <span className="text-xs text-muted-foreground font-medium">
                  <span className="font-bold text-orange-600 dark:text-orange-400">
                    {gesamtArtikelAnzahl}
                  </span>{' '}
                  Artikel werden gerade gleichzeitig zubereitet
                </span>
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <ChefHat className="h-8 w-8 text-amber-300 dark:text-amber-700" />
              <p className="text-sm text-muted-foreground font-medium">
                Keine aktiven Bestellungen in Zubereitung
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
