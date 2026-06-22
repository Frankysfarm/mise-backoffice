'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChefHat, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';

type Order = {
  id: string;
  bestellnummer: string;
  status: string;
  kunde_name: string;
  typ: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
};

interface Props {
  orders: Order[];
}

const PREP_STATUSES = ['zubereitung', 'in_zubereitung'];

type Urgency = 'green' | 'amber' | 'red';

function calcElapsedAndRemaining(order: Order): {
  elapsedMin: number | null;
  remainingFraction: number | null;
} {
  if (!order.bestellt_am || order.geschaetzte_zubereitung_min == null) {
    return { elapsedMin: null, remainingFraction: null };
  }
  const startMs = new Date(order.bestellt_am).getTime();
  const totalMs = order.geschaetzte_zubereitung_min * 60_000;
  const elapsedMs = Date.now() - startMs;
  const elapsedMin = Math.floor(elapsedMs / 60_000);
  const remainingFraction = (totalMs - elapsedMs) / totalMs;
  return { elapsedMin, remainingFraction };
}

function urgencyFromFraction(fraction: number | null): Urgency {
  if (fraction === null) return 'green';
  if (fraction > 0.25) return 'green';
  if (fraction >= 0) return 'amber';
  return 'red';
}

const URGENCY_ORDER: Record<Urgency, number> = { red: 0, amber: 1, green: 2 };

const URGENCY_STYLE: Record<Urgency, { card: string; badge: string; text: string; icon: string }> = {
  green: {
    card: 'border-matcha-200 bg-matcha-50',
    badge: 'bg-matcha-100 text-matcha-700',
    text: 'text-matcha-700',
    icon: 'bg-matcha-100',
  },
  amber: {
    card: 'border-amber-200 bg-amber-50',
    badge: 'bg-amber-100 text-amber-700',
    text: 'text-amber-700',
    icon: 'bg-amber-100',
  },
  red: {
    card: 'border-red-200 bg-red-50',
    badge: 'bg-red-100 text-red-700',
    text: 'text-red-700',
    icon: 'bg-red-100',
  },
};

export function KitchenPrepZielAmpel({ orders }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const prepOrders = orders.filter((o) => PREP_STATUSES.includes(o.status));
  if (prepOrders.length === 0) return null;

  const enriched = prepOrders
    .map((order) => {
      const { elapsedMin, remainingFraction } = calcElapsedAndRemaining(order);
      const urgency = urgencyFromFraction(remainingFraction);
      return { order, elapsedMin, remainingFraction, urgency };
    })
    .sort((a, b) => {
      const urgencyDiff = URGENCY_ORDER[a.urgency] - URGENCY_ORDER[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      // Within same urgency: most overdue / least time remaining first
      const aFrac = a.remainingFraction ?? 999;
      const bFrac = b.remainingFraction ?? 999;
      return aFrac - bFrac;
    });

  const redCount = enriched.filter((e) => e.urgency === 'red').length;
  const amberCount = enriched.filter((e) => e.urgency === 'amber').length;
  const greenCount = enriched.filter((e) => e.urgency === 'green').length;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-matcha-900/5">
        <ChefHat className="h-4 w-4 text-matcha-600" />
        <span className="text-xs font-bold uppercase tracking-wider text-foreground">
          Zubereitung Ampel
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {redCount > 0 && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-700 animate-pulse">
              {redCount} überfällig
            </span>
          )}
          {amberCount > 0 && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {amberCount} bald
            </span>
          )}
          {greenCount > 0 && (
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
              {greenCount} ok
            </span>
          )}
        </div>
      </div>

      {/* Order cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3">
        {enriched.map(({ order, elapsedMin, urgency }) => {
          const s = URGENCY_STYLE[urgency];
          const planned = order.geschaetzte_zubereitung_min;
          return (
            <div
              key={order.id}
              className={cn(
                'rounded-lg border px-3 py-2.5 flex items-center gap-3 transition-all duration-300',
                s.card,
                urgency === 'red' && 'ring-1 ring-red-400',
              )}
            >
              {/* Chef icon */}
              <div
                className={cn(
                  'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
                  s.icon,
                )}
              >
                {urgency === 'green' ? (
                  <CheckCircle2 className={cn('h-4 w-4', s.text)} />
                ) : (
                  <ChefHat className={cn('h-4 w-4', s.text)} />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className={cn('font-bold text-sm truncate', s.text)}>
                  #{order.bestellnummer}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                  {order.kunde_name} · {order.typ}
                </div>
              </div>

              {/* Time badge */}
              <div className="shrink-0 flex flex-col items-end gap-1">
                {elapsedMin !== null && planned != null ? (
                  <span
                    className={cn(
                      'flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-black tabular-nums',
                      s.badge,
                    )}
                  >
                    <Clock size={9} />
                    {elapsedMin}/{planned} Min
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
                    —
                  </span>
                )}
                {urgency === 'red' && (
                  <AlertTriangle size={11} className="text-red-500 animate-pulse" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer hint */}
      <div className="px-4 py-2 border-t border-border/50 bg-muted/30">
        <p className="text-[9px] text-muted-foreground text-center uppercase tracking-widest font-bold">
          Zubereitung-Ampel · Aktualisierung alle 30s
        </p>
      </div>
    </div>
  );
}
