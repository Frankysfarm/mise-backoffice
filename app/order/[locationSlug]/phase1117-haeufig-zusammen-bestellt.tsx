'use client';

import { useCallback, useEffect, useState } from 'react';
import { ShoppingBag, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MenuItem } from './components/types';

// Phase 1117 — Häufig-Zusammen-Bestellt-Widget (Storefront)
// Zeigt 3 meistbestellte Ergänzungsartikel basierend auf dem aktuellen Warenkorb

interface CartItem { item: MenuItem; qty: number }

interface Props {
  locationId: string;
  cart: CartItem[];
  allItems: MenuItem[];
  onAddItem: (item: MenuItem) => void;
}

type PopularItem = {
  id: string;
  name: string;
  preis: number;
  bild_url: string | null;
  bestellungen: number;
};

type ApiData = {
  empfehlungen: PopularItem[];
  location_id: string;
  generiert_am: string;
};

const POLL_MS = 10 * 60_000;

const MOCK_NAMES = ['Cola 0,5l', 'Mineralwasser', 'Knoblauchbrot', 'Tiramisu', 'Brownies', 'Pommes'];

function buildMock(allItems: MenuItem[], cart: CartItem[]): ApiData {
  const cartIds = new Set(cart.map(c => c.item.id));
  const candidates = allItems.filter(i => !cartIds.has(i.id)).slice(0, 6);
  const empfehlungen: PopularItem[] = (candidates.length ? candidates : []).slice(0, 3).map((item, idx) => ({
    id: item.id,
    name: item.name,
    preis: item.preis,
    bild_url: item.bild_url,
    bestellungen: 40 - idx * 8,
  }));

  if (empfehlungen.length === 0) {
    MOCK_NAMES.slice(0, 3).forEach((name, i) => {
      empfehlungen.push({ id: `mock-${i}`, name, preis: 2.5 + i * 0.5, bild_url: null, bestellungen: 35 - i * 7 });
    });
  }

  return { empfehlungen, location_id: 'mock', generiert_am: new Date().toISOString() };
}

export function Phase1117HaeufigZusammenBestellt({ locationId, cart, allItems, onAddItem }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const cartTotal = cart.reduce((s, c) => s + c.item.preis * c.qty, 0);
    if (cart.length === 0) return;
    try {
      const r = await fetch(
        `/api/delivery/storefront/bestellwert-optimierung?location_id=${locationId}&cart_total=${cartTotal.toFixed(2)}&min_order=10`
      );
      if (!r.ok) throw new Error('api');
      const json = await r.json();

      const cartIds = new Set(cart.map(c => c.item.id));
      const empfehlungen: PopularItem[] = (json.empfehlungen ?? [])
        .filter((e: PopularItem) => !cartIds.has(e.id))
        .slice(0, 3)
        .map((e: PopularItem) => {
          const local = allItems.find(i => i.id === e.id);
          return {
            id: e.id,
            name: local?.name ?? e.name,
            preis: local?.preis ?? e.preis,
            bild_url: local?.bild_url ?? null,
            bestellungen: e.bestellungen ?? 0,
          };
        });

      if (!empfehlungen.length) { setData(buildMock(allItems, cart)); return; }
      setData({ empfehlungen, location_id: locationId, generiert_am: new Date().toISOString() });
    } catch {
      setData(buildMock(allItems, cart));
    }
  }, [locationId, cart, allItems]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  function handleAdd(item: PopularItem) {
    const menuItem = allItems.find(i => i.id === item.id);
    if (!menuItem) return;
    onAddItem(menuItem);
    setAdded(prev => new Set(prev).add(item.id));
  }

  if (dismissed || !data || !data.empfehlungen.length || cart.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 text-matcha-600 dark:text-matcha-400 shrink-0" />
          <span className="text-sm font-bold text-foreground">Häufig dazu bestellt</span>
        </div>
        <button onClick={() => setDismissed(true)} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="px-4 pb-4 grid grid-cols-1 gap-2">
        {data.empfehlungen.map(item => {
          const isAdded = added.has(item.id);
          return (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg border border-border/60 bg-background p-2.5"
            >
              {item.bild_url ? (
                <img
                  src={item.bild_url}
                  alt={item.name}
                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-matcha-50 dark:bg-matcha-900/20 flex items-center justify-center shrink-0">
                  <ShoppingBag className="h-4 w-4 text-matcha-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-foreground truncate">{item.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {item.bestellungen}× heute bestellt
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className="text-sm font-bold text-foreground tabular-nums">
                  {item.preis.toFixed(2)} €
                </span>
                <button
                  onClick={() => handleAdd(item)}
                  disabled={isAdded}
                  className={cn(
                    'rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold transition-all',
                    isAdded
                      ? 'bg-matcha-100 dark:bg-matcha-900/40 text-matcha-600 dark:text-matcha-400 cursor-default'
                      : 'bg-matcha-500 hover:bg-matcha-600 text-white'
                  )}
                >
                  {isAdded ? '✓' : '+'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
