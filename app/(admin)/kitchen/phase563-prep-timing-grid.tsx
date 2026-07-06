'use client';

/**
 * Phase 563 — Kitchen: Prep-Timing-Grid mit Smart-Countdown
 *
 * Zeigt alle aktiven Bestellungen in einer farbcodierten Kachel-Matrix.
 * Countdown je Bestellung basierend auf geschätzter Zubereitungszeit.
 *
 * Farbkodierung (verbleibende Zeit):
 *   grün   → > 5 Min  (pünktlich)
 *   amber  → 2–5 Min  (aufpassen)
 *   rot    → < 2 Min  (sofort handeln)
 *   lila   → überfällig (Fahrer wartet schon)
 *
 * Sortierung: überfällig → rot → amber → grün
 */

import { useMemo, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Clock, Flame, Timer, Zap } from 'lucide-react';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string | null;
}

interface Timing {
  order_id: string;
  status: string;
  cook_start_at: string | null;
  ready_target: string | null;
}

interface Props {
  orders: Order[];
  timings?: Timing[];
}

type UrgencyLevel = 'overdue' | 'critical' | 'warning' | 'ok';

interface GridItem {
  order: Order;
  timing: Timing | null;
  remainMin: number | null;
  urgency: UrgencyLevel;
}

const URGENCY: Record<UrgencyLevel, {
  bg: string; border: string; text: string; badge: string; label: string;
}> = {
  overdue:  { bg: 'bg-purple-50', border: 'border-purple-300', text: 'text-purple-800', badge: 'bg-purple-600 text-white', label: 'Überfällig' },
  critical: { bg: 'bg-red-50',    border: 'border-red-300',    text: 'text-red-800',    badge: 'bg-red-600 text-white',    label: 'Sofort' },
  warning:  { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-800',  badge: 'bg-amber-400 text-white',  label: 'Bald' },
  ok:       { bg: 'bg-emerald-50',border: 'border-emerald-200',text: 'text-emerald-800',badge: 'bg-emerald-500 text-white',label: 'OK' },
};

const URGENCY_ORDER: UrgencyLevel[] = ['overdue', 'critical', 'warning', 'ok'];

function getUrgency(remainMin: number | null): UrgencyLevel {
  if (remainMin === null) return 'ok';
  if (remainMin < 0)  return 'overdue';
  if (remainMin < 2)  return 'critical';
  if (remainMin < 5)  return 'warning';
  return 'ok';
}

function fmtRemain(min: number | null): string {
  if (min === null) return '?';
  if (min <= 0) return `+${Math.abs(Math.round(min))}m`;
  const m = Math.floor(min);
  const s = Math.round((min - m) * 60);
  if (m === 0) return `${s}s`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function computeRemainMin(order: Order, timing: Timing | null, now: number): number | null {
  if (timing?.ready_target) {
    return (new Date(timing.ready_target).getTime() - now) / 60_000;
  }
  if (timing?.cook_start_at && order.geschaetzte_zubereitung_min) {
    const endMs = new Date(timing.cook_start_at).getTime() + order.geschaetzte_zubereitung_min * 60_000;
    return (endMs - now) / 60_000;
  }
  if (order.bestellt_am && order.geschaetzte_zubereitung_min) {
    const endMs = new Date(order.bestellt_am).getTime() + order.geschaetzte_zubereitung_min * 60_000;
    return (endMs - now) / 60_000;
  }
  return null;
}

export function KitchenPhase563PrepTimingGrid({ orders, timings = [] }: Props) {
  const [open, setOpen] = useState(true);
  const [, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(n => n + 1), 5_000);
    return () => clearInterval(iv);
  }, []);

  const activeOrders = useMemo(() =>
    orders.filter(o => ['neu', 'bestätigt', 'in_zubereitung'].includes(o.status)),
    [orders],
  );

  const items = useMemo<GridItem[]>(() => {
    const now = Date.now();
    return activeOrders
      .map(order => {
        const timing = timings.find(t => t.order_id === order.id) ?? null;
        const remainMin = computeRemainMin(order, timing, now);
        return { order, timing, remainMin, urgency: getUrgency(remainMin) };
      })
      .sort((a, b) => {
        const ao = URGENCY_ORDER.indexOf(a.urgency);
        const bo = URGENCY_ORDER.indexOf(b.urgency);
        if (ao !== bo) return ao - bo;
        const ar = a.remainMin ?? Infinity;
        const br = b.remainMin ?? Infinity;
        return ar - br;
      });
  }, [activeOrders, timings]);

  const criticalCount = items.filter(i => i.urgency === 'overdue' || i.urgency === 'critical').length;

  if (activeOrders.length === 0) return null;

  return (
    <Card className={cn('overflow-hidden', criticalCount > 0 && 'border-red-300')}>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors',
          criticalCount > 0 && 'bg-red-50 hover:bg-red-100',
        )}
      >
        <div className={cn(
          'flex h-8 w-8 items-center justify-center rounded-full shrink-0',
          criticalCount > 0 ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700',
        )}>
          <Timer className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground flex items-center gap-2">
            Prep-Timing Grid
            {criticalCount > 0 && (
              <span className="rounded-full bg-red-600 text-white px-2 py-0.5 text-[10px] font-black">
                {criticalCount} kritisch
              </span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {items.filter(i => i.urgency === 'overdue').length} überfällig ·{' '}
            {items.filter(i => i.urgency === 'warning').length} knapp ·{' '}
            {items.filter(i => i.urgency === 'ok').length} OK
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {open && (
        <div className="p-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {items.map(({ order, timing, remainMin, urgency }) => {
            const cfg = URGENCY[urgency];
            const isOverdue = urgency === 'overdue';
            const isCooking = timing?.cook_start_at && timing.status !== 'ready';
            return (
              <div
                key={order.id}
                className={cn(
                  'rounded-xl border p-3 space-y-1.5',
                  cfg.bg, cfg.border,
                  isOverdue && 'animate-pulse',
                )}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className={cn('text-[10px] font-black font-mono', cfg.text)}>
                    #{order.bestellnummer}
                  </span>
                  <span className={cn('rounded-full px-1.5 py-0.5 text-[8px] font-bold', cfg.badge)}>
                    {cfg.label}
                  </span>
                </div>

                {order.kunde_name && (
                  <div className={cn('text-[10px] truncate', cfg.text)}>
                    {order.kunde_name}
                  </div>
                )}

                <div className={cn('text-2xl font-black tabular-nums leading-none', cfg.text)}>
                  {fmtRemain(remainMin)}
                </div>
                <div className="text-[9px] text-muted-foreground">
                  {remainMin !== null && remainMin <= 0 ? 'überfällig' : 'verbleibend'}
                </div>

                <div className="flex items-center gap-1">
                  {isCooking
                    ? <Flame className={cn('h-3 w-3', cfg.text)} />
                    : <Clock className={cn('h-3 w-3 opacity-50', cfg.text)} />}
                  <span className={cn('text-[9px]', cfg.text)}>
                    {isCooking ? 'Kocht' : order.status === 'in_zubereitung' ? 'Vorbereitung' : 'Wartend'}
                  </span>
                  {urgency === 'ok' && (
                    <Zap className="h-2.5 w-2.5 ml-auto text-emerald-500" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
