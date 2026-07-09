'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Plus, ShoppingBag, Sparkles, X } from 'lucide-react';

/**
 * Phase 1047 — Warenkorb-Upsell-Widget (Storefront)
 *
 * Empfiehlt Zusatzartikel (Getränk/Dessert/Snack) wenn Warenkorb < Mindestbestellwert × 1.2.
 * Basiert auf Phase1043-API /api/delivery/admin/bestellwert-optimierung.
 * Dismissbar pro Session. Kein Upsell wenn Ziel bereits erreicht.
 */

interface CartItem {
  item: { id: string; name: string; preis: number };
  qty: number;
  extra_preis?: number;
}

interface Props {
  locationId: string;
  cart: CartItem[];
  onAddItem?: (name: string, preis: number) => void;
}

interface Empfehlung {
  name: string;
  preis: number;
  kategorie: 'getraenk' | 'dessert' | 'snack';
  beliebtheit_rang: number;
  bild_url: string | null;
}

interface ApiResponse {
  empfehlungen: Empfehlung[];
  min_order_eur: number;
  ziel_eur: number;
  fehlend_eur: number;
  location_id: string | null;
}

const KAT_EMOJI: Record<Empfehlung['kategorie'], string> = {
  getraenk: '🥤',
  dessert: '🍮',
  snack: '🍟',
};

const KAT_LABEL: Record<Empfehlung['kategorie'], string> = {
  getraenk: 'Getränk',
  dessert: 'Dessert',
  snack: 'Snack',
};

const DISMISSED_KEY = 'phase1047_dismissed_v1';

function isDismissed(): boolean {
  try { return sessionStorage.getItem(DISMISSED_KEY) === '1'; } catch { return false; }
}

function setDismissed() {
  try { sessionStorage.setItem(DISMISSED_KEY, '1'); } catch {}
}

export function Phase1047WarenkorbUpsellWidget({ locationId, cart, onAddItem }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [dismissed, setDismissedState] = useState(false);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(true);
  const prevTotal = useRef(-1);

  const cartTotal = cart.reduce((s, c) => s + c.qty * (c.item.preis + (c.extra_preis ?? 0)), 0);

  useEffect(() => {
    setDismissedState(isDismissed());
  }, []);

  useEffect(() => {
    if (dismissed) return;
    if (Math.abs(cartTotal - prevTotal.current) < 0.01) return;
    prevTotal.current = cartTotal;

    if (cartTotal <= 0) {
      setData(null);
      return;
    }

    const controller = new AbortController();
    fetch(
      `/api/delivery/admin/bestellwert-optimierung?location_id=${locationId}&cart_total=${cartTotal.toFixed(2)}`,
      { signal: controller.signal },
    )
      .then(r => r.ok ? r.json() : null)
      .then((json: ApiResponse | null) => {
        if (json) setData(json);
      })
      .catch(() => {});

    return () => controller.abort();
  }, [locationId, cartTotal, dismissed]);

  function handleDismiss() {
    setDismissed();
    setDismissedState(true);
  }

  function handleAdd(emp: Empfehlung) {
    onAddItem?.(emp.name, emp.preis);
    setAddedItems(prev => new Set(prev).add(emp.name));
  }

  if (dismissed || !data || data.fehlend_eur <= 0 || data.empfehlungen.length === 0) return null;

  const fehlend = data.fehlend_eur;
  const ziel = data.ziel_eur;
  const progress = Math.min(1, cartTotal / ziel);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 flex-1 text-left"
        >
          <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">
              Noch {fehlend.toFixed(2)} € bis zum optimalen Bestellwert
            </p>
            <div className="mt-1 h-1.5 rounded-full bg-amber-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-amber-400 transition-all"
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-amber-600 shrink-0" /> : <ChevronDown className="h-4 w-4 text-amber-600 shrink-0" />}
        </button>
        <button onClick={handleDismiss} className="ml-2 p-1 rounded-full hover:bg-amber-100 text-amber-500 transition">
          <X size={14} />
        </button>
      </div>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-[11px] text-amber-700 flex items-center gap-1">
            <ShoppingBag size={11} />
            Oft dazu bestellt:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {data.empfehlungen.map(emp => {
              const added = addedItems.has(emp.name);
              return (
                <button
                  key={emp.name}
                  onClick={() => !added && handleAdd(emp)}
                  disabled={added}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition',
                    added
                      ? 'border-emerald-200 bg-emerald-50 opacity-70 cursor-default'
                      : 'border-amber-200 bg-white hover:border-amber-400 hover:bg-amber-50 active:scale-95',
                  )}
                >
                  <span className="text-lg shrink-0">{KAT_EMOJI[emp.kategorie]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-semibold text-foreground truncate">{emp.name}</p>
                    <p className="text-[10px] text-muted-foreground">{KAT_LABEL[emp.kategorie]}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[12px] font-bold text-amber-700">{emp.preis.toFixed(2)} €</p>
                    {added ? (
                      <span className="text-[10px] text-emerald-600 font-semibold">✓</span>
                    ) : (
                      <Plus size={13} className="text-amber-500 ml-auto" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
