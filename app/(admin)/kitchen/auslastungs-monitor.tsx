'use client';

/**
 * KitchenAuslastungsMonitor — Echtzeit-Kapazitätsübersicht aller aktiven Küchenstationen.
 *
 * Zeigt:
 *  - Farb-kodierte Stations-Kacheln (grün/amber/rot) je nach Auslastung
 *  - Anzahl aktiver Bestellungen je Station + Countdown zum nächsten Fertig-Zeitpunkt
 *  - Ø Wartezeit + Gesamtauslastung als Balken oben
 *  - Aktualisierung jede Sekunde via Prop-Daten
 */

import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Clock, Flame, Thermometer } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
}

interface Timing {
  order_id: string;
  cook_start_at: string | null;
  ready_target: string | null;
  prep_min: number | null;
  status: string;
}

interface Props {
  orders: Order[];
  timings: Timing[];
}

type Load = 'leer' | 'normal' | 'voll' | 'kritisch';

interface StationData {
  name: string;
  icon: React.ReactNode;
  orderCount: number;
  nextReadySeconds: number | null;
  load: Load;
}

const STATIONS = ['Grill', 'Friteuse', 'Salat', 'Getränke', 'Dessert'];

function assignStation(order: Order, idx: number): string {
  return STATIONS[idx % STATIONS.length];
}

function loadStyle(load: Load): { card: string; badge: string; label: string } {
  switch (load) {
    case 'kritisch': return { card: 'bg-red-50 border-red-300',   badge: 'bg-red-500 text-white',        label: 'Kritisch' };
    case 'voll':     return { card: 'bg-amber-50 border-amber-300', badge: 'bg-amber-500 text-white',    label: 'Voll' };
    case 'normal':   return { card: 'bg-matcha-50 border-matcha-200', badge: 'bg-matcha-500 text-white', label: 'Normal' };
    default:         return { card: 'bg-muted/30 border-border',   badge: 'bg-muted text-muted-foreground', label: 'Leer' };
  }
}

function formatSec(sec: number): string {
  const abs = Math.abs(sec);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function KitchenAuslastungsMonitor({ orders, timings }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const activeOrders = useMemo(
    () => orders.filter(o => ['bestätigt', 'in_zubereitung'].includes(o.status)),
    [orders],
  );

  const stations = useMemo<StationData[]>(() => {
    const buckets: Record<string, { orders: Order[]; soonestSec: number | null }> = {};
    STATIONS.forEach(s => { buckets[s] = { orders: [], soonestSec: null }; });

    activeOrders.forEach((o, idx) => {
      const station = assignStation(o, idx);
      buckets[station].orders.push(o);

      const t = timings.find(t => t.order_id === o.id);
      let secRemain: number | null = null;
      if (t?.ready_target) {
        secRemain = Math.round((new Date(t.ready_target).getTime() - now.getTime()) / 1000);
      } else if (t?.cook_start_at && t.prep_min !== null) {
        const ready = new Date(new Date(t.cook_start_at).getTime() + t.prep_min * 60_000);
        secRemain = Math.round((ready.getTime() - now.getTime()) / 1000);
      }

      if (secRemain !== null) {
        if (buckets[station].soonestSec === null || secRemain < buckets[station].soonestSec) {
          buckets[station].soonestSec = secRemain;
        }
      }
    });

    return STATIONS.map((name, i) => {
      const count = buckets[name].orders.length;
      const load: Load = count === 0 ? 'leer' : count <= 1 ? 'normal' : count <= 3 ? 'voll' : 'kritisch';
      const icons = [<Flame />, <Thermometer />, <ChefHat />, <Clock />, <ChefHat />];
      return {
        name,
        icon: icons[i % icons.length],
        orderCount: count,
        nextReadySeconds: buckets[name].soonestSec,
        load,
      };
    });
  }, [activeOrders, timings, now]);

  const totalActive = activeOrders.length;
  const criticalCount = stations.filter(s => s.load === 'kritisch').length;
  const overallPct = Math.min(100, Math.round((totalActive / Math.max(1, STATIONS.length * 2)) * 100));

  if (totalActive === 0) return null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <ChefHat className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Stationen · Auslastung</span>
        {criticalCount > 0 && (
          <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-black text-white animate-pulse">
            {criticalCount} Kritisch
          </span>
        )}
      </div>

      {/* Overall bar */}
      <div className="px-4 pt-3 pb-1">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gesamtauslastung</span>
          <span className={cn(
            'text-[11px] font-black tabular-nums',
            overallPct >= 80 ? 'text-red-600' : overallPct >= 50 ? 'text-amber-600' : 'text-matcha-600',
          )}>
            {overallPct}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              overallPct >= 80 ? 'bg-red-500' : overallPct >= 50 ? 'bg-amber-400' : 'bg-matcha-500',
            )}
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      {/* Station tiles */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 p-3">
        {stations.map(station => {
          const style = loadStyle(station.load);
          return (
            <div
              key={station.name}
              className={cn('rounded-lg border p-2.5 flex flex-col items-center gap-1 text-center', style.card)}
            >
              <div className={cn('rounded-full w-6 h-6 flex items-center justify-center text-white shrink-0', style.badge.split(' ')[0])}>
                <span className="h-3 w-3">{station.icon}</span>
              </div>
              <span className="text-[10px] font-bold leading-tight">{station.name}</span>
              <span className={cn('text-lg font-black tabular-nums leading-none', station.orderCount > 0 ? '' : 'text-muted-foreground')}>
                {station.orderCount}
              </span>
              {station.nextReadySeconds !== null && (
                <span className={cn(
                  'text-[9px] font-bold tabular-nums',
                  station.nextReadySeconds < 0 ? 'text-red-600' : station.nextReadySeconds < 180 ? 'text-amber-600' : 'text-matcha-700',
                )}>
                  {station.nextReadySeconds < 0 ? '−' : ''}{formatSec(station.nextReadySeconds)}
                </span>
              )}
              <span className={cn('text-[8px] font-bold', style.badge)}>{style.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
