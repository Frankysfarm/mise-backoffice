'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Star, Gift } from 'lucide-react';

/**
 * Phase 945 — Treuepunkte-Vorschau (Storefront)
 *
 * Zeigt wie viele Punkte der Kunde mit dieser Bestellung sammeln würde.
 * Nur sichtbar wenn cart.length > 0.
 * Client-seitig berechnet: 1 Punkt je vollem Euro.
 */

const PUNKTE_PRO_EURO = 1;
const MINDEST_ANZEIGE_PUNKTE = 3;

interface CartItem {
  item: { preis: number; name: string };
  qty: number;
  extra_preis?: number;
}

interface Props {
  cart: CartItem[];
  locationId: string | null;
}

export function Phase945TreuepunkteVorschau({ cart, locationId }: Props) {
  const { punkte, gesamtBetrag } = useMemo(() => {
    const gesamt = cart.reduce((s, c) => s + c.qty * (c.item.preis + (c.extra_preis ?? 0)), 0);
    return {
      gesamtBetrag: gesamt,
      punkte: Math.floor(gesamt * PUNKTE_PRO_EURO),
    };
  }, [cart]);

  if (!locationId || cart.length === 0 || punkte < MINDEST_ANZEIGE_PUNKTE) return null;

  const isViel = punkte >= 20;

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border px-4 py-3',
      isViel
        ? 'border-amber-200 bg-amber-50 dark:bg-amber-950/20'
        : 'border-matcha-200 bg-matcha-50 dark:bg-matcha-950/20',
    )}>
      <div className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
        isViel ? 'bg-amber-100 dark:bg-amber-900/40' : 'bg-matcha-100 dark:bg-matcha-900/40',
      )}>
        {isViel
          ? <Gift className="h-4 w-4 text-amber-500" />
          : <Star className="h-4 w-4 text-matcha-500" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-xs font-bold',
          isViel ? 'text-amber-700 dark:text-amber-300' : 'text-matcha-700 dark:text-matcha-300',
        )}>
          +<span className="text-base font-black tabular-nums">{punkte}</span>{' '}
          Treuepunkt{punkte !== 1 ? 'e' : ''} mit dieser Bestellung
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {PUNKTE_PRO_EURO} Punkt je Euro · {gesamtBetrag.toFixed(2).replace('.', ',')} € Bestellwert
          {isViel && <span className="ml-1 text-amber-600 dark:text-amber-400 font-semibold">· Super Ausbeute! 🎉</span>}
        </p>
      </div>

      <div className={cn(
        'shrink-0 rounded-lg px-2.5 py-1.5 text-center',
        isViel ? 'bg-amber-200 dark:bg-amber-800/60' : 'bg-matcha-200 dark:bg-matcha-800/60',
      )}>
        <span className={cn(
          'block text-lg font-black tabular-nums leading-none',
          isViel ? 'text-amber-700 dark:text-amber-300' : 'text-matcha-700 dark:text-matcha-300',
        )}>
          {punkte}
        </span>
        <span className={cn(
          'text-[9px] font-medium uppercase tracking-wide',
          isViel ? 'text-amber-600 dark:text-amber-400' : 'text-matcha-600 dark:text-matcha-400',
        )}>
          Punkte
        </span>
      </div>
    </div>
  );
}
