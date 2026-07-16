'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { Activity, AlertCircle, ChefHat, CheckCircle2, Clock, Flame, Layers, TrendingUp, Users, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';

/**
 * Phase 2001 — Stationsauslastungs-Matrix (Kitchen)
 *
 * Echtzeit-Auslastungsmatrix aller Küchenlinien/-stationen:
 * - Parallelität: Wieviele Bestellungen laufen gleichzeitig
 * - Auslastungsgrad (0–100%) pro Station
 * - Engpass-Erkennung: Welche Station ist Bottleneck?
 * - Wartezeit-Prognose bis Entlastung
 */

interface Order {
  id: string;
  bestellnummer?: string | null;
  status?: string | null;
  zubereitung_start?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  fertig_am?: string | null;
  bestellt_am?: string | null;
  items?: { name?: string; category?: string }[];
}

interface StationData {
  name: string;
  icon: React.ReactNode;
  orders: Order[];
  avgPrepMin: number;
  color: string;
  bgColor: string;
}

function categorize(order: Order): string {
  const items = order.items ?? [];
  const names = items.map((i) => (i.name ?? '').toLowerCase()).join(' ');
  const cats = items.map((i) => (i.category ?? '').toLowerCase()).join(' ');
  const all = names + ' ' + cats;
  if (all.includes('pizza') || all.includes('flammkuchen')) return 'Ofen';
  if (all.includes('burger') || all.includes('grill') || all.includes('steak')) return 'Grill';
  if (all.includes('salat') || all.includes('wrap') || all.includes('kalt')) return 'Kalt';
  if (all.includes('suppe') || all.includes('pasta') || all.includes('sauce')) return 'Herd';
  if (all.includes('dessert') || all.includes('kuchen') || all.includes('eis')) return 'Dessert';
  return 'Allgemein';
}

function getElapsedMin(order: Order, now: number): number {
  const start = order.zubereitung_start ?? order.bestellt_am;
  if (!start) return 0;
  return (now - new Date(start).getTime()) / 60000;
}

const STATIONS = [
  { key: 'Ofen', icon: <Flame className="w-4 h-4" />, avgPrepMin: 14, color: 'text-orange-400', bgColor: 'bg-orange-950/40 border-orange-800/50' },
  { key: 'Grill', icon: <Zap className="w-4 h-4" />, avgPrepMin: 10, color: 'text-red-400', bgColor: 'bg-red-950/40 border-red-800/50' },
  { key: 'Herd', icon: <Activity className="w-4 h-4" />, avgPrepMin: 12, color: 'text-blue-400', bgColor: 'bg-blue-950/40 border-blue-800/50' },
  { key: 'Kalt', icon: <Layers className="w-4 h-4" />, avgPrepMin: 5, color: 'text-green-400', bgColor: 'bg-green-950/40 border-green-800/50' },
  { key: 'Dessert', icon: <TrendingUp className="w-4 h-4" />, avgPrepMin: 6, color: 'text-purple-400', bgColor: 'bg-purple-950/40 border-purple-800/50' },
  { key: 'Allgemein', icon: <ChefHat className="w-4 h-4" />, avgPrepMin: 10, color: 'text-matcha-400', bgColor: 'bg-matcha-950/40 border-matcha-800/50' },
];

const MAX_CAPACITY = 4;

export function KitchenPhase2001StationsauslastungsMatrix({
  orders,
}: {
  orders: Order[];
}) {
  const [now, setNow] = useState(Date.now());
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(iv);
  }, []);

  const active = useMemo(
    () => orders.filter((o) => o.status === 'in_progress' || o.status === 'zubereitung' || o.status === 'cooking'),
    [orders],
  );

  const stations = useMemo<StationData[]>(
    () =>
      STATIONS.map((s) => {
        const stationOrders = active.filter((o) => categorize(o) === s.key);
        return { name: s.key, icon: s.icon, orders: stationOrders, avgPrepMin: s.avgPrepMin, color: s.color, bgColor: s.bgColor };
      }).filter((s) => s.orders.length > 0 || expanded),
    [active, expanded],
  );

  const bottleneck = useMemo(
    () => stations.reduce<StationData | null>((acc, s) => (!acc || s.orders.length > acc.orders.length ? s : acc), null),
    [stations],
  );

  const totalActive = active.length;

  if (totalActive === 0 && !expanded) return null;

  return (
    <Card className="border-matcha-800/30 bg-matcha-950/20 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-matcha-400" />
          <span className="text-xs font-semibold text-matcha-300 uppercase tracking-wider">
            Stationsauslastung
          </span>
          <span className="text-[10px] text-neutral-500">Phase 2001</span>
        </div>
        <div className="flex items-center gap-2">
          {bottleneck && bottleneck.orders.length >= MAX_CAPACITY && (
            <div className="flex items-center gap-1 text-red-400 text-[10px]">
              <AlertCircle className="w-3 h-3" />
              <span>Engpass: {bottleneck.name}</span>
            </div>
          )}
          <div className="text-xs text-neutral-400">{totalActive} aktiv</div>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-[10px] text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            {expanded ? 'weniger' : 'alle'}
          </button>
        </div>
      </div>

      {/* Station Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {stations.map((station) => {
          const count = station.orders.length;
          const load = Math.min(count / MAX_CAPACITY, 1);
          const isBottleneck = station.name === bottleneck?.name && count >= MAX_CAPACITY;
          const avgElapsed =
            count > 0
              ? station.orders.reduce((sum, o) => sum + getElapsedMin(o, now), 0) / count
              : 0;
          const remaining = Math.max(station.avgPrepMin - avgElapsed, 0);

          return (
            <div
              key={station.name}
              className={cn(
                'rounded-lg border p-2.5 space-y-1.5 transition-all',
                station.bgColor,
                isBottleneck && 'ring-1 ring-red-500/60 animate-pulse',
              )}
            >
              <div className="flex items-center justify-between">
                <div className={cn('flex items-center gap-1.5', station.color)}>
                  {station.icon}
                  <span className="text-xs font-medium">{station.name}</span>
                </div>
                <span className={cn('text-xs font-bold', count === 0 ? 'text-neutral-600' : station.color)}>
                  {count}/{MAX_CAPACITY}
                </span>
              </div>

              {/* Auslastungsbalken */}
              <div className="w-full h-1.5 rounded-full bg-neutral-800">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    load >= 1 ? 'bg-red-500' : load >= 0.7 ? 'bg-amber-500' : load >= 0.4 ? 'bg-yellow-500' : 'bg-green-500',
                  )}
                  style={{ width: `${Math.max(load * 100, count > 0 ? 8 : 0)}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[10px] text-neutral-500">
                {count > 0 ? (
                  <>
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-3 h-3" />
                      ~{Math.round(remaining)}min
                    </span>
                    <span>{Math.round(load * 100)}%</span>
                  </>
                ) : (
                  <span className="text-neutral-700">frei</span>
                )}
              </div>

              {/* Order-Bubbles */}
              {count > 0 && (
                <div className="flex flex-wrap gap-1">
                  {station.orders.slice(0, 4).map((o) => {
                    const elapsed = getElapsedMin(o, now);
                    const overdue = elapsed > station.avgPrepMin;
                    return (
                      <span
                        key={o.id}
                        className={cn(
                          'text-[9px] px-1 py-0.5 rounded font-mono',
                          overdue ? 'bg-red-900/60 text-red-300' : 'bg-neutral-800 text-neutral-400',
                        )}
                      >
                        {o.bestellnummer?.slice(-3) ?? '???'}
                        {overdue && '!'}
                      </span>
                    );
                  })}
                  {count > 4 && <span className="text-[9px] text-neutral-600">+{count - 4}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary bar */}
      {totalActive > 0 && (
        <div className="flex items-center gap-4 pt-1 border-t border-neutral-800">
          <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
            <CheckCircle2 className="w-3 h-3 text-green-500" />
            {stations.filter((s) => s.orders.length < MAX_CAPACITY * 0.5).length} Stationen frei
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-neutral-500">
            <AlertCircle className="w-3 h-3 text-amber-500" />
            {stations.filter((s) => s.orders.length >= MAX_CAPACITY).length} überlastet
          </div>
        </div>
      )}
    </Card>
  );
}
