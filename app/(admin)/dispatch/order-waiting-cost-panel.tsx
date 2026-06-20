'use client';

/**
 * DispatchOrderWaitingCostPanel — Zeigt Wartekosten je Bestellung in der Queue.
 * Jede nicht-zugewiesene Bestellung kostet: SLA-Risiko + Kundenzufriedenheit.
 * Hilft Disponenten, die dringlichsten Zuweisungen zu priorisieren.
 *
 * Daten: /api/delivery/dispatch/queue
 * Polling: 30s
 */

import { useEffect, useState } from 'react';
import { Clock, AlertTriangle, TrendingDown, Euro, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WaitingOrder {
  id: string;
  bestellnummer: string;
  created_at: string;
  estimated_value_eur: number;
  zone: string | null;
  dispatch_attempts: number;
  priority: number;
}

interface QueueResponse {
  queue: WaitingOrder[];
}

function waitMin(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 60_000);
}

function riskLevel(minutes: number, attempts: number): 'critical' | 'warning' | 'ok' {
  if (minutes >= 8 || attempts >= 3) return 'critical';
  if (minutes >= 4 || attempts >= 2) return 'warning';
  return 'ok';
}

function riskStyle(level: 'critical' | 'warning' | 'ok') {
  switch (level) {
    case 'critical': return { bg: 'bg-red-50',    border: 'border-red-200',   badge: 'bg-red-500 text-white',     label: 'Kritisch',  text: 'text-red-600'   };
    case 'warning':  return { bg: 'bg-amber-50',  border: 'border-amber-200', badge: 'bg-amber-400 text-white',   label: 'Dringend',  text: 'text-amber-600' };
    default:         return { bg: 'bg-muted/30',  border: 'border-border',    badge: 'bg-matcha-100 text-matcha-700', label: 'In Warteschlange', text: 'text-matcha-700' };
  }
}

const MOCK_QUEUE: WaitingOrder[] = [
  { id: 'o1', bestellnummer: '#2041', created_at: new Date(Date.now() - 9 * 60_000).toISOString(),  estimated_value_eur: 24.50, zone: 'Nord',   dispatch_attempts: 3, priority: 9 },
  { id: 'o2', bestellnummer: '#2042', created_at: new Date(Date.now() - 5 * 60_000).toISOString(),  estimated_value_eur: 18.90, zone: 'Mitte',  dispatch_attempts: 2, priority: 7 },
  { id: 'o3', bestellnummer: '#2043', created_at: new Date(Date.now() - 2 * 60_000).toISOString(),  estimated_value_eur: 32.00, zone: 'Süd',    dispatch_attempts: 0, priority: 5 },
  { id: 'o4', bestellnummer: '#2044', created_at: new Date(Date.now() - 1 * 60_000).toISOString(),  estimated_value_eur: 15.20, zone: 'West',   dispatch_attempts: 1, priority: 4 },
];

export function DispatchOrderWaitingCostPanel({ locationId }: { locationId: string | null }) {
  const [orders, setOrders] = useState<WaitingOrder[]>([]);
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!locationId) { setOrders(MOCK_QUEUE); return; }

    const load = () => {
      fetch(`/api/delivery/dispatch?action=queue&location_id=${encodeURIComponent(locationId)}`)
        .then((r) => r.json())
        .then((d: QueueResponse) => { if (d.queue?.length) setOrders(d.queue); })
        .catch(() => setOrders(MOCK_QUEUE));
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [locationId, tick]);

  const displayed = orders
    .map((o) => ({ ...o, waitMinutes: waitMin(o.created_at) }))
    .sort((a, b) => b.dispatch_attempts - a.dispatch_attempts || b.waitMinutes - a.waitMinutes)
    .slice(0, 6);

  const criticalCount = displayed.filter((o) => riskLevel(o.waitMinutes, o.dispatch_attempts) === 'critical').length;

  if (displayed.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/40 transition"
      >
        <Clock className="h-4 w-4 text-amber-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Warteschlange · Dringlichkeit</span>
        {criticalCount > 0 && (
          <span className="ml-1 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
            {criticalCount} krit.
          </span>
        )}
        <span className="ml-auto">
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </span>
      </button>

      {open && (
        <div className="border-t divide-y">
          {displayed.map((order) => {
            const level = riskLevel(order.waitMinutes, order.dispatch_attempts);
            const style = riskStyle(level);
            return (
              <div key={order.id} className={cn('flex items-center gap-3 px-4 py-3', style.bg)}>
                {/* Risk badge */}
                <div className={cn('shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black min-w-[62px] text-center', style.badge)}>
                  {style.label}
                </div>

                {/* Order info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold">{order.bestellnummer}</span>
                    {order.zone && (
                      <span className="text-[9px] rounded-full bg-white/70 border px-1.5 py-0.5 font-bold">
                        Zone {order.zone}
                      </span>
                    )}
                    {order.dispatch_attempts > 0 && (
                      <span className="flex items-center gap-0.5 text-[9px] text-red-600 font-bold">
                        <Zap className="h-2.5 w-2.5" />
                        {order.dispatch_attempts}× versucht
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className={cn('text-xs font-black tabular-nums', style.text)}>
                      {order.waitMinutes} Min gewartet
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Euro className="h-2.5 w-2.5" />
                      {order.estimated_value_eur.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Warning icon for critical */}
                {level === 'critical' && (
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 animate-pulse" />
                )}
                {level === 'warning' && (
                  <TrendingDown className="h-4 w-4 text-amber-500 shrink-0" />
                )}
              </div>
            );
          })}

          {/* Total at risk */}
          <div className="px-4 py-2.5 bg-muted/20 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground font-medium">
              {displayed.length} offene Bestellung{displayed.length !== 1 ? 'en' : ''}
            </span>
            <span className="text-[10px] font-bold text-foreground">
              {displayed.reduce((s, o) => s + o.estimated_value_eur, 0).toFixed(2)} € ausstehend
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
