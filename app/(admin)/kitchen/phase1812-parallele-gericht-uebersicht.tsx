'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Layers, AlertTriangle, CheckCircle2 } from 'lucide-react';

/**
 * Phase 1812 — Parallele-Gericht-Übersicht (Kitchen)
 *
 * Zeigt wie viele gleiche Gerichte gleichzeitig zubereitet werden.
 * Ampel grün/gelb/rot je Gericht vs. Stationskapazität (max 3 parallel).
 * Props-basiert, useMemo, Collapsible.
 */

interface OrderItem {
  name?: string;
  title?: string;
  menge?: number;
  quantity?: number;
}

interface Order {
  id: string;
  status: string;
  items?: OrderItem[] | null;
  artikel?: OrderItem[] | null;
  positionen?: OrderItem[] | null;
}

interface Props {
  orders: Order[];
  maxParallel?: number;
}

const KOCHSTATUSES = [
  'neu', 'bestätigt', 'eingegangen', 'accepted', 'confirmed',
  'in_zubereitung', 'zubereitung', 'preparing', 'in_preparation',
];

interface GerichtInfo {
  name: string;
  anzahl: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

export function KitchenPhase1812ParalleleGerichtUebersicht({ orders, maxParallel = 3 }: Props) {
  const [collapsed, setCollapsed] = useState(false);

  const gerichte = useMemo<GerichtInfo[]>(() => {
    const aktive = orders.filter((o) => KOCHSTATUSES.includes(o.status));
    const counts = new Map<string, number>();

    for (const order of aktive) {
      const items = order.items ?? order.artikel ?? order.positionen ?? [];
      for (const item of items) {
        const name = item.name ?? item.title ?? '—';
        const menge = item.menge ?? item.quantity ?? 1;
        counts.set(name, (counts.get(name) ?? 0) + menge);
      }
    }

    return Array.from(counts.entries())
      .map(([name, anzahl]) => ({
        name,
        anzahl,
        ampel: anzahl > maxParallel ? 'rot' : anzahl === maxParallel ? 'gelb' : 'gruen',
      }))
      .sort((a, b) => b.anzahl - a.anzahl);
  }, [orders, maxParallel]);

  const ueberlastete = gerichte.filter((g) => g.ampel === 'rot').length;

  if (gerichte.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden mb-3">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-matcha-600" />
          <span className="font-semibold text-sm">Parallele Gerichte</span>
          {ueberlastete > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-medium">
              <AlertTriangle className="h-3 w-3" />
              {ueberlastete} überlastet
            </span>
          )}
          {ueberlastete === 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">
              <CheckCircle2 className="h-3 w-3" />
              Alles im Rahmen
            </span>
          )}
        </div>
        {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-xs text-muted-foreground mb-3">
            Max. {maxParallel} gleiche Gerichte parallel · Rot = Kapazitätsgrenze überschritten
          </p>
          {gerichte.map((g) => (
            <div key={g.name} className="flex items-center gap-3">
              <span
                className={cn(
                  'h-2.5 w-2.5 rounded-full flex-shrink-0',
                  g.ampel === 'gruen' && 'bg-emerald-500',
                  g.ampel === 'gelb' && 'bg-amber-400',
                  g.ampel === 'rot' && 'bg-red-500',
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-sm font-medium truncate">{g.name}</span>
                  <span
                    className={cn(
                      'text-xs font-bold',
                      g.ampel === 'gruen' && 'text-emerald-600',
                      g.ampel === 'gelb' && 'text-amber-600',
                      g.ampel === 'rot' && 'text-red-600',
                    )}
                  >
                    {g.anzahl}×
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      g.ampel === 'gruen' && 'bg-emerald-500',
                      g.ampel === 'gelb' && 'bg-amber-400',
                      g.ampel === 'rot' && 'bg-red-500',
                    )}
                    style={{ width: `${Math.min(100, (g.anzahl / (maxParallel + 1)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
