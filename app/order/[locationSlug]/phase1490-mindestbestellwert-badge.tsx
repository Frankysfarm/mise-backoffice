'use client';

import { cn } from '@/lib/utils';
import { ShoppingBag } from 'lucide-react';

// Phase 1490 — Mindestbestellwert-Fortschritts-Badge (Storefront)
// Kompaktes Badge wenn Warenkorb < MOV; Betrag-bis-kostenloser-Lieferung-Anzeige.
// Echtzeit-Update bei Änderungen. Hydration-safe (no Date/random).
// Nach Phase1485.

interface Props {
  subtotal: number;
  minOrder: number;
  deliveryFee?: number;
}

export function StorefrontPhase1490MindestbestellwertBadge({ subtotal, minOrder, deliveryFee = 0 }: Props) {
  if (subtotal <= 0 || subtotal >= minOrder) return null;

  const fehlend = Math.max(0, minOrder - subtotal);
  const prozent = Math.min(100, Math.round((subtotal / minOrder) * 100));

  const dringend = fehlend <= 2;

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border px-3 py-2 text-[11px] transition-all',
        dringend
          ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
          : 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-700',
      )}
    >
      <ShoppingBag className={cn('h-4 w-4 shrink-0', dringend ? 'text-amber-500' : 'text-sky-500')} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className={cn('font-semibold', dringend ? 'text-amber-700 dark:text-amber-300' : 'text-sky-700 dark:text-sky-300')}>
            Noch <strong>{fehlend.toFixed(2).replace('.', ',')} €</strong> bis Mindestbestellwert
          </span>
          <span className="text-muted-foreground text-[10px] tabular-nums shrink-0 ml-2">
            {subtotal.toFixed(2).replace('.', ',')} / {minOrder.toFixed(2).replace('.', ',')} €
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', dringend ? 'bg-amber-400' : 'bg-sky-400')}
            style={{ width: `${prozent}%` }}
          />
        </div>
      </div>

      {deliveryFee > 0 && (
        <div className="text-[9px] text-muted-foreground shrink-0 text-right leading-tight">
          <div>Liefer-</div>
          <div className="font-bold text-foreground">{deliveryFee.toFixed(2).replace('.', ',')} €</div>
        </div>
      )}
    </div>
  );
}
