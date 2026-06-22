'use client';

import React, { useState, useEffect } from 'react';
import { Clock, ChefHat, CreditCard, Package, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderItem {
  name: string;
  menge: number;
}

interface QueueOrder {
  id: string;
  bestellnummer: string;
  kunde_name: string;
  status: string;
  geschaetzte_zubereitung_min: number | null;
  bestellt_am: string | null;
  fertig_am: string | null;
  items: OrderItem[];
  zahlungsart: string | null;
}

type ColorBand = 'green' | 'amber' | 'red';

interface DerivedOrder extends QueueOrder {
  band: ColorBand;
  elapsedSec: number;
  targetSec: number;
  remainSec: number;
  pctUsed: number;
}

const MOCK_ORDERS: QueueOrder[] = [
  {
    id: 'mock-1',
    bestellnummer: 'B-4421',
    kunde_name: 'Maria Müller',
    status: 'in_zubereitung',
    geschaetzte_zubereitung_min: 20,
    bestellt_am: new Date(Date.now() - 8 * 60_000).toISOString(),
    fertig_am: null,
    items: [{ name: 'Margherita', menge: 2 }, { name: 'Pommes', menge: 1 }],
    zahlungsart: 'karte',
  },
  {
    id: 'mock-2',
    bestellnummer: 'B-4422',
    kunde_name: 'Jonas Weber',
    status: 'in_zubereitung',
    geschaetzte_zubereitung_min: 15,
    bestellt_am: new Date(Date.now() - 13 * 60_000).toISOString(),
    fertig_am: null,
    items: [{ name: 'Burger Classic', menge: 1 }, { name: 'Cola', menge: 2 }],
    zahlungsart: 'bar',
  },
  {
    id: 'mock-3',
    bestellnummer: 'B-4423',
    kunde_name: 'Anna Schmidt',
    status: 'in_zubereitung',
    geschaetzte_zubereitung_min: 18,
    bestellt_am: new Date(Date.now() - 22 * 60_000).toISOString(),
    fertig_am: null,
    items: [{ name: 'Salat Bowl', menge: 1 }, { name: 'Limonade', menge: 1 }, { name: 'Tiramisu', menge: 2 }],
    zahlungsart: 'online',
  },
  {
    id: 'mock-4',
    bestellnummer: 'B-4424',
    kunde_name: 'Peter Braun',
    status: 'bestätigt',
    geschaetzte_zubereitung_min: 25,
    bestellt_am: new Date(Date.now() - 3 * 60_000).toISOString(),
    fertig_am: null,
    items: [{ name: 'Pizza Diavola', menge: 1 }],
    zahlungsart: 'karte',
  },
];

function fmtCountdown(remainSec: number, overdue: boolean): string {
  const absSec = Math.abs(remainSec);
  const m = Math.floor(absSec / 60);
  const s = absSec % 60;
  const time = `${m}:${String(s).padStart(2, '0')}`;
  return overdue ? `+${time}` : time;
}

function deriveOrder(order: QueueOrder, nowMs: number): DerivedOrder {
  const targetSec = (order.geschaetzte_zubereitung_min ?? 20) * 60;
  const startMs = order.bestellt_am ? new Date(order.bestellt_am).getTime() : nowMs;
  const elapsedSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
  const remainSec = targetSec - elapsedSec;
  const pctUsed = targetSec > 0 ? (elapsedSec / targetSec) * 100 : 0;

  let band: ColorBand = 'green';
  if (pctUsed >= 100) band = 'red';
  else if (pctUsed >= 75) band = 'amber';

  return { ...order, band, elapsedSec, targetSec, remainSec, pctUsed };
}

const BAND_STYLES: Record<ColorBand, { card: string; badge: string; timer: string; bar: string }> = {
  green: {
    card: 'bg-matcha-50 border-matcha-200',
    badge: 'bg-matcha-100 text-matcha-700',
    timer: 'text-matcha-700',
    bar: 'bg-matcha-500',
  },
  amber: {
    card: 'bg-amber-50 border-amber-200',
    badge: 'bg-amber-100 text-amber-800',
    timer: 'text-amber-700',
    bar: 'bg-amber-400',
  },
  red: {
    card: 'bg-red-50 border-red-200 animate-pulse',
    badge: 'bg-red-100 text-red-700',
    timer: 'text-red-700',
    bar: 'bg-red-500',
  },
};

function PaymentBadge({ zahlungsart }: { zahlungsart: string | null }) {
  const label = zahlungsart === 'karte' ? 'Karte'
    : zahlungsart === 'bar' ? 'Bar'
    : zahlungsart === 'online' ? 'Online'
    : zahlungsart ?? '—';
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[9px] font-bold text-gray-600">
      <CreditCard className="h-2.5 w-2.5 shrink-0" />
      {label}
    </span>
  );
}

function OrderCard({ order }: { order: DerivedOrder }) {
  const styles = BAND_STYLES[order.band];
  const overdue = order.remainSec < 0;
  const itemCount = order.items.reduce((s, i) => s + i.menge, 0);
  const topItems = order.items.slice(0, 3);
  const progressPct = Math.min(100, Math.round(order.pctUsed));

  return (
    <div className={cn('relative rounded-xl border-2 p-3 flex flex-col gap-2', styles.card)}>
      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-xl bg-gray-100 overflow-hidden">
        <div
          className={cn('h-full rounded-b-xl transition-all duration-1000', styles.bar)}
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Top row: order number + countdown */}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-black text-gray-700 shrink-0">
          #{order.bestellnummer}
        </span>
        <div className="flex items-center gap-1">
          {overdue ? (
            <AlertTriangle className={cn('h-3.5 w-3.5 shrink-0', styles.timer)} />
          ) : (
            <Clock className={cn('h-3.5 w-3.5 shrink-0', styles.timer)} />
          )}
          <span className={cn('font-mono text-base font-black tabular-nums leading-none', styles.timer)}>
            {fmtCountdown(order.remainSec, overdue)}
          </span>
        </div>
      </div>

      {/* Customer name */}
      <div className="text-xs font-bold text-gray-900 truncate leading-tight">
        {order.kunde_name}
      </div>

      {/* Items preview */}
      <div className="space-y-0.5 flex-1">
        {topItems.map((item, i) => (
          <div key={i} className="flex items-center gap-1 text-[10px] text-gray-600">
            <span className={cn(
              'h-3.5 w-3.5 shrink-0 rounded-full flex items-center justify-center text-[8px] font-black',
              styles.badge,
            )}>
              {item.menge}
            </span>
            <span className="truncate">{item.name}</span>
          </div>
        ))}
        {order.items.length > 3 && (
          <div className="text-[9px] text-gray-400">+{order.items.length - 3} weitere</div>
        )}
      </div>

      {/* Bottom row: item count + payment */}
      <div className="flex items-center justify-between gap-1 pt-0.5">
        <span className="inline-flex items-center gap-0.5 text-[9px] text-gray-500 font-semibold">
          <Package className="h-2.5 w-2.5 shrink-0" />
          {itemCount} Pos.
        </span>
        <PaymentBadge zahlungsart={order.zahlungsart} />
      </div>
    </div>
  );
}

export function KitchenSmartPrepColorboard() {
  const [orders, setOrders] = useState<QueueOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    async function fetchOrders() {
      try {
        const res = await fetch('/api/delivery/kitchen/queue');
        if (!res.ok) throw new Error('fetch failed');
        const data = await res.json();
        setOrders(data.orders ?? []);
      } catch {
        setOrders(MOCK_ORDERS);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
    const pollInterval = setInterval(fetchOrders, 20_000);
    return () => clearInterval(pollInterval);
  }, []);

  useEffect(() => {
    const tickInterval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tickInterval);
  }, []);

  const activeOrders = orders.filter(
    (o) => ['bestätigt', 'in_zubereitung'].includes(o.status),
  );

  const derived = activeOrders.map((o) => deriveOrder(o, now));

  derived.sort((a, b) => {
    const bandOrder: Record<ColorBand, number> = { red: 0, amber: 1, green: 2 };
    const bandDiff = bandOrder[a.band] - bandOrder[b.band];
    if (bandDiff !== 0) return bandDiff;
    return a.remainSec - b.remainSec;
  });

  const greenCount = derived.filter((o) => o.band === 'green').length;
  const amberCount = derived.filter((o) => o.band === 'amber').length;
  const redCount   = derived.filter((o) => o.band === 'red').length;

  return (
    <div className="rounded-xl border border-matcha-200 bg-white overflow-hidden shadow-sm">
      {/* Header strip */}
      <div className="flex items-center gap-2 px-3 py-2 bg-matcha-600 flex-wrap">
        <ChefHat className="h-4 w-4 text-matcha-100 shrink-0" />
        <span className="text-[11px] font-black uppercase tracking-widest text-matcha-100">
          Prep-Board
        </span>
        <span className="text-[10px] text-matcha-200 font-semibold">
          {loading ? 'Lädt…' : `${derived.length} aktiv`}
        </span>

        <div className="ml-auto flex items-center gap-1.5 flex-wrap">
          {greenCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-matcha-500 px-2 py-0.5 text-[9px] font-black text-white">
              <CheckCircle2 className="h-2.5 w-2.5" />
              {greenCount} im Plan
            </span>
          )}
          {amberCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black text-white">
              <Clock className="h-2.5 w-2.5" />
              {amberCount} knapp
            </span>
          )}
          {redCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-black text-white animate-pulse">
              <AlertTriangle className="h-2.5 w-2.5" />
              {redCount} überfällig
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-gray-400 font-semibold">
            <Clock className="h-4 w-4 mr-2 animate-spin" />
            Lade Bestellungen…
          </div>
        ) : derived.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <CheckCircle2 className="h-6 w-6 text-matcha-500" />
            <span className="text-sm font-bold text-matcha-700">Keine aktiven Bestellungen</span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {derived.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      {derived.length > 0 && (
        <div className="flex items-center gap-4 px-3 pb-2 text-[9px] text-gray-400 flex-wrap">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-matcha-500 inline-block" />
            Unter Zielzeit
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
            75–100% verbraucht
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
            Überfällig
          </span>
        </div>
      )}
    </div>
  );
}
