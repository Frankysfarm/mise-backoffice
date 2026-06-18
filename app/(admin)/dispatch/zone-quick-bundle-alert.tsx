'use client';

import { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import { Package, MapPin, Clock, Zap, CheckCircle2, ArrowRight } from 'lucide-react';

type ReadyOrder = {
  id: string;
  bestellnummer: string;
  status: string;
  typ: string;
  kunde_adresse: string | null;
  delivery_zone: string | null;
  gesamtbetrag: number;
  fertig_am: string | null;
  dispatch_score: number | null;
};

type BundleUrgency = 'sofort' | 'bald' | 'normal';

type BundleOpportunity = {
  zone: string;
  orders: ReadyOrder[];
  totalValue: number;
  maxWaitMin: number;
  urgency: BundleUrgency;
};

function computeOpportunities(orders: ReadyOrder[], now: number): BundleOpportunity[] {
  const ready = orders.filter((o) => o.status === 'fertig' && o.delivery_zone);

  const map = new Map<string, ReadyOrder[]>();
  for (const order of ready) {
    const zone = order.delivery_zone!;
    if (!map.has(zone)) map.set(zone, []);
    map.get(zone)!.push(order);
  }

  const opportunities: BundleOpportunity[] = [];

  for (const [zone, zoneOrders] of map.entries()) {
    if (zoneOrders.length < 2) continue;

    const totalValue = zoneOrders.reduce((sum, o) => sum + o.gesamtbetrag, 0);

    const maxWaitMin = zoneOrders.reduce((max, o) => {
      if (!o.fertig_am) return max;
      const waitMs = now - new Date(o.fertig_am).getTime();
      const waitMin = Math.floor(waitMs / 60_000);
      return Math.max(max, waitMin);
    }, 0);

    let urgency: BundleUrgency = 'normal';
    if (maxWaitMin > 10) urgency = 'sofort';
    else if (maxWaitMin >= 5) urgency = 'bald';

    opportunities.push({ zone, orders: zoneOrders, totalValue, maxWaitMin, urgency });
  }

  return opportunities
    .sort((a, b) => {
      const rank: Record<BundleUrgency, number> = { sofort: 0, bald: 1, normal: 2 };
      return rank[a.urgency] - rank[b.urgency] || b.orders.length - a.orders.length;
    })
    .slice(0, 3);
}

const URGENCY_STYLE: Record<
  BundleUrgency,
  { card: string; badge: string; badgeText: string; icon: string; button: string; label: string }
> = {
  sofort: {
    card: 'border-red-300 bg-red-50',
    badge: 'bg-red-500 text-white',
    badgeText: 'Sofort!',
    icon: 'text-red-500',
    button: 'bg-red-500 hover:bg-red-600 text-white',
    label: 'Dringend',
  },
  bald: {
    card: 'border-amber-300 bg-amber-50',
    badge: 'bg-amber-400 text-white',
    badgeText: 'Bald',
    icon: 'text-amber-500',
    button: 'bg-amber-400 hover:bg-amber-500 text-white',
    label: 'Empfohlen',
  },
  normal: {
    card: 'border-matcha-300 bg-matcha-50',
    badge: 'bg-matcha-500 text-white',
    badgeText: 'Normal',
    icon: 'text-matcha-600',
    button: 'bg-matcha-500 hover:bg-matcha-600 text-white',
    label: 'Bereit',
  },
};

export function ZoneQuickBundleAlert({ orders }: { orders: ReadyOrder[] }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);

  const now = Date.now();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const opportunities = computeOpportunities(orders, now);

  if (opportunities.length === 0) return null;

  return (
    <div className="rounded-xl border border-matcha-200 bg-white overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-matcha-100 bg-matcha-50">
        <Zap className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-black uppercase tracking-widest text-matcha-800">
          Bündel-Möglichkeiten
        </span>
        <span className="ml-1 rounded-full bg-matcha-500 text-white text-[10px] font-black px-2 py-0.5">
          {opportunities.length}
        </span>
        <span className="ml-auto text-[10px] text-matcha-500 font-medium">
          Wann gebündelt werden?
        </span>
      </div>

      {/* Zone cards */}
      <div className="divide-y divide-matcha-100">
        {opportunities.map((opp) => {
          const s = URGENCY_STYLE[opp.urgency];

          return (
            <div
              key={opp.zone}
              className={cn('flex items-start gap-3 px-4 py-3 border-l-4', s.card)}
            >
              {/* Zone icon */}
              <MapPin className={cn('h-4 w-4 mt-0.5 shrink-0', s.icon)} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-sm font-bold text-gray-800 truncate">
                    Zone {opp.zone}
                  </span>
                  <span
                    className={cn(
                      'rounded-full text-[9px] font-black px-2 py-0.5 shrink-0',
                      s.badge,
                    )}
                  >
                    {s.badgeText}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Order count */}
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <Package className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="font-bold text-gray-800">{opp.orders.length}</span>
                    <span>Bestellungen</span>
                  </div>

                  {/* Total value */}
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <CheckCircle2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="font-bold text-gray-800">{euro(opp.totalValue)}</span>
                  </div>

                  {/* Wait time */}
                  <div className="flex items-center gap-1 text-xs text-gray-600">
                    <Clock className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span>
                      Wartet{' '}
                      <span className="font-bold text-gray-800">{opp.maxWaitMin} Min.</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Bundle button */}
              <button
                type="button"
                className={cn(
                  'shrink-0 flex items-center gap-1 rounded-lg px-3 py-1.5 text-[11px] font-black uppercase tracking-wide transition-colors',
                  s.button,
                )}
              >
                BÜNDELN
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
