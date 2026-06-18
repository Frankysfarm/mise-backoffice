'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Flame, Snowflake, Wind, Drumstick, UtensilsCrossed, Clock, AlertTriangle } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  kunde_name: string;
  items: { id: string; name: string; menge: number; notiz: string | null; extras: unknown; gang?: number | null }[];
  geschaetzte_zubereitung_min: number | null;
  bestellt_am: string | null;
};

type KitchenTiming = {
  id: string;
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
};

interface Props {
  orders: Order[];
  timings: KitchenTiming[];
}

type StationKey = 'Grill/Fleisch' | 'Frittüre' | 'Kühl/Kalt' | 'Backofen' | 'Vorbereitung';

const STATION_KEYWORDS: Record<StationKey, string[]> = {
  'Grill/Fleisch': ['steak', 'burger', 'ribs', 'chicken', 'hähnchen', 'fleisch', 'grill'],
  'Frittüre':     ['pommes', 'fries', 'nuggets', 'crispy', 'frittiert'],
  'Kühl/Kalt':    ['salat', 'sushi', 'carpaccio', 'tartare', 'kalt'],
  'Backofen':     ['pizza', 'lasagne', 'auflauf', 'brot', 'ofen'],
  'Vorbereitung': ['vorspeise', 'starter', 'soup', 'suppe'],
};

const STATION_ICONS: Record<StationKey, React.ReactNode> = {
  'Grill/Fleisch': <Flame className="w-3 h-3" />,
  'Frittüre':     <Wind className="w-3 h-3" />,
  'Kühl/Kalt':    <Snowflake className="w-3 h-3" />,
  'Backofen':     <Drumstick className="w-3 h-3" />,
  'Vorbereitung': <UtensilsCrossed className="w-3 h-3" />,
};

function detectStation(items: Order['items']): StationKey {
  const text = items.map(i => i.name.toLowerCase()).join(' ');
  const scores = Object.entries(STATION_KEYWORDS).map(([station, keywords]) => ({
    station: station as StationKey,
    score: keywords.reduce((n, kw) => n + (text.includes(kw) ? 1 : 0), 0),
  }));
  const best = scores.reduce((a, b) => (b.score > a.score ? b : a));
  return best.score > 0 ? best.station : 'Vorbereitung';
}

function secsLeft(timing: KitchenTiming | undefined, now: number): number {
  if (!timing?.ready_target) return Infinity;
  return Math.floor((new Date(timing.ready_target).getTime() - now) / 1000);
}

type Urgency = 'ok' | 'warn' | 'urgent';

function urgency(secs: number): Urgency {
  if (secs === Infinity) return 'ok';
  if (secs > 600) return 'ok';
  if (secs > 300) return 'warn';
  return 'urgent';
}

function fmtCountdown(secs: number): string {
  if (secs === Infinity) return '--:--';
  const sign = secs < 0 ? '-' : '';
  const abs = Math.abs(secs);
  const m = Math.floor(abs / 60).toString().padStart(2, '0');
  const s = (abs % 60).toString().padStart(2, '0');
  return `${sign}${m}:${s}`;
}

function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len - 1) + '…' : str;
}

type ActiveOrder = Order & { timing: KitchenTiming | undefined; station: StationKey };

export function KitchenLivePrepMatrix({ orders, timings }: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const timingMap = new Map(timings.map(t => [t.order_id, t]));

  const active: ActiveOrder[] = orders
    .filter(o => o.status === 'in_zubereitung' || o.status === 'bestätigt')
    .map(o => ({ ...o, timing: timingMap.get(o.id), station: detectStation(o.items) }));

  if (active.length < 2) return null;

  // Group by station
  const stationMap = new Map<StationKey, ActiveOrder[]>();
  for (const o of active) {
    const list = stationMap.get(o.station) ?? [];
    list.push(o);
    stationMap.set(o.station, list);
  }

  const stations = (Object.keys(STATION_KEYWORDS) as StationKey[]).filter(s => stationMap.has(s));

  return (
    <div className="rounded-xl border border-matcha-700/40 bg-matcha-900/80 dark:bg-matcha-900/90 backdrop-blur-sm p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-matcha-50 font-semibold text-sm">
          <Clock className="w-4 h-4 text-matcha-500" />
          Stations-Belastung
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {stations.map(s => (
            <span
              key={s}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-matcha-800/70 text-matcha-300 text-xs"
            >
              {STATION_ICONS[s]}
              <span className="hidden sm:inline">{s}</span>
              <span className="font-bold text-matcha-50">{stationMap.get(s)!.length}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Station grids */}
      <div className="space-y-2">
        {stations.map(station => {
          const stationOrders = stationMap.get(station)!;
          const displayed = stationOrders.slice(0, 2);

          return (
            <div key={station} className="space-y-1">
              <div className="flex items-center gap-1 text-matcha-400 text-xs font-medium px-0.5">
                {STATION_ICONS[station]}
                <span>{station}</span>
                {stationOrders.length > 2 && (
                  <span className="ml-1 text-matcha-600">+{stationOrders.length - 2} weitere</span>
                )}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5">
                {displayed.map(o => {
                  const secs = secsLeft(o.timing, now);
                  const u = urgency(secs);
                  const totalItems = o.items.reduce((n, i) => n + i.menge, 0);

                  return (
                    <div
                      key={o.id}
                      className={cn(
                        'rounded-lg px-2 py-1.5 flex flex-col gap-0.5 border text-xs',
                        u === 'ok' && 'bg-matcha-800/60 border-matcha-700/50 text-matcha-100',
                        u === 'warn' && 'bg-amber-900/50 border-amber-600/50 text-amber-100',
                        u === 'urgent' && [
                          'bg-red-900/60 border-red-500/60 text-red-100',
                          secs <= 0 && 'animate-pulse',
                        ],
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold tracking-tight">
                          #{truncate(o.bestellnummer, 6)}
                        </span>
                        {u === 'urgent' && (
                          <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[10px] opacity-80">
                        <span>{totalItems} Pos.</span>
                        <span
                          className={cn(
                            'font-mono font-bold',
                            u === 'ok' && 'text-matcha-300',
                            u === 'warn' && 'text-amber-300',
                            u === 'urgent' && 'text-red-300',
                          )}
                        >
                          {fmtCountdown(secs)}
                        </span>
                      </div>
                    </div>
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

export default KitchenLivePrepMatrix;
