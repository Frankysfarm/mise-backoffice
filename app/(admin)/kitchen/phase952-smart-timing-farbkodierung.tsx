'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock, ChevronDown, ChevronUp, Zap } from 'lucide-react';

/**
 * Phase 952 — Smart-Timing-Farbkodierung (Kitchen)
 *
 * Zeigt alle aktiven Bestellungen als Kacheln mit Live-Countdown und
 * dreistufiger Farbkodierung: grün (<= Zielzeit), gelb (bis 5 Min drüber),
 * rot (>5 Min drüber). Sortiert nach Dringlichkeit.
 */

interface OrderItem {
  name: string;
  qty?: number;
}

interface Order {
  id: string;
  bestellnummer?: string | null;
  status: string;
  kunde_name?: string | null;
  bestellt_am?: string | null;
  zubereitung_start?: string | null;
  geschaetzte_zubereitung_min?: number | null;
  artikel?: OrderItem[] | null;
  items?: OrderItem[] | null;
}

interface Props {
  orders: Order[];
  zielZeitMin?: number;
}

const ACTIVE_STATUSES = new Set([
  'neu', 'bestätigt', 'confirmed', 'zubereitung', 'in_preparation', 'preparing', 'in_kitchen',
]);

function getElapsedMin(order: Order): number {
  const ref = order.zubereitung_start ?? order.bestellt_am;
  if (!ref) return 0;
  return Math.floor((Date.now() - new Date(ref).getTime()) / 60_000);
}

function getColor(elapsed: number, ziel: number): 'green' | 'amber' | 'red' {
  if (elapsed <= ziel) return 'green';
  if (elapsed <= ziel + 5) return 'amber';
  return 'red';
}

const COLOR_STYLES = {
  green: {
    border: 'border-matcha-300 dark:border-matcha-700',
    bg: 'bg-matcha-50/80 dark:bg-matcha-950/30',
    badge: 'bg-matcha-100 dark:bg-matcha-900/50 text-matcha-700 dark:text-matcha-300',
    ring: 'ring-matcha-400/40',
  },
  amber: {
    border: 'border-amber-300 dark:border-amber-700',
    bg: 'bg-amber-50/80 dark:bg-amber-950/30',
    badge: 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300',
    ring: 'ring-amber-400/40',
  },
  red: {
    border: 'border-red-300 dark:border-red-700',
    bg: 'bg-red-50/80 dark:bg-red-950/30',
    badge: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300',
    ring: 'ring-red-400/40',
  },
};

export function KitchenPhase952SmartTimingFarbkodierung({ orders, zielZeitMin = 12 }: Props) {
  const [open, setOpen] = useState(true);

  const aktiv = useMemo(() => {
    return orders
      .filter((o) => ACTIVE_STATUSES.has(o.status))
      .map((o) => {
        const elapsed = getElapsedMin(o);
        const ziel = o.geschaetzte_zubereitung_min ?? zielZeitMin;
        const remaining = ziel - elapsed;
        const color = getColor(elapsed, ziel);
        return { ...o, elapsed, remaining, color, ziel };
      })
      .sort((a, b) => {
        const priority = { red: 0, amber: 1, green: 2 };
        if (priority[a.color] !== priority[b.color]) return priority[a.color] - priority[b.color];
        return a.remaining - b.remaining;
      });
  }, [orders, zielZeitMin]);

  const counts = useMemo(() => ({
    red: aktiv.filter((o) => o.color === 'red').length,
    amber: aktiv.filter((o) => o.color === 'amber').length,
    green: aktiv.filter((o) => o.color === 'green').length,
  }), [aktiv]);

  if (aktiv.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/20 transition text-left"
      >
        <Zap className="h-4 w-4 text-matcha-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Smart-Timing · Farbkodierung
        </span>
        <span className="ml-1 flex items-center gap-1">
          {counts.red > 0 && (
            <span className="rounded-full bg-red-100 dark:bg-red-900/50 px-1.5 py-0.5 text-[10px] font-black text-red-700 dark:text-red-300">
              {counts.red}🔴
            </span>
          )}
          {counts.amber > 0 && (
            <span className="rounded-full bg-amber-100 dark:bg-amber-900/50 px-1.5 py-0.5 text-[10px] font-black text-amber-700 dark:text-amber-300">
              {counts.amber}🟡
            </span>
          )}
          {counts.green > 0 && (
            <span className="rounded-full bg-matcha-100 dark:bg-matcha-900/40 px-1.5 py-0.5 text-[10px] font-black text-matcha-700 dark:text-matcha-300">
              {counts.green}🟢
            </span>
          )}
        </span>
        <span className="ml-auto text-muted-foreground">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            {aktiv.map((order) => {
              const s = COLOR_STYLES[order.color];
              const absRemaining = Math.abs(order.remaining);
              const items = order.artikel ?? order.items ?? [];
              return (
                <div
                  key={order.id}
                  className={cn(
                    'rounded-lg border p-3 ring-2 ring-transparent',
                    s.border, s.bg, s.ring,
                  )}
                >
                  {/* Bestellnummer + Status */}
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <span className="text-xs font-black text-foreground truncate">
                      #{order.bestellnummer ?? order.id.slice(-4)}
                    </span>
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-black shrink-0', s.badge)}>
                      {order.color === 'red' ? '⚠' : order.color === 'amber' ? '⏳' : '✓'}
                    </span>
                  </div>

                  {/* Countdown */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <Clock className={cn('h-3.5 w-3.5 shrink-0', order.color === 'red' ? 'text-red-500' : order.color === 'amber' ? 'text-amber-500' : 'text-matcha-500')} />
                    <span className={cn(
                      'text-base font-black tabular-nums',
                      order.color === 'red' ? 'text-red-600 dark:text-red-400'
                        : order.color === 'amber' ? 'text-amber-600 dark:text-amber-400'
                        : 'text-matcha-600 dark:text-matcha-400',
                    )}>
                      {order.remaining >= 0 ? `${order.remaining}m` : `+${absRemaining}m`}
                    </span>
                  </div>

                  {/* Fortschrittsbalken */}
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-2">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        order.color === 'red' ? 'bg-red-500' : order.color === 'amber' ? 'bg-amber-500' : 'bg-matcha-500',
                      )}
                      style={{ width: `${Math.min(100, (order.elapsed / Math.max(order.ziel, 1)) * 100)}%` }}
                    />
                  </div>

                  {/* Kunde & Artikel */}
                  {order.kunde_name && (
                    <p className="text-[10px] text-muted-foreground truncate">{order.kunde_name}</p>
                  )}
                  {items.length > 0 && (
                    <p className="text-[10px] text-muted-foreground truncate">
                      {items.slice(0, 2).map((i) => `${i.qty ?? 1}× ${i.name}`).join(', ')}
                      {items.length > 2 ? ` +${items.length - 2}` : ''}
                    </p>
                  )}
                  <p className="text-[9px] text-muted-foreground mt-1">{order.elapsed}m in Küche</p>
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-matcha-500 inline-block" /> Grün: im Ziel (≤{zielZeitMin}m)</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> Gelb: leicht drüber (bis +5m)</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500 inline-block" /> Rot: kritisch (&gt;+5m)</span>
          </div>
        </div>
      )}
    </div>
  );
}
