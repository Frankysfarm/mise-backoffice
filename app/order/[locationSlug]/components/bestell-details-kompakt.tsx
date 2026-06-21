'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, ShoppingBag } from 'lucide-react';

type CartItem = {
  item: { name: string; preis: number };
  qty: number;
  extra_preis?: number;
};

interface Props {
  cartItems: CartItem[];
  bestellnummer: string;
}

export function BestellDetailsKompakt({ cartItems, bestellnummer }: Props) {
  const [open, setOpen] = useState(false);

  if (!cartItems || cartItems.length === 0) return null;

  const total = cartItems.reduce(
    (acc, ci) => acc + ci.qty * (ci.item.preis + (ci.extra_preis ?? 0)),
    0,
  );
  const itemCount = cartItems.reduce((acc, ci) => acc + ci.qty, 0);

  const fmtEur = (v: number) =>
    v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-50 transition"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          <ShoppingBag className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="text-sm font-bold text-char">
            {itemCount} Artikel · {fmtEur(total)}
          </span>
          <span className="text-[10px] text-stone-400 font-mono">#{bestellnummer}</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-stone-100 px-4 py-3 space-y-2">
          {cartItems.map((ci, i) => {
            const linePrice = ci.qty * (ci.item.preis + (ci.extra_preis ?? 0));
            return (
              <div key={i} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 flex h-5 w-5 items-center justify-center rounded-full bg-matcha-100 text-[10px] font-black text-matcha-700">
                    {ci.qty}×
                  </span>
                  <span className="text-[13px] font-medium text-char truncate">{ci.item.name}</span>
                </div>
                <span className="text-[12px] font-bold text-char shrink-0 tabular-nums">
                  {fmtEur(linePrice)}
                </span>
              </div>
            );
          })}
          <div className={cn('border-t border-stone-100 pt-2 flex justify-between')}>
            <span className="text-xs font-semibold text-stone-500">Gesamt</span>
            <span className="text-sm font-black text-matcha-700 tabular-nums">{fmtEur(total)}</span>
          </div>
        </div>
      )}
    </div>
  );
}
