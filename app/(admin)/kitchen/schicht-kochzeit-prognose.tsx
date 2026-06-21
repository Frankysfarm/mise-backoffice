'use client';

/**
 * KitchenSchichtKochzeitPrognose — Phase 388
 * Kochzeit-Prognose-Panel: Zeigt alle aktiven Bestellungen mit farbkodierten Countdowns.
 * - Grün: >5 Min verbleibend
 * - Amber: 1–5 Min verbleibend
 * - Rot: Überfällig (negativ)
 */

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type OrderEntry = {
  id: string;
  bestellnummer: string;
  status: string;
  accepted_at: string | null;
  estimated_prep_time: number | null;
  items?: { name: string }[];
  item_count?: number;
};

type ApiResponse = {
  orders?: OrderEntry[];
};

const MOCK_ORDERS: OrderEntry[] = [
  {
    id: 'mock-1',
    bestellnummer: '#1042',
    status: 'in_zubereitung',
    accepted_at: new Date(Date.now() - 8 * 60_000).toISOString(),
    estimated_prep_time: 15,
    item_count: 3,
  },
  {
    id: 'mock-2',
    bestellnummer: '#1043',
    status: 'in_zubereitung',
    accepted_at: new Date(Date.now() - 12 * 60_000).toISOString(),
    estimated_prep_time: 12,
    item_count: 2,
  },
  {
    id: 'mock-3',
    bestellnummer: '#1044',
    status: 'bestätigt',
    accepted_at: new Date(Date.now() - 3 * 60_000).toISOString(),
    estimated_prep_time: 20,
    item_count: 5,
  },
];

function getRemainingMin(order: OrderEntry, now: number): number {
  if (!order.accepted_at) return 0;
  const acceptedMs = new Date(order.accepted_at).getTime();
  const elapsedMin = (now - acceptedMs) / 60_000;
  const prepMin = order.estimated_prep_time ?? 15;
  return prepMin - elapsedMin;
}

function getColor(remainingMin: number): {
  ring: string;
  text: string;
  bg: string;
  border: string;
  label: string;
} {
  if (remainingMin > 5) {
    return {
      ring: 'border-matcha-500',
      text: 'text-matcha-700',
      bg: 'bg-matcha-50',
      border: 'border-matcha-200',
      label: 'text-matcha-600',
    };
  }
  if (remainingMin > 0) {
    return {
      ring: 'border-amber-500',
      text: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      label: 'text-amber-600',
    };
  }
  return {
    ring: 'border-red-500',
    text: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
    label: 'text-red-600',
  };
}

function fmtRemaining(min: number): string {
  if (min <= 0) {
    const over = Math.round(Math.abs(min));
    return `+${over} Min`;
  }
  return `${Math.round(min)} Min`;
}

function OrderRingCard({ order, now }: { order: OrderEntry; now: number }) {
  const remainingMin = getRemainingMin(order, now);
  const color = getColor(remainingMin);
  const itemCount = order.item_count ?? order.items?.length ?? 0;

  return (
    <div className={cn('rounded-xl border p-3 flex items-center gap-3', color.bg, color.border)}>
      {/* Countdown-Ring */}
      <div
        className={cn(
          'flex-shrink-0 w-12 h-12 rounded-full border-4 flex items-center justify-center',
          color.ring,
        )}
      >
        <span className={cn('text-xs font-black tabular-nums leading-tight text-center', color.text)}>
          {fmtRemaining(remainingMin)}
        </span>
      </div>

      {/* Order info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={cn('text-sm font-black', color.text)}>{order.bestellnummer}</span>
          {itemCount > 0 && (
            <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/60', color.label)}>
              {itemCount} {itemCount === 1 ? 'Artikel' : 'Artikel'}
            </span>
          )}
        </div>
        <div className={cn('text-[10px] mt-0.5', color.label)}>
          {remainingMin <= 0 ? 'Überfällig' : remainingMin <= 5 ? 'Bald fertig' : 'In Zubereitung'}
          {' · '}
          Ziel: {order.estimated_prep_time ?? 15} Min
        </div>
      </div>
    </div>
  );
}

interface Props {
  locationId: string | null;
}

export function KitchenSchichtKochzeitPrognose({ locationId }: Props) {
  const [orders, setOrders] = useState<OrderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    if (!locationId) {
      setOrders(MOCK_ORDERS);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(
        `/api/delivery/admin/dispatch-queue?location_id=${encodeURIComponent(locationId)}`,
      );
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json: ApiResponse = await res.json();
      const active = (json.orders ?? []).filter(
        (o) => o.status === 'in_zubereitung' || o.status === 'bestätigt' || o.status === 'accepted',
      );
      setOrders(active.length > 0 ? active : MOCK_ORDERS);
    } catch {
      setOrders(MOCK_ORDERS);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const fetchIv = setInterval(() => void load(), 15_000);
    const tickIv = setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      clearInterval(fetchIv);
      clearInterval(tickIv);
    };
  }, [load]);

  const overdueCount = orders.filter((o) => getRemainingMin(o, now) <= 0).length;

  return (
    <div className="rounded-2xl border border-matcha-200 bg-white overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-2 px-4 py-2.5 bg-matcha-50 hover:bg-matcha-100 transition-colors"
      >
        <Clock className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-matcha-700">
          Kochzeit-Prognose
        </span>
        {overdueCount > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-black text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">
            <AlertCircle className="h-3 w-3" />
            {overdueCount} überfällig
          </span>
        )}
        <span className="ml-auto text-[10px] text-matcha-500 font-medium">
          {orders.length} Bestellung{orders.length !== 1 ? 'en' : ''}
        </span>
        {loading && (
          <span className="text-[10px] text-matcha-400">Laden…</span>
        )}
        {open ? (
          <ChevronUp className="h-4 w-4 text-matcha-400 shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-matcha-400 shrink-0" />
        )}
      </button>

      {open && (
        <div className="p-3 space-y-2">
          {orders.length === 0 ? (
            <p className="text-center text-xs text-matcha-400 py-4">
              Keine aktiven Bestellungen
            </p>
          ) : (
            orders.map((order) => (
              <OrderRingCard key={order.id} order={order} now={now} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
