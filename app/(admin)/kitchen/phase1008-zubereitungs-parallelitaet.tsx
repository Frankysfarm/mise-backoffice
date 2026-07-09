'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, ChevronDown, ChevronUp, Flame } from 'lucide-react';

/**
 * Phase 1008 — Zubereitungs-Parallelitäts-Monitor (Kitchen)
 *
 * Alert wenn >3 Bestellungen die selbe Kochstation gleichzeitig benötigen.
 * Rein client-seitig basierend auf aktiven Orders.
 */

interface OrderItem {
  name?: string;
  title?: string;
  quantity?: number;
}

interface Order {
  id: string;
  status: string;
  items?: OrderItem[] | null;
}

interface Props {
  orders: Order[];
}

interface Station {
  name: string;
  emoji: string;
  keywords: string[];
  kapazitaet: number;
}

const STATIONEN: Station[] = [
  { name: 'Grill', emoji: '🔥', keywords: ['burger', 'steak', 'grill', 'schnitzel', 'roulade', 'gegrillte'], kapazitaet: 3 },
  { name: 'Friteuse', emoji: '🍟', keywords: ['pommes', 'frit', 'nugget', 'wedge', 'crispy', 'gebacken'], kapazitaet: 3 },
  { name: 'Pasta', emoji: '🍝', keywords: ['pasta', 'risotto', 'ramen', 'nudel', 'spaghetti', 'penne'], kapazitaet: 3 },
  { name: 'Salat', emoji: '🥗', keywords: ['salat', 'wrap', 'bowl'], kapazitaet: 4 },
  { name: 'Suppe', emoji: '🍲', keywords: ['suppe', 'eintopf', 'brühe', 'curry', 'chili'], kapazitaet: 3 },
];

const ACTIVE_STATUSES = ['neu', 'bestätigt', 'confirmed', 'preparing', 'in_preparation'];

interface StationLoad {
  station: Station;
  bestellungen: number;
  ueberlastet: boolean;
}

export function KitchenPhase1008ZubereitungsParallelitaet({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const loads: StationLoad[] = useMemo(() => {
    const active = orders.filter(o => ACTIVE_STATUSES.includes(o.status));

    return STATIONEN.map(station => {
      let count = 0;
      for (const order of active) {
        const itemNames = (order.items ?? [])
          .map(i => (i.name ?? i.title ?? '').toLowerCase())
          .join(' ');
        if (station.keywords.some(kw => itemNames.includes(kw))) {
          count++;
        }
      }
      return {
        station,
        bestellungen: count,
        ueberlastet: count > station.kapazitaet,
      };
    }).sort((a, b) => b.bestellungen - a.bestellungen);
  }, [orders]);

  const ueberlastetCount = loads.filter(l => l.ueberlastet).length;
  const maxLoad = Math.max(...loads.map(l => l.bestellungen), 1);

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <ChefHat className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-bold">Parallelitäts-Monitor</span>
          {ueberlastetCount > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700 border border-red-300 animate-pulse">
              <Flame className="h-2.5 w-2.5" />
              {ueberlastetCount} überlastet
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {loads.map(({ station, bestellungen, ueberlastet }) => {
            const pct = Math.min(100, Math.round((bestellungen / Math.max(station.kapazitaet * 2, maxLoad)) * 100));
            const barColor = ueberlastet
              ? 'bg-red-500'
              : bestellungen === station.kapazitaet
              ? 'bg-amber-400'
              : 'bg-matcha-500';
            const textColor = ueberlastet ? 'text-red-700' : bestellungen === station.kapazitaet ? 'text-amber-700' : 'text-matcha-700';

            return (
              <div
                key={station.name}
                className={cn(
                  'rounded-lg border p-2.5',
                  ueberlastet ? 'border-red-300 bg-red-50/50' : 'border-border bg-muted/10',
                )}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{station.emoji}</span>
                    <span className="text-xs font-bold">{station.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {ueberlastet && (
                      <span className="text-[9px] font-black text-red-700 bg-red-100 border border-red-300 rounded-full px-1.5 py-0.5 animate-pulse">
                        ÜBERLASTET
                      </span>
                    )}
                    <span className={cn('text-xs font-black tabular-nums', textColor)}>
                      {bestellungen}/{station.kapazitaet}
                    </span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-500', barColor)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-muted-foreground text-right">
            Kapazitäts-Alert bei &gt;{STATIONEN[0]?.kapazitaet ?? 3} parallelen Bestellungen je Station
          </p>
        </div>
      )}
    </div>
  );
}
