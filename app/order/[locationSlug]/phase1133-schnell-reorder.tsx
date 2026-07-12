'use client';

import { useCallback, useEffect, useState } from 'react';
import { RotateCcw, ShoppingCart, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1133 — Schnell-Reorder-Button (Storefront)
// 1-Klick-Wiederbestellung der letzten Bestellung mit Warenkorb-Vorausfüllung

const LS_LAST_ORDER_KEY = 'mise_last_order_items';

interface CartItem {
  item: { id: string; name: string; price: number; [key: string]: unknown };
  qty: number;
}

interface Props {
  locationId: string;
  onAddItems: (items: CartItem[]) => void;
  className?: string;
}

type SavedOrder = {
  items: CartItem[];
  locationId: string;
  savedAt: string;
};

function loadLastOrder(locationId: string): SavedOrder | null {
  try {
    const raw = localStorage.getItem(LS_LAST_ORDER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedOrder;
    if (parsed.locationId !== locationId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveOrderForReorder(items: CartItem[], locationId: string) {
  try {
    const payload: SavedOrder = { items, locationId, savedAt: new Date().toISOString() };
    localStorage.setItem(LS_LAST_ORDER_KEY, JSON.stringify(payload));
  } catch { /* ignore */ }
}

export function Phase1133SchnellReorder({ locationId, onAddItems, className }: Props) {
  const [lastOrder, setLastOrder] = useState<SavedOrder | null>(null);
  const [done, setDone] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setLastOrder(loadLastOrder(locationId));
  }, [locationId]);

  const handleReorder = useCallback(() => {
    if (!lastOrder) return;
    onAddItems(lastOrder.items);
    setDone(true);
    setTimeout(() => setDone(false), 2500);
  }, [lastOrder, onAddItems]);

  if (!mounted || !lastOrder || lastOrder.items.length === 0) return null;

  const itemNames = lastOrder.items
    .slice(0, 2)
    .map(i => `${i.qty}× ${i.item.name}`)
    .join(', ');
  const moreCount = lastOrder.items.length - 2;

  return (
    <div className={cn('rounded-xl border border-matcha-200 dark:border-matcha-800 bg-matcha-50 dark:bg-matcha-900/20 shadow-sm overflow-hidden', className)}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="shrink-0 text-matcha-600 dark:text-matcha-400">
          <RotateCcw className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-matcha-800 dark:text-matcha-200 truncate">
            Letzte Bestellung wiederholen
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            {itemNames}{moreCount > 0 ? ` +${moreCount} weitere` : ''}
          </div>
        </div>
        <button
          onClick={handleReorder}
          disabled={done}
          className={cn(
            'shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-200',
            done
              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
              : 'bg-matcha-600 dark:bg-matcha-700 text-white hover:bg-matcha-700 dark:hover:bg-matcha-600 active:scale-95'
          )}
        >
          {done
            ? <><Check className="h-3 w-3" /> Hinzugefügt</>
            : <><ShoppingCart className="h-3 w-3" /> Nochmal bestellen</>
          }
        </button>
      </div>
    </div>
  );
}
