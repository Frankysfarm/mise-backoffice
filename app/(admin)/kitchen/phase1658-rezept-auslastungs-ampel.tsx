'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Flame } from 'lucide-react';

/**
 * Phase 1658 — Rezept-Auslastungs-Ampel (Kitchen)
 *
 * Zählt parallele Bestellungen desselben Gerichts in aktiver Zubereitung.
 * Überlast-Warnung wenn >3 gleiche Gerichte gleichzeitig. Props-basiert, useMemo.
 */

interface OrderItem {
  product_name?: string | null;
  name?: string | null;
  quantity?: number | null;
}

interface Order {
  id: string;
  status: string;
  items?: OrderItem[] | null;
}

interface Props {
  orders: Order[];
  ueberlast_schwelle?: number;
}

interface RezeptLast {
  name: string;
  anzahl: number;
  stufe: 'normal' | 'achtung' | 'ueberlast';
}

const AKTIVE_STATUS = new Set(['accepted', 'preparing', 'in_progress', 'in_zubereitung']);

function calcStufe(anzahl: number, schwelle: number): RezeptLast['stufe'] {
  if (anzahl >= schwelle) return 'ueberlast';
  if (anzahl >= schwelle - 1) return 'achtung';
  return 'normal';
}

const STUFE_CFG = {
  normal:    { color: 'text-matcha-700 dark:text-matcha-300',  bg: 'bg-matcha-50 dark:bg-matcha-900/20',   bar: 'bg-matcha-400' },
  achtung:   { color: 'text-amber-700 dark:text-amber-300',    bg: 'bg-amber-50 dark:bg-amber-900/20',     bar: 'bg-amber-400' },
  ueberlast: { color: 'text-red-700 dark:text-red-300',        bg: 'bg-red-50 dark:bg-red-900/20',         bar: 'bg-red-500' },
};

export function KitchenPhase1658RezeptAuslastungsAmpel({ orders, ueberlast_schwelle = 4 }: Props) {
  const [open, setOpen] = useState(true);

  const { rezepte, hatUeberlast } = useMemo(() => {
    const counter: Record<string, number> = {};

    for (const o of orders) {
      if (!AKTIVE_STATUS.has(o.status)) continue;
      for (const item of o.items ?? []) {
        const name = item.product_name ?? item.name ?? 'Unbekannt';
        const qty = item.quantity ?? 1;
        counter[name] = (counter[name] ?? 0) + qty;
      }
    }

    const rezepte: RezeptLast[] = Object.entries(counter)
      .map(([name, anzahl]) => ({ name, anzahl, stufe: calcStufe(anzahl, ueberlast_schwelle) }))
      .sort((a, b) => b.anzahl - a.anzahl)
      .slice(0, 10);

    const hatUeberlast = rezepte.some(r => r.stufe === 'ueberlast');

    return { rezepte, hatUeberlast };
  }, [orders, ueberlast_schwelle]);

  const maxAnzahl = Math.max(1, ...rezepte.map(r => r.anzahl));

  const headerColor = hatUeberlast
    ? 'text-red-700 dark:text-red-300'
    : 'text-foreground';
  const headerBg = hatUeberlast
    ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
    : 'bg-card border-border';

  return (
    <div className={cn('rounded-xl border p-3 mb-3', headerBg)}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 w-full text-left"
      >
        <ChefHat className={cn('h-4 w-4 shrink-0', headerColor)} />
        <span className={cn('text-sm font-semibold flex-1', headerColor)}>
          Rezept-Auslastung
        </span>
        {hatUeberlast && (
          <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 dark:text-red-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Überlast
          </span>
        )}
        {!hatUeberlast && rezepte.length > 0 && (
          <CheckCircle2 className="h-4 w-4 text-matcha-500" />
        )}
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-1.5">
          {rezepte.length === 0 && (
            <p className="text-xs text-muted-foreground">Keine aktiven Bestellungen.</p>
          )}

          {hatUeberlast && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 mb-2">
              <Flame className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-300 font-medium">
                Kapazitätsgrenze erreicht — Priorisierung prüfen!
              </p>
            </div>
          )}

          {rezepte.map(r => {
            const cfg = STUFE_CFG[r.stufe];
            return (
              <div key={r.name} className={cn('rounded-lg px-2.5 py-1.5', cfg.bg)}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className={cn('text-xs font-medium truncate flex-1', cfg.color)}>
                    {r.name}
                  </span>
                  <span className={cn('text-xs font-bold tabular-nums shrink-0', cfg.color)}>
                    ×{r.anzahl}
                    {r.stufe === 'ueberlast' && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                    {r.stufe === 'achtung'   && <span className="ml-1 text-amber-500">!</span>}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', cfg.bar)}
                    style={{ width: `${Math.round((r.anzahl / maxAnzahl) * 100)}%` }}
                  />
                </div>
              </div>
            );
          })}

          <p className="text-[10px] text-muted-foreground pt-1">
            Schwelle: {ueberlast_schwelle}× selbes Gericht = Überlast
          </p>
        </div>
      )}
    </div>
  );
}
