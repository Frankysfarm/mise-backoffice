'use client';

import { useState, useEffect } from 'react';
import { Clock, ChefHat, Package, Inbox, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderItem {
  name: string;
  menge: number;
}

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  kunde_name: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  typ: string;
  items: OrderItem[];
}

interface Props {
  orders: Order[];
}

type TimingState = 'green' | 'amber' | 'red';

const STATUS_LABELS: Record<string, string> = {
  neu: 'Neu',
  bestätigt: 'Bestätigt',
  in_zubereitung: 'In Zubereitung',
  fertig: 'Fertig',
};

const ACTIVE_STATUSES = new Set(['neu', 'bestätigt', 'in_zubereitung', 'fertig']);

function getElapsedSec(bestelltAm: string | null): number {
  if (!bestelltAm) return 0;
  return Math.max(0, (Date.now() - new Date(bestelltAm).getTime()) / 1000);
}

function getTimingState(
  elapsedSec: number,
  geschaetzteMin: number | null,
): TimingState {
  const prepSec = (geschaetzteMin ?? 15) * 60;
  const ratio = elapsedSec / prepSec;
  if (ratio >= 1) return 'red';
  if (ratio >= 0.8) return 'amber';
  return 'green';
}

function formatCountdown(elapsedSec: number, geschaetzteMin: number | null): string {
  const prepSec = (geschaetzteMin ?? 15) * 60;
  const remaining = prepSec - elapsedSec;
  if (remaining <= 0) return 'Überfällig!';
  const m = Math.floor(remaining / 60);
  const s = Math.floor(remaining % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const TIMING_STYLES: Record<TimingState, { tile: string; countdown: string }> = {
  green: {
    tile: 'bg-green-500/20 border-green-500',
    countdown: 'text-green-700',
  },
  amber: {
    tile: 'bg-amber-400/20 border-amber-400',
    countdown: 'text-amber-700',
  },
  red: {
    tile: 'bg-red-500/20 border-red-500 animate-pulse',
    countdown: 'text-red-600',
  },
};

export function KitchenSmartOrderFlowBoard({ orders }: Props) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  const activeOrders = orders.filter((o) => ACTIVE_STATUSES.has(o.status));

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <Zap className="h-4 w-4 text-matcha-600" />
        <span className="font-display text-sm font-bold uppercase tracking-wider">
          Smart-Flow Board
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {activeOrders.length} aktiv
        </span>
      </div>

      {activeOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
          <Inbox className="h-8 w-8 opacity-40" />
          <p className="text-sm">Keine aktiven Bestellungen</p>
        </div>
      ) : (
        <div
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 p-3"
          suppressHydrationWarning
        >
          {activeOrders.map((order) => {
            const elapsed = getElapsedSec(order.bestellt_am);
            const state = getTimingState(elapsed, order.geschaetzte_zubereitung_min);
            const countdown = formatCountdown(elapsed, order.geschaetzte_zubereitung_min);
            const styles = TIMING_STYLES[state];
            const statusLabel = STATUS_LABELS[order.status] ?? order.status;
            const itemCount = order.items.reduce((sum, it) => sum + it.menge, 0);

            return (
              <div
                key={order.id}
                className={cn(
                  'flex flex-col gap-1.5 rounded-lg border-2 p-3 transition',
                  styles.tile,
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="font-bold text-sm tabular-nums">
                    #{order.bestellnummer.slice(-4)}
                  </span>
                  <span className="flex items-center gap-0.5 rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    <Package className="h-2.5 w-2.5" />
                    {itemCount}
                  </span>
                </div>

                <p className="truncate text-xs text-muted-foreground leading-none">
                  {order.kunde_name}
                </p>

                <div className={cn('flex items-center gap-1 text-xs font-black tabular-nums', styles.countdown)}>
                  <Clock className="h-3 w-3 shrink-0" />
                  {countdown}
                </div>

                <div className="flex items-center gap-1 mt-auto">
                  <span className="flex items-center gap-0.5 rounded-full bg-matcha-100 text-matcha-700 px-1.5 py-0.5 text-[10px] font-semibold">
                    <ChefHat className="h-2.5 w-2.5" />
                    {statusLabel}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
