'use client';

/**
 * PrepTicketKacheln — Phase 257
 *
 * KDS-style (Kitchen Display System) Kompakt-Raster aller aktiven Bestellungen.
 * Zeigt Bestellungen OHNE kitchen_timing-Abhängigkeit — deckend für alle Bestellungen
 * in Status bestätigt/in_zubereitung, farbkodiert nach Wartezeit.
 *
 * Farb-Logik:
 *  - grün  (< 5 min)  : frisch eingegangen
 *  - amber (5–12 min) : Aufmerksamkeit
 *  - rot   (> 12 min) : kritisch / Handlungsbedarf
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Clock, Package, Utensils } from 'lucide-react';

type Item = { name: string; menge: number; notiz?: string | null };

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  kunde_name: string;
  bestellt_am: string | null;
  items: Item[];
  typ?: string;
  delivery_zone?: string | null;
};

function useTick(ms = 10_000) {
  const [, set] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => set(n => n + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}

function ageMin(bestellt_am: string | null): number {
  if (!bestellt_am) return 0;
  return Math.floor((Date.now() - new Date(bestellt_am).getTime()) / 60_000);
}

type Urgency = 'ok' | 'warn' | 'crit';

function urgency(min: number): Urgency {
  if (min >= 12) return 'crit';
  if (min >= 5)  return 'warn';
  return 'ok';
}

const URGENCY_STYLES: Record<Urgency, { border: string; bg: string; badge: string; count: string }> = {
  ok:   { border: 'border-matcha-300', bg: 'bg-matcha-50',  badge: 'bg-matcha-500 text-white', count: 'text-matcha-700'  },
  warn: { border: 'border-amber-300',  bg: 'bg-amber-50',   badge: 'bg-amber-400 text-white',  count: 'text-amber-700'  },
  crit: { border: 'border-red-300',    bg: 'bg-red-50',     badge: 'bg-red-500 text-white',    count: 'text-red-700 animate-pulse' },
};

const STATUS_LABELS: Record<string, { label: string; icon: typeof ChefHat; color: string }> = {
  bestätigt:      { label: 'Angenommen',    icon: Package,  color: 'text-blue-600'   },
  in_zubereitung: { label: 'In Zubereitung', icon: ChefHat, color: 'text-orange-600' },
};

function TicketCard({ order }: { order: Order }) {
  useTick();
  const min = ageMin(order.bestellt_am);
  const u = urgency(min);
  const s = URGENCY_STYLES[u];
  const statusMeta = STATUS_LABELS[order.status] ?? STATUS_LABELS['bestätigt'];
  const StatusIcon = statusMeta.icon;
  const topItems = order.items.slice(0, 5);
  const more = order.items.length - 5;

  return (
    <div className={cn(
      'rounded-2xl border-2 p-4 flex flex-col gap-3 transition-all duration-300',
      s.border, s.bg,
    )}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
            #{order.bestellnummer.slice(-6)}
          </div>
          <div className="text-sm font-bold truncate max-w-[140px]">{order.kunde_name}</div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-black', s.badge)}>
            {min}m
          </span>
          {order.delivery_zone && (
            <span className="text-[9px] text-muted-foreground">Zone {order.delivery_zone}</span>
          )}
        </div>
      </div>

      {/* Items */}
      <div className="space-y-0.5">
        {topItems.map((item, i) => (
          <div key={i} className="flex items-start gap-1.5 text-xs">
            <span className={cn('font-black tabular-nums shrink-0', s.count)}>{item.menge}×</span>
            <span className="truncate leading-tight">{item.name}</span>
          </div>
        ))}
        {more > 0 && (
          <div className="text-[10px] text-muted-foreground">+{more} weitere</div>
        )}
      </div>

      {/* Status Footer */}
      <div className={cn('flex items-center gap-1.5 text-[10px] font-bold', statusMeta.color)}>
        <StatusIcon className="h-3 w-3 shrink-0" />
        {statusMeta.label}
      </div>
    </div>
  );
}

export function PrepTicketKacheln({ orders }: { orders: Order[] }) {
  const active = orders.filter(o =>
    o.status === 'bestätigt' || o.status === 'in_zubereitung',
  );

  if (active.length === 0) return null;

  const sorted = [...active].sort((a, b) => {
    const au = urgency(ageMin(a.bestellt_am));
    const bu = urgency(ageMin(b.bestellt_am));
    const order: Urgency[] = ['crit', 'warn', 'ok'];
    const diff = order.indexOf(au) - order.indexOf(bu);
    if (diff !== 0) return diff;
    return ageMin(b.bestellt_am) - ageMin(a.bestellt_am);
  });

  const critCount = sorted.filter(o => urgency(ageMin(o.bestellt_am)) === 'crit').length;
  const warnCount = sorted.filter(o => urgency(ageMin(o.bestellt_am)) === 'warn').length;

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
        <Utensils className="h-4 w-4 text-orange-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Prep-Tickets</span>
        <span className="ml-1 rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-black text-orange-700">
          {active.length}
        </span>
        <div className="ml-auto flex items-center gap-2 text-[10px]">
          {critCount > 0 && (
            <span className="flex items-center gap-1 font-bold text-red-600 animate-pulse">
              <Clock className="h-3 w-3" />
              {critCount} kritisch
            </span>
          )}
          {warnCount > 0 && (
            <span className="flex items-center gap-1 font-bold text-amber-600">
              {warnCount} Warnung
            </span>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="p-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {sorted.map(o => (
          <TicketCard key={o.id} order={o} />
        ))}
      </div>
    </div>
  );
}
