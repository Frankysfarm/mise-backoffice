'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Leaf } from 'lucide-react';

interface OrderItem {
  name?: string;
  product_name?: string;
  allergene?: string[] | null;
  quantity?: number;
}

interface Order {
  id: string;
  status: string;
  items?: OrderItem[];
}

interface Props {
  orders: Order[];
}

const ALLERGEN_LABELS: Record<string, string> = {
  gluten: 'Gluten',
  milk: 'Milch',
  laktose: 'Laktose',
  eggs: 'Eier',
  eier: 'Eier',
  nuts: 'Nüsse',
  nüsse: 'Nüsse',
  peanuts: 'Erdnüsse',
  erdnüsse: 'Erdnüsse',
  soy: 'Soja',
  soja: 'Soja',
  fish: 'Fisch',
  shellfish: 'Krebstiere',
  sesame: 'Sesam',
  sesam: 'Sesam',
  mustard: 'Senf',
  senf: 'Senf',
  celery: 'Sellerie',
  sellerie: 'Sellerie',
};

interface AllergenOrder {
  id: string;
  status: string;
  positionen: Array<{ name: string; allergene: string[] }>;
}

function extractAllergenOrders(orders: Order[]): AllergenOrder[] {
  return orders
    .filter((o) => o.status === 'confirmed' || o.status === 'preparing')
    .map((o) => {
      const positionen = (o.items ?? [])
        .map((item) => ({
          name: (item.name ?? item.product_name ?? 'Artikel').trim(),
          allergene: (item.allergene ?? []).map(
            (a) => ALLERGEN_LABELS[a.toLowerCase()] ?? a,
          ),
        }))
        .filter((p) => p.allergene.length > 0);
      return { id: o.id, status: o.status, positionen };
    })
    .filter((o) => o.positionen.length > 0);
}

function AllergenTag({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 text-[9px] font-bold text-red-800 dark:text-red-300 uppercase tracking-wide">
      {label}
    </span>
  );
}

export function KitchenPhase687AllergenBonAnzeige({ orders }: Props) {
  const [open, setOpen] = useState(true);
  const allergenOrders = extractAllergenOrders(orders);

  if (allergenOrders.length === 0) return null;

  return (
    <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/10 p-4 shadow-sm">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Leaf className="h-4 w-4 text-red-600 dark:text-red-400" />
          <span className="text-sm font-semibold text-red-800 dark:text-red-300">
            Allergen-Bestellungen
          </span>
          <span className="rounded-full bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white">
            {allergenOrders.length}
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-red-600 dark:text-red-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-red-600 dark:text-red-400" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-red-700 dark:text-red-400">
              Aktive Bestellungen mit Allergenen — bitte bei Zubereitung beachten!
            </p>
          </div>
          {allergenOrders.map((o) => (
            <div
              key={o.id}
              className="rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-red-950/20 p-3"
            >
              <p className="text-xs font-bold text-red-800 dark:text-red-300 mb-1.5">
                Bestellung #{o.id.slice(-6).toUpperCase()}
              </p>
              {o.positionen.map((p) => (
                <div key={p.name} className="flex flex-wrap items-center gap-1 mb-1 last:mb-0">
                  <span className="text-xs text-red-700 dark:text-red-400 font-medium mr-1">
                    {p.name}:
                  </span>
                  {p.allergene.map((a) => (
                    <AllergenTag key={a} label={a} />
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
