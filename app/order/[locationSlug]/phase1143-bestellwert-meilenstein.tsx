'use client';

import { useMemo } from 'react';
import { ShoppingBag, Truck } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1143 — Bestellwert-Meilenstein-Banner (Storefront)
// "Nur noch X€ bis kostenlose Lieferung"-Fortschrittsbalken im Warenkorb

interface Props {
  subtotal: number;
  minOrder: number;
  deliveryFee?: number;
  freeLieferungSchwelle?: number;
}

export function Phase1143BestellwertMeilenstein({
  subtotal,
  minOrder,
  deliveryFee = 2.5,
  freeLieferungSchwelle,
}: Props) {
  const schwelle = freeLieferungSchwelle ?? minOrder * 2;

  const { pct, fehlend, erreicht, stufe, label } = useMemo(() => {
    if (subtotal <= 0) {
      return {
        pct: 0,
        fehlend: schwelle,
        erreicht: false,
        stufe: 'leer' as const,
        label: `Noch ${schwelle.toFixed(2).replace('.', ',')} € bis kostenlose Lieferung`,
      };
    }

    const erreicht = subtotal >= schwelle;
    const pct = Math.min(100, (subtotal / schwelle) * 100);
    const fehlend = Math.max(0, schwelle - subtotal);

    let stufe: 'leer' | 'start' | 'halb' | 'nah' | 'erreicht';
    if (erreicht) stufe = 'erreicht';
    else if (pct >= 75) stufe = 'nah';
    else if (pct >= 40) stufe = 'halb';
    else stufe = 'start';

    const label = erreicht
      ? 'Kostenlose Lieferung!'
      : `Noch ${fehlend.toFixed(2).replace('.', ',')} € bis kostenlose Lieferung`;

    return { pct, fehlend, erreicht, stufe, label };
  }, [subtotal, schwelle]);

  // Don't show when cart is empty or fee is 0 (pickup)
  if (subtotal <= 0 || deliveryFee <= 0) return null;

  const barColor: Record<typeof stufe, string> = {
    leer:     'bg-slate-300 dark:bg-slate-600',
    start:    'bg-blue-400 dark:bg-blue-500',
    halb:     'bg-violet-500 dark:bg-violet-400',
    nah:      'bg-amber-400 dark:bg-amber-400',
    erreicht: 'bg-emerald-500 dark:bg-emerald-400',
  };

  const borderColor: Record<typeof stufe, string> = {
    leer:     'border-slate-200 dark:border-slate-700',
    start:    'border-blue-200 dark:border-blue-800',
    halb:     'border-violet-200 dark:border-violet-800',
    nah:      'border-amber-200 dark:border-amber-800',
    erreicht: 'border-emerald-200 dark:border-emerald-800',
  };

  const labelColor: Record<typeof stufe, string> = {
    leer:     'text-muted-foreground',
    start:    'text-blue-700 dark:text-blue-300',
    halb:     'text-violet-700 dark:text-violet-300',
    nah:      'text-amber-700 dark:text-amber-300',
    erreicht: 'text-emerald-700 dark:text-emerald-300',
  };

  return (
    <div className={cn('rounded-xl border px-3 py-2.5', borderColor[stufe])}>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          {erreicht
            ? <Truck className={cn('h-3.5 w-3.5', labelColor[stufe])} />
            : <ShoppingBag className={cn('h-3.5 w-3.5', labelColor[stufe])} />}
          <span className={cn('text-[11px] font-bold', labelColor[stufe])}>{label}</span>
        </div>
        {!erreicht && (
          <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
            {subtotal.toFixed(2).replace('.', ',')} / {schwelle.toFixed(2).replace('.', ',')} €
          </span>
        )}
      </div>
      <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', barColor[stufe])}
          style={{ width: `${pct}%` }}
        />
      </div>
      {erreicht && (
        <p className="mt-1 text-[10px] text-emerald-600 dark:text-emerald-400">
          Liefergebühr ({deliveryFee.toFixed(2).replace('.', ',')} €) entfällt für diese Bestellung.
        </p>
      )}
    </div>
  );
}
