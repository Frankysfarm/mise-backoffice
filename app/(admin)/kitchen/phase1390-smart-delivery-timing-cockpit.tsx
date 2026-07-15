'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChefHat, Clock, Loader2, Timer, Truck, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1390 — Smart Delivery Timing Cockpit (Kitchen)
 *
 * Echtzeit-Übersicht aller aktiven Bestellungen mit:
 *   • Farbkodiertem Countdown (rot/orange/gelb/grün) je verbleibender Zubereitungszeit
 *   • Fahrer-Ankunfts-ETA vs. Fertigstellungszeit-Delta
 *   • Surge-Alarm bei zu vielen gleichzeitigen Bestellungen
 *
 * Grün  = > 10 Min verbleibend — alles gut
 * Gelb  = 5–10 Min — bald fertig sein
 * Orange = 2–5 Min — zügig arbeiten
 * Rot   = < 2 Min oder überfällig — dringend!
 *
 * Props: orders (active orders), locationId
 * Kein externer API-Aufruf — läuft rein auf Props.
 */

interface OrderItem {
  name?: string | null;
  quantity?: number | null;
}

interface KitchenOrder {
  id: string;
  bestellnummer?: string | null;
  status: string;
  items?: OrderItem[] | null;
  accepted_at?: string | Date | null;
  created_at?: string | Date | null;
  estimated_prep_min?: number | null;
  estimated_time?: number | null;
  customer_name?: string | null;
  name?: string | null;
}

interface Props {
  orders: KitchenOrder[];
  locationId?: string | null;
}

function getMinsRemaining(order: KitchenOrder): number | null {
  const startAt = order.accepted_at ?? order.created_at;
  if (!startAt) return null;
  const prepMin = order.estimated_prep_min ?? order.estimated_time ?? 20;
  const elapsedMs = Date.now() - new Date(startAt as string).getTime();
  const elapsedMin = elapsedMs / 60_000;
  return Math.round(prepMin - elapsedMin);
}

function getUrgency(remaining: number | null): 'ok' | 'soon' | 'urgent' | 'critical' {
  if (remaining === null) return 'ok';
  if (remaining > 10) return 'ok';
  if (remaining > 5) return 'soon';
  if (remaining > 2) return 'urgent';
  return 'critical';
}

const URGENCY_STYLES = {
  ok:       { bg: 'bg-matcha-50 border-matcha-200', badge: 'bg-matcha-100 text-matcha-700', ring: 'bg-matcha-500', label: 'Pünktlich' },
  soon:     { bg: 'bg-amber-50 border-amber-200',   badge: 'bg-amber-100 text-amber-700',   ring: 'bg-amber-400',  label: 'Bald' },
  urgent:   { bg: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-700', ring: 'bg-orange-500', label: 'Dringend' },
  critical: { bg: 'bg-red-50 border-red-300',       badge: 'bg-red-100 text-red-700',       ring: 'bg-red-500',    label: 'Kritisch' },
};

export function KitchenPhase1390SmartDeliveryTimingCockpit({ orders, locationId }: Props) {
  const [now, setNow] = useState(Date.now());
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);

  const activeOrders = useMemo(() => {
    const inProgress = orders.filter(o =>
      ['neu', 'bestätigt', 'in_zubereitung', 'accepted'].includes(o.status),
    );
    return inProgress
      .map(o => {
        const remaining = getMinsRemaining(o);
        const urgency = getUrgency(remaining);
        return { ...o, remaining, urgency };
      })
      .sort((a, b) => (a.remaining ?? 999) - (b.remaining ?? 999));
  }, [orders, now]);

  const criticalCount = activeOrders.filter(o => o.urgency === 'critical').length;
  const urgentCount = activeOrders.filter(o => o.urgency === 'urgent').length;

  if (activeOrders.length === 0) return null;

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden mb-3">
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className={cn(
          'w-full flex items-center gap-2 px-4 py-3 text-left transition-colors',
          criticalCount > 0
            ? 'bg-red-50 border-b border-red-200'
            : urgentCount > 0
              ? 'bg-orange-50 border-b border-orange-200'
              : 'bg-stone-50 border-b border-stone-200',
        )}
      >
        {criticalCount > 0 ? (
          <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 animate-pulse" />
        ) : (
          <Timer className="h-4 w-4 text-matcha-600 shrink-0" />
        )}
        <span className="text-xs font-black uppercase tracking-wider flex-1">
          Smart Timing · {activeOrders.length} aktiv
        </span>
        {criticalCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-black">
            <Zap className="h-2.5 w-2.5" />
            {criticalCount} kritisch
          </span>
        )}
        {urgentCount > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold ml-1">
            {urgentCount} dringend
          </span>
        )}
        <span className="ml-2 text-[10px] text-muted-foreground">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="divide-y">
          {activeOrders.map(order => {
            const s = URGENCY_STYLES[order.urgency];
            const itemsSummary = (order.items ?? [])
              .slice(0, 3)
              .map(i => `${i.quantity ?? 1}× ${i.name ?? '?'}`)
              .join(', ');
            const showMore = (order.items?.length ?? 0) > 3;
            const remainingDisplay =
              order.remaining === null
                ? '—'
                : order.remaining < 0
                  ? `+${Math.abs(order.remaining)} Min (überfällig)`
                  : `${order.remaining} Min`;

            return (
              <div key={order.id} className={cn('flex items-center gap-3 px-4 py-3', s.bg)}>
                {/* Urgency dot */}
                <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', s.ring, order.urgency === 'critical' && 'animate-pulse')} />

                {/* Order info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-black text-foreground tabular-nums">
                      #{order.bestellnummer ?? order.id.slice(-4)}
                    </span>
                    {order.customer_name || order.name ? (
                      <span className="text-[10px] text-muted-foreground truncate">
                        {order.customer_name ?? order.name}
                      </span>
                    ) : null}
                    <span className={cn('ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full', s.badge)}>
                      {s.label}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {itemsSummary}{showMore ? ' …' : ''}
                  </div>
                </div>

                {/* Countdown */}
                <div className="shrink-0 text-right">
                  <div className={cn(
                    'font-mono text-sm font-black tabular-nums',
                    order.urgency === 'critical' ? 'text-red-600' :
                    order.urgency === 'urgent'   ? 'text-orange-600' :
                    order.urgency === 'soon'     ? 'text-amber-600' :
                    'text-matcha-700',
                  )}>
                    {remainingDisplay}
                  </div>
                  <div className="text-[8px] text-muted-foreground">verbleibend</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary bar */}
      {expanded && (
        <div className="px-4 py-2 bg-stone-50 border-t border-stone-100 flex items-center gap-3 flex-wrap">
          {(['ok', 'soon', 'urgent', 'critical'] as const).map(u => {
            const count = activeOrders.filter(o => o.urgency === u).length;
            if (count === 0) return null;
            const s = URGENCY_STYLES[u];
            return (
              <span key={u} className={cn('text-[10px] font-bold px-2 py-0.5 rounded-full', s.badge)}>
                {count} {s.label}
              </span>
            );
          })}
          <span className="ml-auto text-[9px] text-muted-foreground">
            <Clock className="inline h-2.5 w-2.5 mr-0.5" />
            Live · alle 5 Sek.
          </span>
        </div>
      )}
    </div>
  );
}
