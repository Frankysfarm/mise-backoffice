'use client';

import { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface MenuItem {
  name?: string;
  allergene?: string[] | null;
}

interface CartItem {
  item: MenuItem;
  qty: number;
}

interface Props {
  cart: CartItem[];
}

const ALLERGEN_LABELS: Record<string, string> = {
  gluten: 'Gluten',
  milk: 'Milch/Laktose',
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
  fisch: 'Fisch',
  shellfish: 'Krebstiere',
  sesame: 'Sesam',
  sesam: 'Sesam',
  mustard: 'Senf',
  senf: 'Senf',
  celery: 'Sellerie',
  sellerie: 'Sellerie',
  lupin: 'Lupinen',
  molluscs: 'Weichtiere',
  sulphites: 'Sulfite',
  sulfite: 'Sulfite',
};

function collectAllergens(cart: CartItem[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const c of cart) {
    const name = (c.item.name ?? 'Artikel').trim();
    const allergens = c.item.allergene ?? [];
    if (allergens.length > 0) {
      map.set(name, allergens);
    }
  }
  return map;
}

function AllergenTag({ code }: { code: string }) {
  const label = ALLERGEN_LABELS[code.toLowerCase()] ?? code;
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-300">
      {label}
    </span>
  );
}

export function Phase658AllergenesWarnBanner({ cart }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || !cart || cart.length === 0) return null;

  const allergenMap = collectAllergens(cart);
  if (allergenMap.size === 0) return null;

  const allCodes = [...new Set([...allergenMap.values()].flat())];

  return (
    <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-amber-800 dark:text-amber-300">
            Allergene in deiner Bestellung
          </p>
          <p className="mt-0.5 text-[11px] text-amber-700/80 dark:text-amber-400/80">
            Folgende Produkte enthalten Allergene oder Unverträglichkeiten:
          </p>

          <ul className="mt-2 space-y-2">
            {[...allergenMap.entries()].map(([productName, codes]) => (
              <li key={productName}>
                <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 block truncate">
                  {productName}
                </span>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {codes.map((code) => (
                    <AllergenTag key={code} code={code} />
                  ))}
                </div>
              </li>
            ))}
          </ul>

          {allCodes.length > 0 && (
            <p className="mt-3 text-[11px] text-amber-700 dark:text-amber-400">
              Alle Allergene: {allCodes.map((c) => ALLERGEN_LABELS[c.toLowerCase()] ?? c).join(', ')}
            </p>
          )}
        </div>
        <button
          onClick={() => setDismissed(true)}
          aria-label="Schließen"
          className="shrink-0 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
