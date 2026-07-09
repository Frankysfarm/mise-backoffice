'use client';

import React, { useEffect, useState } from 'react';
import { ShoppingBag, X, Plus } from 'lucide-react';

type UpsellItem = {
  id: string;
  name: string;
  preis: number;
  kategorie: string;
};

type Props = {
  subtotal: number;
  minOrder: number;
  locationId: string;
  onAddItem?: (item: UpsellItem) => void;
};

export function Phase1047WarenkorbUpsellWidget({ subtotal, minOrder, locationId, onAddItem }: Props) {
  const [items, setItems] = useState<UpsellItem[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const schwelle = minOrder * 1.2;
  const fehlend = schwelle - subtotal;
  const visible = !dismissed && subtotal > 0 && subtotal < schwelle;

  useEffect(() => {
    if (!visible) return;
    fetch(
      `/api/delivery/storefront/bestellwert-optimierung?location_id=${encodeURIComponent(locationId)}&cart_total=${subtotal}&min_order=${minOrder}`
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.empfehlungen && Array.isArray(d.empfehlungen)) {
          setItems(d.empfehlungen.slice(0, 4));
        }
      })
      .catch(() => {});
  }, [visible, locationId, subtotal, minOrder]);

  if (!visible || items.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 overflow-hidden">
      <div className="flex items-start justify-between px-4 pt-3 pb-2">
        <div className="flex items-start gap-2">
          <ShoppingBag className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-bold text-amber-800 dark:text-amber-200">
              Nur {fehlend.toFixed(2).replace('.', ',')} € bis zum optimalen Bestellwert
            </div>
            <div className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
              Beliebte Ergänzungen zu deiner Bestellung
            </div>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/40 text-amber-500 transition-colors shrink-0"
        >
          <X size={14} />
        </button>
      </div>

      <div className="px-4 pb-3 flex flex-wrap gap-2">
        {items.map((item) => {
          const added = addedIds.has(item.id);
          return (
            <button
              key={item.id}
              disabled={added}
              onClick={() => {
                if (!added) {
                  setAddedIds((prev) => new Set([...prev, item.id]));
                  onAddItem?.(item);
                }
              }}
              className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold border transition-all ${
                added
                  ? 'bg-matcha-100 border-matcha-300 text-matcha-700 dark:bg-matcha-900/30 dark:border-matcha-700 dark:text-matcha-300'
                  : 'bg-white border-amber-200 text-amber-800 hover:bg-amber-50 hover:border-amber-300 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-800/30'
              }`}
            >
              {added ? (
                <span className="text-matcha-600 dark:text-matcha-400 text-xs">✓</span>
              ) : (
                <Plus size={13} className="shrink-0" />
              )}
              <span className="truncate max-w-[120px]">{item.name}</span>
              <span className="text-[11px] opacity-70 tabular-nums shrink-0">
                {item.preis.toFixed(2).replace('.', ',')} €
              </span>
            </button>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between mb-1 text-[10px] text-amber-600 dark:text-amber-400">
          <span>{subtotal.toFixed(2).replace('.', ',')} €</span>
          <span>Ziel: {schwelle.toFixed(2).replace('.', ',')} €</span>
        </div>
        <div className="h-1.5 rounded-full bg-amber-200 dark:bg-amber-800 overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all"
            style={{ width: `${Math.min(100, (subtotal / schwelle) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
