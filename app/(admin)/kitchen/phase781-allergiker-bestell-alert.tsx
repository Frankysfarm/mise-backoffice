'use client';

import { useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';

const ALLERGENE = ['Gluten', 'Laktose', 'Nüsse', 'Erdnüsse', 'Ei', 'Fisch', 'Soja', 'Sesam', 'Sellerie', 'Senf'];

type Order = {
  id: string;
  bestellnummer?: string;
  status: string;
  created_at?: string;
  bestellt_am?: string | null;
  notiz?: string | null;
  kunde?: { name?: string | null } | null;
  items?: Array<{ name?: string | null; notiz?: string | null; extras?: unknown }> | null;
};

const AKTIV = ['pending', 'confirmed', 'preparing', 'in_progress', 'in_kitchen', 'in_zubereitung', 'bestätigt'];

function scanText(text: string): string[] {
  const lower = text.toLowerCase();
  return ALLERGENE.filter((a) => lower.includes(a.toLowerCase()));
}

function findAllergeneInOrder(o: Order): string[] {
  const hits = new Set<string>();
  const notizText = (o as unknown as Record<string, unknown>)['notiz'] as string ?? '';
  scanText(notizText).forEach((a) => hits.add(a));
  for (const item of o.items ?? []) {
    const t = [item.name ?? '', item.notiz ?? '', JSON.stringify(item.extras ?? '')].join(' ');
    scanText(t).forEach((a) => hits.add(a));
  }
  return Array.from(hits);
}

interface Props {
  orders: Order[];
}

export function KitchenPhase781AllergikerBestellAlert({ orders }: Props) {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const aktiveAllergenOrders = orders
    .filter((o) => AKTIV.includes(o.status) && !dismissed.has(o.id))
    .map((o) => ({ o, allergene: findAllergeneInOrder(o) }))
    .filter(({ allergene }) => allergene.length > 0);

  if (!aktiveAllergenOrders.length) return null;

  return (
    <div className="space-y-2">
      {aktiveAllergenOrders.slice(0, 3).map(({ o, allergene }) => {
        const nr = o.bestellnummer ?? o.id.slice(0, 8);
        const kundeName = o.kunde?.name ?? null;
        const minAgo = o.bestellt_am || o.created_at
          ? Math.floor((Date.now() - new Date((o.bestellt_am ?? o.created_at) as string).getTime()) / 60_000)
          : null;

        return (
          <div
            key={o.id}
            className="relative flex items-start gap-3 rounded-xl border border-red-400 bg-red-50 dark:bg-red-950/30 dark:border-red-600/60 px-4 py-3 animate-pulse"
          >
            <ShieldAlert className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-black text-red-700 dark:text-red-300">
                  ALLERGEN #{nr}
                </span>
                {kundeName && (
                  <span className="text-xs text-red-600 dark:text-red-400 font-semibold">
                    · {kundeName}
                  </span>
                )}
                {minAgo !== null && (
                  <span className="text-[10px] text-red-500 dark:text-red-400">
                    {minAgo} Min. warten
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {allergene.map((a) => (
                  <span
                    key={a}
                    className="rounded-full bg-red-600 dark:bg-red-700 text-white text-[10px] font-bold px-2 py-0.5"
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={() => setDismissed((prev) => new Set([...prev, o.id]))}
              className="shrink-0 text-red-400 hover:text-red-600 transition-colors"
              aria-label="Verwerfen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
