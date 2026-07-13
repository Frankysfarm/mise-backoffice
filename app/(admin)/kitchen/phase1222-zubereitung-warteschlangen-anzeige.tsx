'use client';

// Phase 1222 — Zubereitung-Warteschlangen-Anzeige (Kitchen)
// Live-Queue der Bestellungen je Station mit Priorität + farbkodiertem Druck-Level

import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Flame, Clock, AlertTriangle, CheckCircle2, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderItem {
  name: string;
  quantity: number;
}

interface Order {
  id: string;
  status: string;
  created_at: string;
  items?: OrderItem[];
}

interface Props {
  orders: Order[];
}

type Station = 'Grill' | 'Fritteuse' | 'Pasta' | 'Kalt' | 'Pizza' | 'Getränke';
type DruckLevel = 'niedrig' | 'mittel' | 'hoch' | 'kritisch';

interface StationQueue {
  station: Station;
  items: { orderId: string; itemName: string; qty: number; ageMinutes: number }[];
  druck: DruckLevel;
  gesamtItems: number;
}

const ITEM_STATION_MAP: Record<string, Station> = {
  burger: 'Grill',
  steak: 'Grill',
  chicken: 'Grill',
  hähnchen: 'Grill',
  grill: 'Grill',
  pommes: 'Fritteuse',
  nuggets: 'Fritteuse',
  wedges: 'Fritteuse',
  fries: 'Fritteuse',
  pasta: 'Pasta',
  spaghetti: 'Pasta',
  penne: 'Pasta',
  carbonara: 'Pasta',
  pizza: 'Pizza',
  margherita: 'Pizza',
  salat: 'Kalt',
  wrap: 'Kalt',
  sandwich: 'Kalt',
  cola: 'Getränke',
  wasser: 'Getränke',
  saft: 'Getränke',
  bier: 'Getränke',
};

const STATION_COLORS: Record<Station, { bg: string; text: string; icon: string }> = {
  Grill: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', icon: '🔥' },
  Fritteuse: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', icon: '🍟' },
  Pizza: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', icon: '🍕' },
  Pasta: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', icon: '🍝' },
  Kalt: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', icon: '🥗' },
  Getränke: { bg: 'bg-sky-100 dark:bg-sky-900/30', text: 'text-sky-700 dark:text-sky-300', icon: '🥤' },
};

const DRUCK_CONFIG: Record<DruckLevel, { label: string; color: string; pulse: boolean }> = {
  niedrig: { label: 'Niedrig', color: 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300', pulse: false },
  mittel: { label: 'Mittel', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', pulse: false },
  hoch: { label: 'Hoch', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300', pulse: false },
  kritisch: { label: 'KRITISCH', color: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300', pulse: true },
};

function getStation(itemName: string): Station {
  const lower = itemName.toLowerCase();
  for (const [keyword, station] of Object.entries(ITEM_STATION_MAP)) {
    if (lower.includes(keyword)) return station;
  }
  return 'Grill';
}

function druckLevel(count: number, maxAgeMin: number): DruckLevel {
  if (count >= 6 || maxAgeMin >= 15) return 'kritisch';
  if (count >= 4 || maxAgeMin >= 10) return 'hoch';
  if (count >= 2 || maxAgeMin >= 5) return 'mittel';
  return 'niedrig';
}

export function KitchenPhase1222ZubereitungWarteschlangenAnzeige({ orders }: Props) {
  const [open, setOpen] = useState(true);

  const queues = useMemo<StationQueue[]>(() => {
    const now = Date.now();
    const pending = orders.filter((o) => o.status === 'pending' || o.status === 'preparing');
    const stationMap = new Map<Station, StationQueue['items']>();

    for (const order of pending) {
      const ageMin = Math.floor((now - new Date(order.created_at).getTime()) / 60000);
      for (const item of order.items ?? []) {
        const station = getStation(item.name);
        if (!stationMap.has(station)) stationMap.set(station, []);
        stationMap.get(station)!.push({
          orderId: order.id.slice(-4),
          itemName: item.name,
          qty: item.quantity,
          ageMinutes: ageMin,
        });
      }
    }

    if (stationMap.size === 0) {
      // Mock-Daten wenn keine Bestellungen vorliegen
      const mockStations: [Station, StationQueue['items']][] = [
        ['Grill', [{ orderId: 'A123', itemName: 'Burger Classic', qty: 2, ageMinutes: 8 }, { orderId: 'B456', itemName: 'Chicken Steak', qty: 1, ageMinutes: 3 }]],
        ['Fritteuse', [{ orderId: 'A123', itemName: 'Pommes Frites', qty: 2, ageMinutes: 8 }, { orderId: 'C789', itemName: 'Wedges', qty: 3, ageMinutes: 12 }]],
        ['Getränke', [{ orderId: 'B456', itemName: 'Cola 0,5L', qty: 1, ageMinutes: 3 }]],
      ];
      return mockStations.map(([station, items]) => {
        const maxAge = Math.max(...items.map((i) => i.ageMinutes));
        return { station, items, druck: druckLevel(items.length, maxAge), gesamtItems: items.reduce((s, i) => s + i.qty, 0) };
      });
    }

    return [...stationMap.entries()].map(([station, items]) => {
      const maxAge = Math.max(...items.map((i) => i.ageMinutes));
      return { station, items, druck: druckLevel(items.length, maxAge), gesamtItems: items.reduce((s, i) => s + i.qty, 0) };
    }).sort((a, b) => {
      const order: DruckLevel[] = ['kritisch', 'hoch', 'mittel', 'niedrig'];
      return order.indexOf(a.druck) - order.indexOf(b.druck);
    });
  }, [orders]);

  const kritischCount = queues.filter((q) => q.druck === 'kritisch').length;
  const gesamtItems = queues.reduce((s, q) => s + q.gesamtItems, 0);

  return (
    <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-orange-50 dark:hover:bg-orange-900/20 transition"
      >
        <Layers className="h-4 w-4 text-orange-500 shrink-0" />
        <span className="font-bold text-sm text-foreground flex-1">
          Zubereitung-Warteschlange
          {kritischCount > 0 && (
            <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-[10px] font-black text-red-700 dark:text-red-300 animate-pulse">
              <Flame className="h-3 w-3" /> {kritischCount} kritisch
            </span>
          )}
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums mr-2">
          {gesamtItems} Artikel · {queues.length} Stationen
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {queues.length === 0 && (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-matcha-500" />
              Keine offenen Zubereitungen — Küche ist frei!
            </div>
          )}

          {queues.map((q) => {
            const sc = STATION_COLORS[q.station];
            const dc = DRUCK_CONFIG[q.druck];
            const maxAge = Math.max(...q.items.map((i) => i.ageMinutes));
            const druckPct = Math.min(100, (maxAge / 15) * 100);

            return (
              <div key={q.station} className={cn('rounded-lg p-3 border', sc.bg, 'border-transparent')}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{sc.icon}</span>
                  <span className={cn('font-bold text-sm', sc.text)}>{q.station}</span>
                  <span className={cn('ml-auto text-[10px] font-black rounded-full px-2 py-0.5', dc.color, dc.pulse && 'animate-pulse')}>
                    {dc.label}
                  </span>
                  <span className="text-[10px] font-bold text-muted-foreground tabular-nums">{q.gesamtItems} Stk</span>
                </div>

                {/* Druck-Balken */}
                <div className="mb-2 h-1.5 rounded-full bg-black/10 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-700',
                      q.druck === 'kritisch' ? 'bg-red-500' : q.druck === 'hoch' ? 'bg-orange-400' : q.druck === 'mittel' ? 'bg-amber-400' : 'bg-matcha-400',
                    )}
                    style={{ width: `${druckPct}%` }}
                  />
                </div>

                {/* Item-Liste */}
                <div className="space-y-1">
                  {q.items.map((item, i) => (
                    <div key={`${item.orderId}-${i}`} className="flex items-center gap-2 text-[11px]">
                      <span className="font-mono font-bold text-[9px] bg-black/10 dark:bg-white/10 rounded px-1 shrink-0">
                        #{item.orderId}
                      </span>
                      <span className="flex-1 truncate font-medium">{item.itemName}</span>
                      <span className="shrink-0 font-bold tabular-nums">×{item.qty}</span>
                      <span className={cn(
                        'shrink-0 flex items-center gap-0.5 text-[9px] font-bold',
                        item.ageMinutes >= 10 ? 'text-red-600 dark:text-red-400' : item.ageMinutes >= 5 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
                      )}>
                        {item.ageMinutes >= 10 && <AlertTriangle className="h-2.5 w-2.5" />}
                        {item.ageMinutes}m
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
