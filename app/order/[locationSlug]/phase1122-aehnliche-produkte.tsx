'use client';

import { useMemo, useState } from 'react';
import { Plus, Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1122 — Ähnliche-Produkte-Empfehlung (Storefront)
// Nach Artikel-Auswahl: 3 ähnliche Artikel (gleiche Kategorie, ähnlicher Preis) als horizontale Swipe-Chips

interface MenuItem {
  id: string;
  name?: string;
  title?: string;
  price?: number;
  preis?: number;
  category?: string;
  kategorie?: string;
  image_url?: string | null;
  bild_url?: string | null;
  description?: string;
  beschreibung?: string;
}

interface CartItem {
  id: string;
  name?: string;
  title?: string;
  quantity: number;
  price?: number;
  preis?: number;
  category?: string;
  kategorie?: string;
}

interface Props {
  cart: CartItem[];
  allItems: MenuItem[];
  onAddItem: (item: MenuItem) => void;
}

function getItemName(i: MenuItem | CartItem): string {
  return (i.name ?? (i as MenuItem).title ?? '').trim() || 'Artikel';
}
function getPrice(i: MenuItem): number {
  return (i.price ?? i.preis ?? 0);
}
function getCategory(i: MenuItem | CartItem): string {
  return (i.category ?? (i as MenuItem).kategorie ?? '').toLowerCase();
}

export function Phase1122AehnlicheProdukte({ cart, allItems, onAddItem }: Props) {
  const [added, setAdded] = useState<Set<string>>(new Set());

  const aehnliche = useMemo(() => {
    if (!cart.length || !allItems.length) return [];

    const cartIds = new Set(cart.map(c => c.id));
    const cartCategories = new Set(cart.map(getCategory).filter(Boolean));
    const avgPrice = cart.reduce((s, c) => s + (c.price ?? c.preis ?? 0), 0) / cart.length;
    const priceTolerance = Math.max(avgPrice * 0.5, 2);

    const candidates = allItems.filter(item => {
      if (cartIds.has(item.id)) return false;
      const cat = getCategory(item);
      if (!cartCategories.has(cat) && cat) return false;
      const price = getPrice(item);
      if (avgPrice > 0 && Math.abs(price - avgPrice) > priceTolerance) return false;
      return true;
    });

    // Sort by price similarity
    return candidates
      .sort((a, b) => Math.abs(getPrice(a) - avgPrice) - Math.abs(getPrice(b) - avgPrice))
      .slice(0, 4);
  }, [cart, allItems]);

  if (aehnliche.length === 0) return null;

  function handleAdd(item: MenuItem) {
    onAddItem(item);
    setAdded(prev => new Set([...prev, item.id]));
    setTimeout(() => setAdded(prev => { const n = new Set(prev); n.delete(item.id); return n; }), 2000);
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b">
        <div className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-bold text-foreground uppercase tracking-wide">Ähnliche Artikel</span>
        </div>
        <span className="text-[10px] text-muted-foreground">Passend zu deiner Auswahl</span>
      </div>

      <div className="flex gap-3 px-4 py-3 overflow-x-auto scrollbar-hide">
        {aehnliche.map(item => {
          const isAdded = added.has(item.id);
          const price = getPrice(item);
          const name = getItemName(item);
          return (
            <div
              key={item.id}
              className="flex-shrink-0 w-36 rounded-xl border bg-background shadow-sm overflow-hidden flex flex-col"
            >
              {/* Image placeholder or actual image */}
              <div className="h-20 bg-muted/40 relative overflow-hidden">
                {(item.image_url ?? item.bild_url) ? (
                  <img
                    src={item.image_url ?? item.bild_url ?? ''}
                    alt={name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl select-none">
                    🍽️
                  </div>
                )}
              </div>

              <div className="p-2 flex flex-col gap-1.5 flex-1">
                <span className="text-[11px] font-semibold text-foreground leading-tight line-clamp-2">{name}</span>
                {price > 0 && (
                  <span className="text-[11px] font-bold text-primary">{price.toFixed(2).replace('.', ',')} €</span>
                )}
                <button
                  onClick={() => handleAdd(item)}
                  className={cn(
                    'mt-auto w-full flex items-center justify-center gap-1 rounded-lg py-1 text-[10px] font-bold transition',
                    isAdded
                      ? 'bg-emerald-500 text-white'
                      : 'bg-primary/10 text-primary hover:bg-primary/20',
                  )}
                >
                  {isAdded ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {isAdded ? 'Hinzugefügt' : 'Hinzufügen'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
