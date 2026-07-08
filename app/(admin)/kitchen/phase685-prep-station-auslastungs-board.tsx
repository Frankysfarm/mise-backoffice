'use client';

/**
 * Phase 685 — Prep-Station Auslastungs-Board
 * Zeigt Farbkodierung je Zubereitungsstation: Auslastung, aktive Items, Ziel-Pünktlichkeit.
 * Props: orders[] (Kitchen client.tsx)
 */

import React, { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, ChevronDown, ChevronUp, Flame } from 'lucide-react';

type Item = { name?: string; kategorie?: string; category?: string; menge?: number; quantity?: number };
type Order = { id: string; status?: string; items?: Item[]; created_at?: string };

type StationLevel = 'idle' | 'normal' | 'busy' | 'overloaded';

const STATIONS = [
  { key: 'grill',   label: 'Grill',    emoji: '🔥', keywords: ['burger', 'grill', 'steak', 'fleisch', 'meat', 'chicken', 'hähnchen'] },
  { key: 'pizza',   label: 'Pizza',    emoji: '🍕', keywords: ['pizza', 'calzone', 'flammkuchen'] },
  { key: 'salat',   label: 'Salate',   emoji: '🥗', keywords: ['salat', 'salad', 'bowl', 'vegan'] },
  { key: 'snacks',  label: 'Snacks',   emoji: '🍟', keywords: ['pommes', 'fries', 'snack', 'nugget', 'wings'] },
  { key: 'dessert', label: 'Desserts', emoji: '🍰', keywords: ['dessert', 'kuchen', 'cake', 'eis', 'tiramisu'] },
  { key: 'getraenk', label: 'Getränke', emoji: '🥤', keywords: ['cola', 'wasser', 'saft', 'bier', 'wein', 'getränk', 'drink'] },
];

const LEVEL_STYLE: Record<StationLevel, { bg: string; border: string; text: string; barColor: string; label: string }> = {
  idle:       { bg: 'bg-muted/30',                 border: 'border-border',              text: 'text-muted-foreground',         barColor: 'bg-muted-foreground/40', label: 'Frei'       },
  normal:     { bg: 'bg-matcha-50 dark:bg-matcha-950/20', border: 'border-matcha-200 dark:border-matcha-800', text: 'text-matcha-700 dark:text-matcha-300', barColor: 'bg-matcha-500', label: 'Normal'  },
  busy:       { bg: 'bg-amber-50 dark:bg-amber-950/20',   border: 'border-amber-200 dark:border-amber-800',   text: 'text-amber-700 dark:text-amber-300',   barColor: 'bg-amber-400',  label: 'Ausgelastet' },
  overloaded: { bg: 'bg-red-50 dark:bg-red-950/20',       border: 'border-red-200 dark:border-red-800',       text: 'text-red-700 dark:text-red-300',       barColor: 'bg-red-500',    label: 'Überlastet' },
};

function matchStation(item: Item): string {
  const name = (item.name ?? item.kategorie ?? item.category ?? '').toLowerCase();
  for (const station of STATIONS) {
    if (station.keywords.some((kw) => name.includes(kw))) return station.key;
  }
  return 'grill'; // Fallback
}

function getStationLevel(count: number): StationLevel {
  if (count === 0) return 'idle';
  if (count <= 3) return 'normal';
  if (count <= 7) return 'busy';
  return 'overloaded';
}

export function KitchenPhase685PrepStationAuslastungsBoard({ orders }: { orders: Order[] }) {
  const [open, setOpen] = useState(true);

  const stationData = useMemo(() => {
    const activeOrders = orders.filter(
      (o) => o.status && !['delivered', 'storniert', 'cancelled'].includes(o.status),
    );

    const countMap = new Map<string, number>();
    for (const o of activeOrders) {
      for (const item of o.items ?? []) {
        const stationKey = matchStation(item);
        countMap.set(stationKey, (countMap.get(stationKey) ?? 0) + (item.menge ?? item.quantity ?? 1));
      }
    }

    return STATIONS.map((station) => {
      const itemCount = countMap.get(station.key) ?? 0;
      const level = getStationLevel(itemCount);
      return { ...station, itemCount, level };
    }).sort((a, b) => {
      const order: StationLevel[] = ['overloaded', 'busy', 'normal', 'idle'];
      return order.indexOf(a.level) - order.indexOf(b.level);
    });
  }, [orders]);

  const maxCount = Math.max(1, ...stationData.map((s) => s.itemCount));
  const busyCount = stationData.filter((s) => s.level === 'busy' || s.level === 'overloaded').length;

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-orange-500 shrink-0" />
          <span className="font-semibold text-sm">Station-Auslastung</span>
          {busyCount > 0 ? (
            <span className="text-xs rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 font-bold">
              {busyCount} Station{busyCount !== 1 ? 'en' : ''} ausgelastet
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Alle Stationen normal</span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
          {stationData.map((station) => {
            const s = LEVEL_STYLE[station.level];
            const pct = maxCount > 0 ? Math.round((station.itemCount / maxCount) * 100) : 0;
            return (
              <div
                key={station.key}
                className={cn('rounded-lg border p-3', s.bg, s.border)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base leading-none">{station.emoji}</span>
                    <span className={cn('text-xs font-bold', s.text)}>{station.label}</span>
                  </div>
                  <span className={cn('text-[9px] uppercase font-black px-1.5 py-0.5 rounded-full',
                    station.level === 'idle' ? 'bg-muted text-muted-foreground' :
                    station.level === 'normal' ? 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/30 dark:text-matcha-300' :
                    station.level === 'busy' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
                  )}>
                    {s.label}
                  </span>
                </div>

                <div className={cn('text-3xl font-black tabular-nums leading-none text-center', s.text)}>
                  {station.itemCount}
                </div>
                <div className="text-[10px] text-center text-muted-foreground mb-2">
                  {station.itemCount === 1 ? 'Item aktiv' : 'Items aktiv'}
                </div>

                <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', s.barColor)}
                    style={{ width: `${pct}%` }}
                  />
                </div>

                {station.level === 'overloaded' && (
                  <div className="flex items-center gap-1 mt-1.5">
                    <Flame className="h-3 w-3 text-red-500 animate-pulse" />
                    <span className="text-[10px] text-red-600 dark:text-red-400 font-bold">Priorisieren!</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
