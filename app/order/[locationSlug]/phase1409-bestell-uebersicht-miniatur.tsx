'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Package, Clock, Bike, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1409 — Bestell-Übersicht-Miniatur (Storefront)
 *
 * Kompakte aktive-Bestellung-Karte im Header (Status + ETA).
 * locationId + orderId basiert. 60s-Polling. Schließbar.
 */

type OrderStatus = 'pending' | 'preparing' | 'ready' | 'delivering' | 'delivered';

interface OrderInfo {
  id: string;
  status: OrderStatus;
  eta_min: number | null;
  item_count: number;
  created_at: string;
}

interface Props {
  locationId: string;
  orderId?: string | null;
}

const STATUS_CONFIG: Record<OrderStatus, { label: string; icon: typeof Package; color: string; bg: string; border: string }> = {
  pending: { label: 'Eingang', icon: Package, color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-50 dark:bg-slate-900/40', border: 'border-slate-200 dark:border-slate-700' },
  preparing: { label: 'In Zubereitung', icon: Package, color: 'text-amber-700 dark:text-amber-300', bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-700' },
  ready: { label: 'Fertig', icon: CheckCircle2, color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-200 dark:border-emerald-700' },
  delivering: { label: 'Unterwegs', icon: Bike, color: 'text-sky-700 dark:text-sky-300', bg: 'bg-sky-50 dark:bg-sky-950/20', border: 'border-sky-200 dark:border-sky-700' },
  delivered: { label: 'Geliefert ✓', icon: CheckCircle2, color: 'text-emerald-700 dark:text-emerald-300', bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-200 dark:border-emerald-700' },
};

const MOCK: OrderInfo = {
  id: 'mock-001',
  status: 'delivering',
  eta_min: 8,
  item_count: 3,
  created_at: new Date(Date.now() - 18 * 60 * 1000).toISOString(),
};

export function StorefrontPhase1409BestUebersichtMiniatur({ locationId, orderId }: Props) {
  const [order, setOrder] = useState<OrderInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!orderId) return;
    try {
      const res = await fetch(`/api/lieferdienst/orders/${orderId}`);
      if (!res.ok) throw new Error('api');
      const json = await res.json();
      setOrder({
        id: json.id ?? orderId,
        status: json.status ?? 'pending',
        eta_min: json.eta_min ?? null,
        item_count: json.items?.length ?? json.item_count ?? 1,
        created_at: json.created_at ?? new Date().toISOString(),
      });
    } catch {
      // Show mock only when orderId provided but API fails
      setOrder(MOCK);
    }
  }, [orderId]);

  useEffect(() => {
    if (!orderId || dismissed) return;
    load();
    timerRef.current = setInterval(load, 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load, orderId, dismissed]);

  if (!orderId || dismissed || !order) return null;
  if (order.status === 'delivered') return null;

  const cfg = STATUS_CONFIG[order.status];
  const Icon = cfg.icon;
  const elapsedMin = Math.round((Date.now() - new Date(order.created_at).getTime()) / 60000);

  return (
    <div className={cn('flex items-center gap-2 rounded-xl border px-3 py-2 text-xs shadow-sm', cfg.border, cfg.bg)}>
      <Icon className={cn('h-4 w-4 shrink-0', cfg.color)} />
      <div className="flex-1 min-w-0">
        <span className={cn('font-bold', cfg.color)}>{cfg.label}</span>
        <span className="text-muted-foreground ml-1.5">
          {order.item_count} {order.item_count === 1 ? 'Artikel' : 'Artikel'}
        </span>
        {order.eta_min != null && order.status === 'delivering' && (
          <span className={cn('ml-1.5 font-semibold', cfg.color)}>
            <Clock className="h-3 w-3 inline mr-0.5" />
            ~{order.eta_min} Min
          </span>
        )}
        {order.status !== 'delivering' && (
          <span className="text-muted-foreground ml-1.5">seit {elapsedMin} Min</span>
        )}
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 text-muted-foreground hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
        aria-label="Schließen"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
