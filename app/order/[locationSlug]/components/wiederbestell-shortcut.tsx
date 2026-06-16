'use client';

import { useEffect, useState } from 'react';
import { RotateCcw, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MenuItem } from './types';

interface CartSnapshot {
  id: string;
  qty: number;
  name: string;
  preis: number;
  savedAt: number;
}

interface Props {
  locationId: string;
  items: MenuItem[];
  onAdd: (item: MenuItem) => void;
}

const STORAGE_KEY = (lid: string) => `mise_last_cart:${lid}`;
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 Tage

export function saveLastCart(locationId: string, cart: { item: MenuItem; qty: number }[]) {
  try {
    const snapshot: CartSnapshot[] = cart.map(({ item, qty }) => ({
      id:      item.id,
      qty,
      name:    item.name,
      preis:   item.preis,
      savedAt: Date.now(),
    }));
    localStorage.setItem(STORAGE_KEY(locationId), JSON.stringify(snapshot));
  } catch {}
}

export function WiederbestellShortcut({ locationId, items, onAdd }: Props) {
  const [cartSnap, setCartSnap] = useState<CartSnapshot[]>([]);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY(locationId));
      if (!raw) return;
      const parsed: CartSnapshot[] = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return;
      const fresh = parsed.filter(
        (s) => Date.now() - (s.savedAt ?? 0) < TTL_MS,
      );
      if (fresh.length === 0) return;
      setCartSnap(fresh.slice(0, 4));
    } catch {}
  }, [locationId]);

  if (dismissed || cartSnap.length === 0) return null;

  const resolvedItems = cartSnap
    .map((snap) => {
      const menuItem = items.find((it) => it.id === snap.id);
      return menuItem ? { menuItem, qty: snap.qty, name: snap.name } : null;
    })
    .filter(Boolean) as { menuItem: MenuItem; qty: number; name: string }[];

  if (resolvedItems.length === 0) return null;

  function addAll() {
    resolvedItems.forEach(({ menuItem, qty }) => {
      for (let i = 0; i < qty; i++) onAdd(menuItem);
    });
    setDismissed(true);
  }

  return (
    <div className="rounded-2xl border border-matcha-200 bg-matcha-50 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-bold text-matcha-800">Letzte Bestellung</span>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-[11px] text-stone-400 hover:text-stone-600 transition"
        >
          ✕
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {resolvedItems.map(({ menuItem, qty, name }) => (
          <div
            key={menuItem.id}
            className="flex items-center gap-1.5 rounded-full border border-matcha-200 bg-white px-2.5 py-1 shadow-sm"
          >
            <span className="text-[11px] font-semibold text-matcha-800 max-w-[120px] truncate">
              {qty > 1 ? `${qty}× ` : ''}{name}
            </span>
            <button
              onClick={() => {
                for (let i = 0; i < qty; i++) onAdd(menuItem);
              }}
              className="flex items-center justify-center h-4 w-4 rounded-full bg-matcha-600 text-white hover:bg-matcha-700 transition shrink-0"
            >
              <Plus className="h-2.5 w-2.5" />
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addAll}
        className={cn(
          'w-full h-9 rounded-xl bg-matcha-600 text-white text-sm font-bold',
          'flex items-center justify-center gap-2',
          'hover:bg-matcha-700 active:scale-[0.98] transition',
        )}
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Alle wieder hinzufügen
      </button>
    </div>
  );
}
