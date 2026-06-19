'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Clock,
  ChefHat,
  Truck,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface Order {
  id: string;
  bestellnummer: string;
  status: string;
  bestellt_am: string | null;
  geschaetzte_zubereitung_min: number | null;
  kunde_name: string;
  typ: string;
}

interface Batch {
  id: string;
  status: string;
  started_at: string | null;
  total_eta_min: number | null;
  driver_id: string;
}

interface Stop {
  id: string;
  batch_id: string;
  order_id: string;
  geliefert_am: string | null;
}

interface Props {
  orders: Order[];
  batches: Batch[];
  stops: Stop[];
}

interface EnrichedOrder {
  order: Order;
  driverArrivalAt: Date | null;
  cookByAt: Date | null;
  secondsUntilCookBy: number | null;
  batchId: string | null;
}

type UrgencyLevel = 'ok' | 'soon' | 'now' | 'overdue';

function getUrgency(secondsUntilCookBy: number | null): UrgencyLevel {
  if (secondsUntilCookBy === null) return 'ok';
  if (secondsUntilCookBy >= 600) return 'ok';
  if (secondsUntilCookBy >= 300) return 'soon';
  if (secondsUntilCookBy >= 0) return 'now';
  return 'overdue';
}

function formatCountdown(seconds: number): string {
  const abs = Math.abs(seconds);
  const m = Math.floor(abs / 60);
  const s = abs % 60;
  const prefix = seconds < 0 ? '-' : '';
  return `${prefix}${m}:${String(s).padStart(2, '0')}`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

const urgencyConfig: Record<
  UrgencyLevel,
  { label: string; badgeClass: string; cardBorderClass: string; icon: React.ReactNode }
> = {
  ok: {
    label: 'Noch Zeit',
    badgeClass: 'bg-green-100 text-green-800 border-green-200',
    cardBorderClass: 'border-green-200',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  soon: {
    label: 'Bald starten',
    badgeClass: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    cardBorderClass: 'border-yellow-300',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  now: {
    label: 'JETZT starten!',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
    cardBorderClass: 'border-orange-400',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
  overdue: {
    label: 'Überfällig!',
    badgeClass: 'bg-red-100 text-red-800 border-red-300',
    cardBorderClass: 'border-red-500',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
  },
};

export function KitchenSchichtTimingOptimierer({ orders, batches, stops }: Props) {
  const [now, setNow] = useState<Date>(() => new Date());
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const enrichedOrders: EnrichedOrder[] = useCallback(() => {
    // Only pending delivery orders that are not yet delivered
    const pendingDeliveryOrders = orders.filter(
      (o) =>
        o.typ === 'lieferung' &&
        (o.status === 'neu' || o.status === 'bestätigt' || o.status === 'in_zubereitung'),
    );

    return pendingDeliveryOrders.map((order): EnrichedOrder => {
      // Find the stop that links this order to a batch
      const stop = stops.find((s) => s.order_id === order.id && s.geliefert_am === null);
      const batch = stop ? batches.find((b) => b.id === stop.batch_id) : null;

      let driverArrivalAt: Date | null = null;
      let cookByAt: Date | null = null;
      let secondsUntilCookBy: number | null = null;

      if (batch && batch.started_at && batch.total_eta_min !== null) {
        const startedAt = new Date(batch.started_at);
        driverArrivalAt = new Date(startedAt.getTime() + batch.total_eta_min * 60 * 1000);

        const prepMin = order.geschaetzte_zubereitung_min ?? 15;
        cookByAt = new Date(driverArrivalAt.getTime() - prepMin * 60 * 1000);
        secondsUntilCookBy = Math.round((cookByAt.getTime() - now.getTime()) / 1000);
      }

      return {
        order,
        driverArrivalAt,
        cookByAt,
        secondsUntilCookBy,
        batchId: batch?.id ?? null,
      };
    });
  }, [orders, batches, stops, now])();

  // Sort by urgency: overdue first, then by secondsUntilCookBy ascending, unscheduled last
  const sorted = [...enrichedOrders].sort((a, b) => {
    if (a.secondsUntilCookBy === null && b.secondsUntilCookBy === null) return 0;
    if (a.secondsUntilCookBy === null) return 1;
    if (b.secondsUntilCookBy === null) return -1;
    return a.secondsUntilCookBy - b.secondsUntilCookBy;
  });

  return (
    <div className="w-full rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-[#4a7c59] text-white hover:bg-[#3d6b4a] transition-colors"
      >
        <div className="flex items-center gap-2">
          <ChefHat className="w-5 h-5" />
          <span className="font-semibold text-sm">Schicht-Timing Optimierer</span>
          {sorted.length > 0 && (
            <span className="ml-1 bg-white/20 text-white text-xs font-medium px-2 py-0.5 rounded-full">
              {sorted.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-white/70">
          <Clock className="w-3.5 h-3.5" />
          <span>{formatTime(now)}</span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Body */}
      {expanded && (
        <div className="p-3 space-y-2">
          {sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-gray-400">
              <Truck className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm font-medium">Keine ausstehenden Lieferungen</p>
            </div>
          ) : (
            sorted.map((item) => {
              const urgency = getUrgency(item.secondsUntilCookBy);
              const cfg = urgencyConfig[urgency];

              return (
                <div
                  key={item.order.id}
                  className={cn(
                    'flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-lg border p-3 transition-all',
                    cfg.cardBorderClass,
                    urgency === 'overdue' && 'bg-red-50',
                    urgency === 'now' && 'bg-orange-50',
                    urgency === 'soon' && 'bg-yellow-50/60',
                  )}
                >
                  {/* Left: order info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-gray-900 truncate">
                        #{item.order.bestellnummer}
                      </span>
                      <span className="text-xs text-gray-500 truncate">{item.order.kunde_name}</span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {/* Driver ETA */}
                      {item.driverArrivalAt ? (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Truck className="w-3 h-3" />
                          <span>Fahrer zurück: {formatTime(item.driverArrivalAt)}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-xs text-gray-400">
                          <Truck className="w-3 h-3" />
                          <span>Kein Fahrer zugewiesen</span>
                        </div>
                      )}

                      {/* Cook-by time */}
                      {item.cookByAt && (
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <ChefHat className="w-3 h-3" />
                          <span>Start bis: {formatTime(item.cookByAt)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: countdown + badge */}
                  <div className="flex sm:flex-col items-center sm:items-end gap-2 sm:gap-1 shrink-0">
                    {item.secondsUntilCookBy !== null ? (
                      <span
                        className={cn(
                          'font-mono font-bold text-lg leading-none tabular-nums',
                          urgency === 'ok' && 'text-green-700',
                          urgency === 'soon' && 'text-yellow-700',
                          urgency === 'now' && 'text-orange-700',
                          urgency === 'overdue' && 'text-red-700',
                        )}
                      >
                        {formatCountdown(item.secondsUntilCookBy)}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">–</span>
                    )}

                    <Badge
                      variant="outline"
                      className={cn(
                        'flex items-center gap-1 text-xs font-medium px-2 py-0.5 border',
                        cfg.badgeClass,
                      )}
                    >
                      {cfg.icon}
                      {cfg.label}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
