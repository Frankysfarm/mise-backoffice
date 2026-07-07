'use client';

/**
 * Phase 584 — Kitchen: Live-Verspätungs-Alarm-Panel
 *
 * Anzeige aller Bestellungen die bereits >20 Min in Zubereitung sind.
 * Eskalations-Button je Bestellung (Mock — ruft nur Konsole).
 *
 * Ticker: 30s
 */

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertOctagon, Bell, ChevronDown, ChevronUp, Clock } from 'lucide-react';

interface OrderItem {
  id: string;
  menge?: number;
}

interface Order {
  id: string;
  status: string;
  typ: string;
  created_at?: string;
  bestellnummer?: string | number | null;
  items?: OrderItem[] | null;
  positionen?: OrderItem[] | null;
}

interface Props {
  orders: Order[];
  /** Schwelle in Minuten, ab der eine Bestellung als verspätet gilt (Default: 20) */
  thresholdMin?: number;
}

const PREP_STATUSES = new Set(['in_zubereitung', 'in_preparation']);
const DELIVERY_TYPES = new Set(['delivery', 'lieferung']);

function elapsedMin(createdAt: string | undefined): number | null {
  if (!createdAt) return null;
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000);
}

export function KitchenPhase584VerspaetungsAlarmPanel({ orders, thresholdMin = 20 }: Props) {
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);
  const [escalated, setEscalated] = useState<Set<string>>(new Set());

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const lateOrders = useMemo(() => {
    return orders
      .filter(o =>
        PREP_STATUSES.has(o.status) &&
        DELIVERY_TYPES.has(o.typ),
      )
      .map(o => {
        const elapsed = elapsedMin(o.created_at);
        return { ...o, elapsedMin: elapsed };
      })
      .filter(o => o.elapsedMin !== null && o.elapsedMin >= thresholdMin)
      .sort((a, b) => (b.elapsedMin ?? 0) - (a.elapsedMin ?? 0));
  }, [orders, thresholdMin, tick]);

  const criticalCount = lateOrders.filter(o => (o.elapsedMin ?? 0) >= thresholdMin + 10).length;

  function handleEscalate(orderId: string) {
    setEscalated(prev => new Set(prev).add(orderId));
    console.info('[KitchenPhase584] Eskalation ausgelöst für Bestellung', orderId);
  }

  if (lateOrders.length === 0) return null;

  const headerBg = criticalCount > 0
    ? 'text-red-700'
    : 'text-amber-700';

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2">
          <AlertOctagon className={cn('h-4 w-4', headerBg)} />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Verspätungs-Alarm</span>
          <Badge className={cn(
            'text-[10px] px-2 py-0.5',
            criticalCount > 0 ? 'bg-red-600 text-white' : 'bg-amber-500 text-white',
          )}>
            {lateOrders.length} verspätet
          </Badge>
          {criticalCount > 0 && (
            <Badge className="text-[10px] px-2 py-0.5 bg-red-800 text-white animate-pulse">
              {criticalCount} kritisch
            </Badge>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t divide-y">
          {lateOrders.map(order => {
            const isCritical = (order.elapsedMin ?? 0) >= thresholdMin + 10;
            const isEscalated = escalated.has(order.id);
            const itemCount = (order.items ?? order.positionen ?? []).reduce(
              (s, it) => s + (it.menge ?? 1), 0
            );
            return (
              <div
                key={order.id}
                className={cn(
                  'px-4 py-3 flex items-center gap-3',
                  isCritical ? 'bg-red-50' : 'bg-amber-50',
                )}
              >
                <div className={cn(
                  'flex-none rounded-lg px-2 py-1 text-center min-w-[52px]',
                  isCritical ? 'bg-red-600 text-white' : 'bg-amber-500 text-white',
                )}>
                  <div className="text-base font-black tabular-nums leading-none">{order.elapsedMin}</div>
                  <div className="text-[9px] opacity-90">Min</div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold">
                      #{order.bestellnummer ?? order.id.slice(-6).toUpperCase()}
                    </span>
                    {itemCount > 0 && (
                      <span className="text-[10px] text-muted-foreground">{itemCount} Artikel</span>
                    )}
                    {isCritical && (
                      <span className="text-[9px] font-black text-red-700 uppercase tracking-wide">Kritisch!</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className={cn('h-3 w-3', isCritical ? 'text-red-500' : 'text-amber-500')} />
                    <span className="text-[10px] text-muted-foreground">
                      In Zubereitung seit {order.elapsedMin} Min — Limit: {thresholdMin} Min
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => handleEscalate(order.id)}
                  disabled={isEscalated}
                  className={cn(
                    'shrink-0 flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold transition',
                    isEscalated
                      ? 'bg-muted text-muted-foreground cursor-default'
                      : isCritical
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-amber-500 text-white hover:bg-amber-600',
                  )}
                >
                  <Bell className="h-3 w-3" />
                  {isEscalated ? 'Eskaliert' : 'Eskalieren'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
