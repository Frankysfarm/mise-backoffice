'use client';

import { useEffect, useMemo, useState } from 'react';
import { Clock, RefreshCw, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1153 — Bestellhistorie-Schnellzugriff (Storefront)
// Letzte 3 Bestellungen kompakt aus localStorage — Datum, Artikel, Wiederholen-Button.

interface CartItem {
  item: { id: string; name?: string; preis?: number; price?: number; kategorie?: string };
  qty: number;
}

interface HistorieEintrag {
  id: string;
  datum: string;
  artikel: string[];
  gesamtpreis: number;
  items: CartItem[];
}

interface Props {
  onAddItems: (items: CartItem[]) => void;
  cart: CartItem[];
}

const STORAGE_KEY = 'mise_bestellhistorie';

export function loadBestellhistorie(): HistorieEintrag[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    return [];
  }
}

export function saveBestellhistorie(entry: HistorieEintrag): void {
  if (typeof window === 'undefined') return;
  try {
    const existing: HistorieEintrag[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    const updated = [entry, ...existing.filter(e => e.id !== entry.id)].slice(0, 5);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function Phase1153BestellhistorieSchnellzugriff({ onAddItems, cart }: Props) {
  const [historie, setHistorie] = useState<HistorieEintrag[]>([]);
  const [added, setAdded] = useState<string | null>(null);

  useEffect(() => {
    setHistorie(loadBestellhistorie().slice(0, 3));
  }, []);

  const cartItemIds = useMemo(
    () => new Set(cart.map(c => c.item.id)),
    [cart],
  );

  function handleWiederholen(entry: HistorieEintrag) {
    onAddItems(entry.items);
    setAdded(entry.id);
    setTimeout(() => setAdded(null), 2000);
  }

  if (historie.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Letzte Bestellungen
        </span>
      </div>
      <div className="divide-y">
        {historie.map((entry) => {
          const isAdded = added === entry.id;
          const alreadyInCart = entry.items.every(ci => cartItemIds.has(ci.item.id));
          return (
            <div key={entry.id} className="px-4 py-3 flex items-start gap-3">
              <ShoppingBag className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-muted-foreground mb-0.5">
                  {new Date(entry.datum).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: 'short' })}
                  {' · '}
                  {entry.gesamtpreis.toFixed(2)} €
                </div>
                <div className="text-xs text-foreground truncate">
                  {entry.artikel.slice(0, 3).join(', ')}{entry.artikel.length > 3 ? ` +${entry.artikel.length - 3}` : ''}
                </div>
              </div>
              <button
                onClick={() => handleWiederholen(entry)}
                disabled={isAdded || alreadyInCart}
                className={cn(
                  'shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1 text-[11px] font-bold transition',
                  isAdded
                    ? 'bg-emerald-500 text-white'
                    : alreadyInCart
                    ? 'bg-muted text-muted-foreground cursor-default'
                    : 'bg-primary text-primary-foreground hover:bg-primary/90',
                )}
              >
                {isAdded ? (
                  <>✓ Hinzugefügt</>
                ) : alreadyInCart ? (
                  <>Im Warenkorb</>
                ) : (
                  <><RefreshCw className="h-3 w-3" /> Wiederholen</>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
