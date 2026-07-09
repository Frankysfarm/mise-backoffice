'use client';

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ShoppingBag, Clock, Truck, ChevronRight } from 'lucide-react';

/**
 * Phase 940 — Bestellzusammenfassung-Widget (Storefront)
 *
 * Kompakte Inline-Zusammenfassung: Artikel + Gesamtpreis + ETA
 * vor Bestellabschluss. Nur sichtbar wenn Warenkorb befüllt.
 */

interface CartEntry {
  item: { name: string; preis: number };
  qty: number;
  extra_preis?: number;
}

interface Props {
  cart: CartEntry[];
  locationId: string | null;
  etaMin?: number | null;
  isDelivery?: boolean;
}

const DELIVERY_FEE = 2.90;
const MAX_ITEMS_SHOWN = 4;

export function Phase940BestellzusammenfassungWidget({ cart, etaMin, isDelivery = false }: Props) {
  const summary = useMemo(() => {
    const subtotal = cart.reduce(
      (s, c) => s + c.qty * (c.item.preis + (c.extra_preis ?? 0)),
      0,
    );
    const deliveryFee = isDelivery ? DELIVERY_FEE : 0;
    const total = subtotal + deliveryFee;
    const totalItems = cart.reduce((s, c) => s + c.qty, 0);

    return { subtotal, deliveryFee, total, totalItems };
  }, [cart, isDelivery]);

  if (cart.length === 0) return null;

  const shownItems = cart.slice(0, MAX_ITEMS_SHOWN);
  const hiddenCount = cart.length - MAX_ITEMS_SHOWN;

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-subtle overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-stone-100 bg-gradient-to-r from-matcha-50 to-white">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-matcha-600" />
          <span className="text-sm font-bold text-stone-800">Bestellübersicht</span>
          <span className="text-xs text-stone-400">
            · {summary.totalItems} Artikel
          </span>
        </div>
        {etaMin && (
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <Clock className="w-3 h-3 text-blue-500" />
            <span className="font-semibold">~{etaMin} Min</span>
            {isDelivery && <span className="text-stone-400">Lieferzeit</span>}
          </div>
        )}
      </div>

      {/* Items */}
      <div className="px-4 py-2 space-y-1.5">
        {shownItems.map((entry, idx) => {
          const linePrice = entry.qty * (entry.item.preis + (entry.extra_preis ?? 0));
          return (
            <div key={idx} className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-matcha-100 flex items-center justify-center text-[10px] font-black text-matcha-700 shrink-0">
                {entry.qty}
              </div>
              <span className="flex-1 text-xs text-stone-700 truncate">{entry.item.name}</span>
              {entry.extra_preis && entry.extra_preis > 0 && (
                <span className="text-[10px] text-stone-400 shrink-0">+Extras</span>
              )}
              <span className="text-xs font-semibold text-stone-700 tabular-nums shrink-0">
                {linePrice.toFixed(2)} €
              </span>
            </div>
          );
        })}

        {hiddenCount > 0 && (
          <div className="flex items-center gap-1 text-xs text-stone-400">
            <ChevronRight className="w-3 h-3" />
            <span>+ {hiddenCount} weitere Artikel</span>
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="px-4 pb-3 pt-1 space-y-1">
        <div className="h-px bg-stone-100" />

        {isDelivery && (
          <div className="flex items-center justify-between text-xs text-stone-500 pt-1">
            <div className="flex items-center gap-1.5">
              <Truck className="w-3 h-3" />
              <span>Liefergebühr</span>
            </div>
            <span>{summary.deliveryFee.toFixed(2)} €</span>
          </div>
        )}

        <div className="flex items-center justify-between pt-0.5">
          <span className="text-sm font-bold text-stone-800">Gesamt</span>
          <div className="text-right">
            <span className="text-lg font-black text-matcha-700 tabular-nums">
              {summary.total.toFixed(2)} €
            </span>
          </div>
        </div>
      </div>

      {/* ETA footer */}
      {(etaMin || isDelivery) && (
        <div className={cn(
          'px-4 py-2 border-t border-stone-100 flex items-center gap-2 text-xs',
          isDelivery ? 'bg-blue-50' : 'bg-stone-50',
        )}>
          {isDelivery ? (
            <>
              <Truck className="w-3 h-3 text-blue-500 shrink-0" />
              <span className="text-stone-600">
                {etaMin
                  ? `Lieferung in ca. ${etaMin} Min direkt zu dir`
                  : 'Lieferung zu deiner Adresse'}
              </span>
            </>
          ) : (
            <>
              <Clock className="w-3 h-3 text-matcha-500 shrink-0" />
              <span className="text-stone-600">
                {etaMin ? `Abholbereit in ca. ${etaMin} Min` : 'Abholung im Restaurant'}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
