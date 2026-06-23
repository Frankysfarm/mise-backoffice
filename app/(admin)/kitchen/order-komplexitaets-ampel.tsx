'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type RawOrder = {
  id: string;
  bestellnummer: string;
  items: { menge: number }[];
  geschaetzte_zubereitung_min: number | null;
};

type Tier = 'gruen' | 'gelb' | 'rot';

type TierGroup = {
  tier: Tier;
  orders: { id: string; bestellnummer: string }[];
};

const MOCK_ORDERS: RawOrder[] = [
  { id: 'm1', bestellnummer: '#1001', items: [{ menge: 1 }, { menge: 1 }], geschaetzte_zubereitung_min: 10 },
  { id: 'm2', bestellnummer: '#1002', items: [{ menge: 2 }, { menge: 2 }], geschaetzte_zubereitung_min: 16 },
  { id: 'm3', bestellnummer: '#1003', items: [{ menge: 3 }, { menge: 2 }, { menge: 1 }], geschaetzte_zubereitung_min: 25 },
];

function classifyOrder(order: RawOrder): Tier {
  const itemCount = order.items.reduce((s, i) => s + i.menge, 0);
  const prep = order.geschaetzte_zubereitung_min ?? 0;
  if (itemCount >= 6 || prep > 20) return 'rot';
  if (itemCount >= 3 || prep > 12) return 'gelb';
  return 'gruen';
}

const TIER_META: Record<Tier, { label: string; sublabel: string; circle: string; badge: string; text: string; border: string; bg: string }> = {
  gruen: {
    label: 'Einfach',
    sublabel: '≤2 Artikel, ≤12 Min',
    circle: 'bg-green-500',
    badge: 'bg-green-100 text-green-800',
    text: 'text-green-700',
    border: 'border-green-200',
    bg: 'bg-green-50',
  },
  gelb: {
    label: 'Mittel',
    sublabel: '3–5 Artikel oder ≤20 Min',
    circle: 'bg-amber-400',
    badge: 'bg-amber-100 text-amber-800',
    text: 'text-amber-700',
    border: 'border-amber-200',
    bg: 'bg-amber-50',
  },
  rot: {
    label: 'Komplex',
    sublabel: '≥6 Artikel oder >20 Min',
    circle: 'bg-red-500',
    badge: 'bg-red-100 text-red-800',
    text: 'text-red-700',
    border: 'border-red-200',
    bg: 'bg-red-50',
  },
};

function groupOrders(orders: RawOrder[]): TierGroup[] {
  const groups: Record<Tier, { id: string; bestellnummer: string }[]> = { gruen: [], gelb: [], rot: [] };
  for (const o of orders) {
    groups[classifyOrder(o)].push({ id: o.id, bestellnummer: o.bestellnummer });
  }
  return (['gruen', 'gelb', 'rot'] as Tier[]).map(tier => ({ tier, orders: groups[tier] }));
}

export function KitchenOrderKomplexitaetsAmpel({ locationId }: { locationId: string | null }) {
  const [groups, setGroups] = useState<TierGroup[]>(() => groupOrders(MOCK_ORDERS));
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(() => new Date());

  async function load() {
    if (!locationId) {
      setGroups(groupOrders(MOCK_ORDERS));
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/orders?location_id=${locationId}&status=pending,preparing`
      );
      if (!res.ok) throw new Error('not ok');
      const data = await res.json();
      const orders: RawOrder[] = Array.isArray(data) ? data : (data.orders ?? []);
      setGroups(groupOrders(orders));
    } catch {
      setGroups(groupOrders(MOCK_ORDERS));
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [locationId]);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5 items-center">
            <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
            <span className="inline-block h-3 w-3 rounded-full bg-amber-400" />
            <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
          </div>
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Bestellkomplexitäts-Ampel
          </span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 transition"
        >
          {loading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <RefreshCw className="h-3.5 w-3.5" />
          }
          <span className="tabular-nums">
            {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-3 divide-x px-0">
        {groups.map(({ tier, orders }) => {
          const meta = TIER_META[tier];
          return (
            <div key={tier} className={cn('flex flex-col items-center gap-2 px-4 py-4', meta.bg)}>
              <div className="relative">
                <span className={cn('flex h-12 w-12 items-center justify-center rounded-full shadow-sm', meta.circle)}>
                  <span className="text-white text-xl font-black font-display">{orders.length}</span>
                </span>
              </div>
              <div className="text-center">
                <div className={cn('text-xs font-bold uppercase tracking-wide', meta.text)}>{meta.label}</div>
                <div className="text-[10px] text-muted-foreground leading-tight mt-0.5">{meta.sublabel}</div>
              </div>
              {orders.length > 0 && (
                <div className="flex flex-col gap-1 w-full items-center">
                  {orders.slice(0, 3).map(o => (
                    <span
                      key={o.id}
                      className={cn('inline-block rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums', meta.badge)}
                    >
                      {o.bestellnummer}
                    </span>
                  ))}
                  {orders.length > 3 && (
                    <span className="text-[10px] text-muted-foreground">+{orders.length - 3} weitere</span>
                  )}
                </div>
              )}
              {orders.length === 0 && (
                <span className="text-[10px] text-muted-foreground">Keine</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
