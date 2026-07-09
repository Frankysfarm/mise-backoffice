'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Flame, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

/**
 * Phase 997 — Kochstation-Auslastungs-Board (Kitchen)
 *
 * Live-Auslastung je Kochstation (Grill/Friteuse/Salat/Pasta)
 * basierend auf aktiven Bestellungen. Rein client-seitig.
 */

interface Order {
  id: string;
  status: string;
  items?: Array<{ name?: string; title?: string }> | null;
}

interface Props {
  orders: Order[];
}

interface Station {
  id: string;
  label: string;
  emoji: string;
  keywords: string[];
  kapazitaet: number;
}

const STATIONS: Station[] = [
  { id: 'grill', label: 'Grill', emoji: '🥩', keywords: ['burger', 'steak', 'grill', 'hähnchen', 'schnitzel', 'bratwurst', 'beef'], kapazitaet: 6 },
  { id: 'friteuse', label: 'Friteuse', emoji: '🍟', keywords: ['fries', 'pommes', 'nuggets', 'chicken', 'wings', 'onion', 'frittiert', 'fritta'], kapazitaet: 5 },
  { id: 'salat', label: 'Salat', emoji: '🥗', keywords: ['salat', 'wrap', 'bowl', 'veggie', 'vegan', 'frisch', 'caesar', 'garden'], kapazitaet: 4 },
  { id: 'pasta', label: 'Pasta/Sauce', emoji: '🍝', keywords: ['pasta', 'nudeln', 'spaghetti', 'pizza', 'sauce', 'tomaten', 'carbonara', 'penne'], kapazitaet: 5 },
  { id: 'suppe', label: 'Suppe/Eintopf', emoji: '🍲', keywords: ['suppe', 'eintopf', 'curry', 'ramen', 'pho', 'brühe', 'chili', 'stew'], kapazitaet: 3 },
];

function itemName(item: { name?: string; title?: string }): string {
  return (item.name ?? item.title ?? '').toLowerCase();
}

function countForStation(orders: Order[], station: Station): number {
  const active = orders.filter(o => ['neu', 'bestätigt', 'confirmed', 'preparing', 'in_preparation'].includes(o.status));
  let count = 0;
  for (const order of active) {
    const names = (order.items ?? []).map(itemName).join(' ');
    if (station.keywords.some(k => names.includes(k))) count++;
  }
  return count;
}

function auslastungStyle(pct: number): { bar: string; badge: string; label: string } {
  if (pct >= 90) return { bar: 'bg-red-500', badge: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-300', label: 'Überlastet' };
  if (pct >= 70) return { bar: 'bg-amber-500', badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-300', label: 'Hoch' };
  if (pct >= 40) return { bar: 'bg-matcha-500', badge: 'bg-matcha-100 dark:bg-matcha-900/30 text-matcha-700 dark:text-matcha-300 border-matcha-300', label: 'Mittel' };
  return { bar: 'bg-zinc-400', badge: 'bg-zinc-100 dark:bg-zinc-800/30 text-zinc-600 dark:text-zinc-400 border-zinc-300', label: 'Niedrig' };
}

export function KitchenPhase997KochstationAuslastungsBoard({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const stations = useMemo(() => {
    return STATIONS.map(s => {
      const aktiv = countForStation(orders, s);
      const pct = Math.round((aktiv / s.kapazitaet) * 100);
      return { ...s, aktiv, pct };
    }).sort((a, b) => b.pct - a.pct);
  }, [orders]);

  const ueberlastet = stations.filter(s => s.pct >= 90).length;
  const hoch = stations.filter(s => s.pct >= 70 && s.pct < 90).length;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-semibold">Kochstation-Auslastung</span>
          {ueberlastet > 0 && (
            <span className="ml-1 flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-300 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300 animate-pulse">
              <AlertTriangle className="h-3 w-3" />
              {ueberlastet}× Überlastet
            </span>
          )}
          {ueberlastet === 0 && hoch > 0 && (
            <span className="ml-1 rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:text-amber-300">
              {hoch}× Hoch
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {stations.map(s => {
            const style = auslastungStyle(s.pct);
            return (
              <div key={s.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-base leading-none">{s.emoji}</span>
                    <span className="text-sm font-medium">{s.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{s.aktiv}/{s.kapazitaet}</span>
                    <span className={cn('rounded-full border px-1.5 py-0.5 text-[10px] font-bold', style.badge)}>
                      {style.label}
                    </span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', style.bar)}
                    style={{ width: `${Math.min(100, s.pct)}%` }}
                  />
                </div>
              </div>
            );
          })}
          {orders.filter(o => ['neu', 'bestätigt', 'confirmed', 'preparing', 'in_preparation'].includes(o.status)).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">Keine aktiven Bestellungen — alle Stationen frei.</p>
          )}
        </div>
      )}
    </div>
  );
}
