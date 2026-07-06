'use client';

/**
 * Phase 561 — Kitchen: Bestell-Parallel-Optimierer
 *
 * Analysiert aktive Bestellungen und gibt Hinweise wie sie parallel
 * zubereitet werden können um den Durchsatz zu maximieren.
 *
 * Logik:
 *   - Gruppiert Bestellungen nach Küchen-Station (Grill, Fritteusen, Kalt, etc.)
 *   - Identifiziert: welche Bestellungen gleichzeitig gestartet werden können
 *   - Zeigt "Jetzt starten" Cluster: Bestellungen die jetzt parallel passen
 *   - Alert wenn zu viele Bestellungen auf eine Station warten
 *
 * Stations-Typen (per Item-Name heuristisch):
 *   grill      → Burger, Steak, Wrap, Grill
 *   fritteuse  → Pommes, Nuggets, Wings, Fries
 *   kalt       → Salat, Bowl, Dessert
 *   allgemein  → alle anderen
 */

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Layers, AlertCircle, Zap } from 'lucide-react';

type Station = 'grill' | 'fritteuse' | 'kalt' | 'allgemein';

interface OrderItem {
  name: string;
  quantity?: number | null;
}

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  items?: OrderItem[] | null;
}

interface Timing {
  order_id: string;
  status: string;
  cook_start_at: string | null;
}

interface StationGroup {
  station: Station;
  label: string;
  orders: Order[];
  maxParallel: number;
  icon: string;
}

interface Props {
  orders: Order[];
  timings?: Timing[];
}

const STATION_CONFIG: Record<Station, { label: string; icon: string; maxParallel: number; color: string }> = {
  grill:     { label: 'Grill',     icon: '🔥', maxParallel: 3, color: 'bg-orange-50 border-orange-200 text-orange-800' },
  fritteuse: { label: 'Fritteuse', icon: '⚡', maxParallel: 4, color: 'bg-amber-50 border-amber-200 text-amber-800' },
  kalt:      { label: 'Kalt',      icon: '❄️', maxParallel: 6, color: 'bg-blue-50 border-blue-200 text-blue-800' },
  allgemein: { label: 'Allgemein', icon: '🍽️', maxParallel: 5, color: 'bg-gray-50 border-gray-200 text-gray-800' },
};

const GRILL_KEYWORDS   = ['burger', 'steak', 'wrap', 'grill', 'schnitzel', 'filet', 'hähnchen', 'chicken'];
const FRITTEUSEN_KEYWORDS = ['pommes', 'fries', 'nuggets', 'wings', 'wedges', 'fritten', 'onion'];
const KALT_KEYWORDS    = ['salat', 'bowl', 'dessert', 'eis', 'tiramisu', 'mousse'];

function classifyOrder(order: Order): Station {
  const text = (order.items ?? [])
    .map(i => i.name.toLowerCase())
    .join(' ');
  if (GRILL_KEYWORDS.some(k => text.includes(k)))      return 'grill';
  if (FRITTEUSEN_KEYWORDS.some(k => text.includes(k))) return 'fritteuse';
  if (KALT_KEYWORDS.some(k => text.includes(k)))        return 'kalt';
  return 'allgemein';
}

function formatWaiting(bestelltAm: string | null): string {
  if (!bestelltAm) return '';
  const min = Math.round((Date.now() - new Date(bestelltAm).getTime()) / 60_000);
  return `${min}m`;
}

export function KitchenPhase561ParallelOptimierer({ orders, timings = [] }: Props) {
  const [open, setOpen] = useState(true);

  const activeOrders = useMemo(() =>
    orders.filter(o => o.status === 'bestätigt' || o.status === 'neu' || o.status === 'in_zubereitung'),
    [orders],
  );

  const cookingOrderIds = useMemo(() =>
    new Set(timings.filter(t => t.cook_start_at && t.status !== 'ready').map(t => t.order_id)),
    [timings],
  );

  const waitingOrders = useMemo(() =>
    activeOrders.filter(o => !cookingOrderIds.has(o.id)),
    [activeOrders, cookingOrderIds],
  );

  const stations = useMemo<StationGroup[]>(() => {
    const groups = new Map<Station, Order[]>();
    for (const o of waitingOrders) {
      const station = classifyOrder(o);
      const list = groups.get(station) ?? [];
      list.push(o);
      groups.set(station, list);
    }
    return (Object.entries(groups) as [Station, Order[]][]).map(([station, ords]) => ({
      station,
      label:       STATION_CONFIG[station].label,
      orders:      ords,
      maxParallel: STATION_CONFIG[station].maxParallel,
      icon:        STATION_CONFIG[station].icon,
    })).sort((a, b) => b.orders.length - a.orders.length);
  }, [waitingOrders]);

  const overloadedStations = stations.filter(s => s.orders.length > s.maxParallel);
  const parallelBatches    = stations.filter(s => s.orders.length > 0 && s.orders.length <= s.maxParallel);

  if (activeOrders.length === 0) return null;

  return (
    <Card className={cn('overflow-hidden', overloadedStations.length > 0 && 'border-orange-300')}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors"
      >
        <div className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full shrink-0',
          overloadedStations.length > 0 ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700',
        )}>
          <Layers className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground flex items-center gap-2">
            Parallel-Optimierer
            {overloadedStations.length > 0 && (
              <span className="rounded-full bg-orange-500 text-white px-2 py-0.5 text-[10px] font-black">
                {overloadedStations.length} Station{overloadedStations.length > 1 ? 'en' : ''} überlastet
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {waitingOrders.length} wartend · {cookingOrderIds.size} in Zubereitung
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="p-4 space-y-3">
          {waitingOrders.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-2">
              Alle aktiven Bestellungen befinden sich bereits in Zubereitung.
            </div>
          ) : (
            <>
              {/* Overloaded station alerts */}
              {overloadedStations.map(s => (
                <div key={s.station} className={cn(
                  'flex items-start gap-3 rounded-xl border p-3',
                  STATION_CONFIG[s.station].color,
                )}>
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <div className="text-[12px] font-bold">
                      {s.icon} {s.label}: {s.orders.length} Bestellungen — Max {s.maxParallel} parallel
                    </div>
                    <div className="text-[11px] mt-0.5">
                      {s.orders.length - s.maxParallel} Bestellung{s.orders.length - s.maxParallel > 1 ? 'en' : ''} müssen warten.
                      Priorisiere älteste zuerst.
                    </div>
                  </div>
                </div>
              ))}

              {/* Parallel start recommendations */}
              {parallelBatches.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Zap className="h-3 w-3 text-emerald-600" />
                    Jetzt gleichzeitig starten
                  </div>
                  {parallelBatches.map(s => (
                    <div key={s.station} className={cn(
                      'rounded-xl border p-3 space-y-2',
                      STATION_CONFIG[s.station].color,
                    )}>
                      <div className="text-[11px] font-bold">
                        {s.icon} {s.label} — {s.orders.length} Bestellungen parallel möglich
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {s.orders.map(o => (
                          <div key={o.id} className="flex items-center gap-1 rounded-lg bg-white/70 border border-white px-2 py-1">
                            <span className="text-[10px] font-black font-mono">#{o.bestellnummer}</span>
                            {o.bestellt_am && (
                              <span className="text-[9px] text-muted-foreground">
                                {formatWaiting(o.bestellt_am)}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Station summary */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(['grill', 'fritteuse', 'kalt', 'allgemein'] as Station[]).map(station => {
                  const count = stations.find(s => s.station === station)?.orders.length ?? 0;
                  const cfg   = STATION_CONFIG[station];
                  const overloaded = count > cfg.maxParallel;
                  return (
                    <div
                      key={station}
                      className={cn(
                        'rounded-xl border p-2.5 text-center',
                        overloaded ? cfg.color : 'bg-muted/50 border-border',
                      )}
                    >
                      <div className="text-base">{cfg.icon}</div>
                      <div className={cn('text-sm font-black tabular-nums', overloaded ? '' : 'text-foreground')}>
                        {count}
                      </div>
                      <div className="text-[9px] text-muted-foreground">{cfg.label}</div>
                      <div className="text-[8px] text-muted-foreground">max {cfg.maxParallel}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
