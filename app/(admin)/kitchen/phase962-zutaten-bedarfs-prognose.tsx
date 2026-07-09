'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, ChevronDown, ChevronUp, Package } from 'lucide-react';

/**
 * Phase 962 — Zutaten-Bedarfs-Prognose (Kitchen)
 *
 * Vorausschauende Bedarfswarnung je Zutat basierend auf aktuellen + geplanten Bestellungen.
 * Client-seitig via useMemo. Keine API nötig.
 */

interface OrderItem {
  name?: string | null;
  artikel?: string | null;
  title?: string | null;
  quantity?: number | null;
  menge?: number | null;
  count?: number | null;
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
}

interface ZutatenBedarf {
  zutat: string;
  benoetigtPortionen: number;
  stufe: 'kritisch' | 'warnung' | 'ok';
  emoji: string;
}

const ACTIVE_STATUSES = [
  'neu', 'new', 'pending', 'bestätigt', 'confirmed',
  'zubereitung', 'in_preparation', 'preparing', 'in_kitchen',
];

// Zutat-Schlüsselwörter → bekannte Zutat
const ZUTAT_MAP: Array<{ keywords: string[]; zutat: string; emoji: string }> = [
  { keywords: ['pizza', 'flammkuchen', 'focaccia'], zutat: 'Teig', emoji: '🫓' },
  { keywords: ['burger', 'sandwich', 'wrap', 'bun'], zutat: 'Brot/Brötchen', emoji: '🍞' },
  { keywords: ['pasta', 'spaghetti', 'penne', 'rigatoni', 'nudel'], zutat: 'Pasta', emoji: '🍝' },
  { keywords: ['salat', 'salad', 'bowl'], zutat: 'Salat', emoji: '🥗' },
  { keywords: ['suppe', 'soup', 'eintopf', 'brühe'], zutat: 'Suppenbasis', emoji: '🍲' },
  { keywords: ['steak', 'schnitzel', 'fleisch', 'hähnchen', 'chicken', 'rind', 'lamm'], zutat: 'Fleisch', emoji: '🥩' },
  { keywords: ['fisch', 'lachs', 'thunfisch', 'shrimps', 'garnele'], zutat: 'Fisch/Meeresfrüchte', emoji: '🐟' },
  { keywords: ['käse', 'mozzarella', 'parmesan', 'feta', 'gouda'], zutat: 'Käse', emoji: '🧀' },
  { keywords: ['ei', 'egg', 'omelette', 'rührei'], zutat: 'Eier', emoji: '🥚' },
  { keywords: ['reis', 'rice', 'risotto', 'fried rice'], zutat: 'Reis', emoji: '🍚' },
  { keywords: ['tomate', 'tomato', 'tomatensauce'], zutat: 'Tomaten', emoji: '🍅' },
  { keywords: ['avocado', 'guacamole'], zutat: 'Avocado', emoji: '🥑' },
];

function extractZutaten(orders: Order[]): Map<string, { portionen: number; emoji: string }> {
  const bedarf = new Map<string, { portionen: number; emoji: string }>();

  for (const order of orders) {
    if (!ACTIVE_STATUSES.includes(order.status)) continue;
    const items = order.items ?? order.artikel ?? order.positionen ?? [];

    for (const item of items) {
      const name = (item.name ?? item.artikel ?? item.title ?? '').toLowerCase();
      const menge = item.quantity ?? item.menge ?? item.count ?? 1;

      for (const { keywords, zutat, emoji } of ZUTAT_MAP) {
        if (keywords.some(k => name.includes(k))) {
          const prev = bedarf.get(zutat) ?? { portionen: 0, emoji };
          bedarf.set(zutat, { portionen: prev.portionen + menge, emoji });
        }
      }
    }
  }

  return bedarf;
}

function getStufe(portionen: number): ZutatenBedarf['stufe'] {
  if (portionen >= 15) return 'kritisch';
  if (portionen >= 8) return 'warnung';
  return 'ok';
}

export function KitchenPhase962ZutatenBedarfsPrognose({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const bedarfListe = useMemo<ZutatenBedarf[]>(() => {
    const map = extractZutaten(orders);
    return Array.from(map.entries())
      .map(([zutat, { portionen, emoji }]) => ({
        zutat,
        benoetigtPortionen: portionen,
        stufe: getStufe(portionen),
        emoji,
      }))
      .sort((a, b) => b.benoetigtPortionen - a.benoetigtPortionen);
  }, [orders]);

  const kritisch = bedarfListe.filter(z => z.stufe === 'kritisch');
  const warnung = bedarfListe.filter(z => z.stufe === 'warnung');

  if (bedarfListe.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 mb-4">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-amber-600" />
          <span className="font-semibold text-sm text-amber-900 dark:text-amber-100">
            Zutaten-Bedarfsprognose
          </span>
          {kritisch.length > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white animate-pulse">
              {kritisch.length} Kritisch
            </span>
          )}
          {warnung.length > 0 && (
            <span className="rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
              {warnung.length} Warnung
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-amber-600" /> : <ChevronDown className="h-4 w-4 text-amber-600" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {bedarfListe.map(item => (
            <div
              key={item.zutat}
              className={cn(
                'flex items-center justify-between rounded-lg px-3 py-2 text-sm',
                item.stufe === 'kritisch' && 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700',
                item.stufe === 'warnung' && 'bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700',
                item.stufe === 'ok' && 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700',
              )}
            >
              <div className="flex items-center gap-2">
                <span>{item.emoji}</span>
                <span className="font-medium">{item.zutat}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{item.benoetigtPortionen} Portionen</span>
                {item.stufe === 'kritisch' && (
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500 animate-pulse" />
                )}
                {item.stufe === 'warnung' && (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                )}
              </div>
            </div>
          ))}

          <p className="text-xs text-muted-foreground pt-1">
            Basierend auf aktiven Bestellungen · Kritisch ≥15 Portionen · Warnung ≥8 Portionen
          </p>
        </div>
      )}
    </div>
  );
}
