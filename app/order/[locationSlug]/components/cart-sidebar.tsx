'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { ItemImage } from './item-image';
import type { CartItem, Category, OrderType } from './types';
import { DELIVERY_FEE, MIN_ORDER } from './types';
import { LiveWaitBadge } from './live-wait-badge';

type Props = {
  cart: CartItem[];
  orderType: OrderType;
  totalItems: number;
  subtotal: number;
  total: number;
  getCategory: (categoryId: string | null) => Category | undefined;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  onDelete: (id: string) => void;
  onCheckout: () => void;
  onBrowse: () => void;
  /** For the mobile bottom-sheet variant. */
  onClose?: () => void;
  variant: 'desktop' | 'sheet';
  /** Filial-ID für Live-ETA-Anzeige im Warenkorb (nur bei Lieferung) */
  locationId?: string;
};

function formatEuro(n: number): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function CartSidebar({
  cart,
  orderType,
  totalItems,
  subtotal,
  total,
  getCategory,
  onAdd,
  onRemove,
  onDelete,
  onCheckout,
  onBrowse,
  onClose,
  variant,
  locationId,
}: Props) {
  const minReached = subtotal >= MIN_ORDER || orderType === 'abholung';
  const missing = Math.max(0, MIN_ORDER - subtotal);

  const content = (
    <>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-black/5 px-5 py-4">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-matcha-600">Dein Warenkorb</div>
          <div className="font-display text-lg font-bold text-matcha-900">
            {totalItems === 0
              ? 'Noch leer'
              : `${totalItems} ${totalItems === 1 ? 'Artikel' : 'Artikel'}`}
          </div>
        </div>
        {variant === 'sheet' && onClose && (
          <button
            type="button"
            aria-label="Schließen"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-matcha-900/60 transition hover:bg-black/5"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Items */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-matcha-50 text-4xl">
              🛒
            </div>
            <p className="font-display text-lg font-bold text-matcha-900">Noch leer</p>
            <p className="mt-1 max-w-[22ch] text-sm text-matcha-900/60">
              Starte zum Beispiel mit einem Matcha Latte — dein Favorit ist nur einen Tap entfernt.
            </p>
            <button
              type="button"
              onClick={onBrowse}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-matcha-900 px-5 py-2 text-sm font-semibold text-matcha-50 shadow-soft transition hover:bg-matcha-800"
            >
              Karte ansehen
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-black/5">
            {cart.map((c) => (
              <li key={c.item.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                <ItemImage
                  item={c.item}
                  category={getCategory(c.item.category_id)}
                  className="h-12 w-12 shrink-0"
                  emojiClass="text-2xl"
                  rounded="rounded-lg"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-matcha-900">{c.item.name}</div>
                      <div className="mt-0.5 text-xs text-matcha-800/60">
                        {formatEuro(c.item.preis)}&nbsp;€ / Stk.
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={`${c.item.name} entfernen`}
                      onClick={() => onDelete(c.item.id)}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-matcha-900/40 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="inline-flex items-center gap-1 rounded-full bg-matcha-50 text-matcha-900">
                      <button
                        type="button"
                        aria-label="Weniger"
                        onClick={() => onRemove(c.item.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-matcha-100"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="min-w-[1.25rem] text-center font-mono text-sm font-bold tabular-nums">{c.qty}</span>
                      <button
                        type="button"
                        aria-label="Mehr"
                        onClick={() => onAdd(c.item.id)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-matcha-100"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="font-mono text-sm font-bold tabular-nums text-matcha-900">
                      {formatEuro(c.qty * c.item.preis)}&nbsp;€
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Summary + CTA */}
      {cart.length > 0 && (
        <div className="space-y-3 border-t border-black/5 px-5 pb-5 pt-4">
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center justify-between text-matcha-800/70">
              <span>Zwischensumme</span>
              <span className="font-mono tabular-nums">{formatEuro(subtotal)}&nbsp;€</span>
            </div>
            {orderType === 'lieferung' && (
              <div className="flex items-center justify-between text-matcha-800/70">
                <span>Liefergebühr</span>
                <span className="font-mono tabular-nums">{formatEuro(DELIVERY_FEE)}&nbsp;€</span>
              </div>
            )}
            <div className="flex items-end justify-between pt-1">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-matcha-600">Gesamt</span>
              <span className="font-display text-2xl font-bold text-matcha-900">
                {formatEuro(total)}&nbsp;€
              </span>
            </div>
          </div>

          {!minReached && orderType === 'lieferung' && (
            <div className="rounded-xl bg-gold/15 px-3 py-2 text-xs text-matcha-900">
              Noch <span className="font-bold">{formatEuro(missing)}&nbsp;€</span> bis zum Mindestbestellwert.
            </div>
          )}

          {/* Live-ETA-Badge: zeigt Wartezeit und Küchenlast vor dem Checkout */}
          {orderType === 'lieferung' && locationId && minReached && (
            <LiveWaitBadge
              locationId={locationId}
              orderType="lieferung"
              className="w-full justify-center"
            />
          )}

          <button
            type="button"
            onClick={onCheckout}
            disabled={!minReached}
            className={cn(
              'group flex h-14 w-full items-center justify-between rounded-2xl px-5 font-display text-base font-bold shadow-soft transition',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-white',
              minReached
                ? 'bg-accent text-matcha-900 hover:brightness-105'
                : 'cursor-not-allowed bg-matcha-100 text-matcha-900/50',
            )}
          >
            <span className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5" />
              Zur Kasse
            </span>
            <span className="inline-flex items-center gap-1 font-mono tabular-nums">
              {formatEuro(total)}&nbsp;€
              <ArrowRight className="h-4 w-4 transition-transform motion-safe:group-hover:translate-x-0.5" />
            </span>
          </button>
        </div>
      )}
    </>
  );

  if (variant === 'desktop') {
    return (
      <aside className="sticky top-24 hidden lg:flex lg:w-[360px] lg:shrink-0">
        <div
          className={cn(
            'flex max-h-[calc(100vh-7rem)] w-full flex-col overflow-hidden rounded-3xl border border-black/5 bg-white shadow-soft',
          )}
        >
          {content}
        </div>
      </aside>
    );
  }

  // sheet
  return <div className="flex h-full max-h-[90vh] flex-col">{content}</div>;
}
