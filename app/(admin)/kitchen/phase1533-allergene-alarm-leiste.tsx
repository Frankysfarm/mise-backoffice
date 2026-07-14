'use client';

import React from 'react';

interface Order {
  id: string;
  items?: { name?: string; allergens?: string[] }[];
  allergens?: string[];
}

interface Props {
  orders?: Order[];
}

const CRITICAL_ALLERGENS = [
  { key: 'nuts', label: 'Nüsse', icon: '🥜', color: 'bg-amber-100 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300' },
  { key: 'gluten', label: 'Gluten', icon: '🌾', color: 'bg-yellow-100 dark:bg-yellow-950/40 border-yellow-300 dark:border-yellow-700 text-yellow-800 dark:text-yellow-300' },
  { key: 'lactose', label: 'Laktose', icon: '🥛', color: 'bg-blue-100 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-800 dark:text-blue-300' },
];

function hasAllergen(order: Order, key: string): boolean {
  if (order.allergens?.some(a => a.toLowerCase().includes(key))) return true;
  return (order.items ?? []).some(item =>
    item.allergens?.some(a => a.toLowerCase().includes(key))
  );
}

export function KitchenPhase1533AllergenAlarmLeiste({ orders = [] }: Props) {
  const counts = CRITICAL_ALLERGENS.map(a => ({
    ...a,
    count: orders.filter(o => hasAllergen(o, a.key)).length,
  })).filter(a => a.count > 0);

  if (counts.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-1 py-1">
      {counts.map(a => (
        <div
          key={a.key}
          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${a.color}`}
          title={`${a.count} Bestellung${a.count > 1 ? 'en' : ''} mit ${a.label}`}
        >
          <span>{a.icon}</span>
          <span>{a.label}</span>
          <span className="rounded-full bg-white/60 dark:bg-black/20 px-1.5 py-0.5 font-bold">{a.count}</span>
        </div>
      ))}
    </div>
  );
}
