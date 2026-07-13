'use client';

import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1411 — Allergen-Schnell-Ampel (Kitchen)
 *
 * Für jede aktive Bestellung: Zeige kritische Allergene (Nuss/Gluten/Laktose)
 * als Farbchips. Props-basiert aus order.items. Keine API-Calls.
 */

interface OrderItem {
  name?: string | null;
  description?: string | null;
  special_instructions?: string | null;
  notes?: string | null;
}

interface Order {
  id: string;
  customer_name?: string | null;
  display_id?: string | null;
  items?: OrderItem[] | null;
  special_instructions?: string | null;
}

interface Props {
  orders: Order[];
}

const ALLERGEN_RULES: Array<{
  key: string;
  label: string;
  color: string;
  bg: string;
  border: string;
  keywords: string[];
}> = [
  {
    key: 'nuss',
    label: 'Nuss',
    color: 'text-rose-700 dark:text-rose-300',
    bg: 'bg-rose-100 dark:bg-rose-900/40',
    border: 'border-rose-300 dark:border-rose-700',
    keywords: ['nuss', 'mandel', 'cashew', 'walnuss', 'pekannuss', 'pistazie', 'haselnuss', 'erdnuss', 'peanut', 'nuts'],
  },
  {
    key: 'gluten',
    label: 'Gluten',
    color: 'text-amber-700 dark:text-amber-300',
    bg: 'bg-amber-100 dark:bg-amber-900/40',
    border: 'border-amber-300 dark:border-amber-700',
    keywords: ['gluten', 'weizen', 'mehl', 'brot', 'brötchen', 'nudel', 'pasta', 'semmel', 'wheat', 'flour'],
  },
  {
    key: 'laktose',
    label: 'Laktose',
    color: 'text-sky-700 dark:text-sky-300',
    bg: 'bg-sky-100 dark:bg-sky-900/40',
    border: 'border-sky-300 dark:border-sky-700',
    keywords: ['laktose', 'milch', 'butter', 'sahne', 'käse', 'joghurt', 'rahm', 'dairy', 'milk', 'lactose'],
  },
  {
    key: 'ei',
    label: 'Ei',
    color: 'text-yellow-700 dark:text-yellow-300',
    bg: 'bg-yellow-100 dark:bg-yellow-900/40',
    border: 'border-yellow-300 dark:border-yellow-700',
    keywords: ['ei', 'eier', 'eigelb', 'eiweiß', 'mayo', 'egg'],
  },
  {
    key: 'sesam',
    label: 'Sesam',
    color: 'text-orange-700 dark:text-orange-300',
    bg: 'bg-orange-100 dark:bg-orange-900/40',
    border: 'border-orange-300 dark:border-orange-700',
    keywords: ['sesam', 'tahini', 'sesame'],
  },
];

function detectAllergens(order: Order): string[] {
  const texts: string[] = [];
  const addText = (s: string | null | undefined) => { if (s) texts.push(s.toLowerCase()); };

  addText(order.special_instructions);
  for (const item of order.items ?? []) {
    addText(item.name);
    addText(item.description);
    addText(item.special_instructions);
    addText(item.notes);
  }
  const combined = texts.join(' ');

  return ALLERGEN_RULES
    .filter((rule) => rule.keywords.some((kw) => combined.includes(kw)))
    .map((rule) => rule.key);
}

export function KitchenPhase1411AllergenSchnellAmpel({ orders }: Props) {
  const ordersWithAllergens = useMemo(() => {
    return orders
      .map((o) => ({ order: o, allergens: detectAllergens(o) }))
      .filter((row) => row.allergens.length > 0);
  }, [orders]);

  if (ordersWithAllergens.length === 0) return null;

  return (
    <div className="rounded-xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/20 p-3 mb-2">
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
        <span className="text-sm font-bold text-rose-700 dark:text-rose-300">Allergen-Schnell-Ampel</span>
        <span className="ml-auto text-xs font-semibold rounded-full bg-rose-200 dark:bg-rose-800 text-rose-800 dark:text-rose-200 px-2 py-0.5">
          {ordersWithAllergens.length} Bestellung{ordersWithAllergens.length !== 1 ? 'en' : ''}
        </span>
      </div>

      <div className="space-y-2">
        {ordersWithAllergens.map(({ order, allergens }) => {
          const name = order.customer_name ?? order.display_id ?? order.id.slice(-6);
          return (
            <div
              key={order.id}
              className="flex items-start gap-2 rounded-lg bg-white/70 dark:bg-white/5 border border-white/50 dark:border-white/10 px-2 py-1.5"
            >
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 shrink-0 mt-0.5">
                #{name}
              </span>
              <div className="flex flex-wrap gap-1">
                {allergens.map((key) => {
                  const rule = ALLERGEN_RULES.find((r) => r.key === key)!;
                  return (
                    <span
                      key={key}
                      className={cn(
                        'text-[10px] font-bold px-1.5 py-0.5 rounded-full border',
                        rule.color, rule.bg, rule.border
                      )}
                    >
                      {rule.label}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
