'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, Clock, Bike, Package, Target, Euro, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface LiveMetrik {
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'flat';
  color: 'matcha' | 'amber' | 'red' | 'blue' | 'emerald';
  icon: React.ReactNode;
}

const colorMap = {
  matcha:  { bg: 'bg-matcha-50 dark:bg-matcha-900/20',  text: 'text-matcha-700 dark:text-matcha-300',  sub: 'text-matcha-500'  },
  amber:   { bg: 'bg-amber-50 dark:bg-amber-900/20',     text: 'text-amber-700 dark:text-amber-300',    sub: 'text-amber-500'   },
  red:     { bg: 'bg-red-50 dark:bg-red-900/20',         text: 'text-red-700 dark:text-red-300',        sub: 'text-red-500'     },
  blue:    { bg: 'bg-blue-50 dark:bg-blue-900/20',       text: 'text-blue-700 dark:text-blue-300',      sub: 'text-blue-500'    },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300',sub: 'text-emerald-500' },
};

type ShiftSnapshot = {
  orders: number;
  revenue: number;
  avgDeliveryMin: number | null;
  onTimePct: number | null;
  activeDrivers: number;
  pendingOrders: number;
};

export function LieferdienstLiveMetrikenLeiste({ locationId }: { locationId?: string | null }) {
  const supabase = createClient();
  const [snap, setSnap] = useState<ShiftSnapshot | null>(null);
  const [prevSnap, setPrevSnap] = useState<ShiftSnapshot | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const baseQuery = supabase
          .from('customer_orders')
          .select('id, gesamtbetrag, status, lieferung_abgeschlossen_am, fertig_am, typ')
          .gte('bestellt_am', today.toISOString())
          .in('status', ['geliefert', 'abgeholt', 'abgeschlossen', 'fertig', 'unterwegs', 'in_zubereitung', 'bestätigt', 'neu']);

        const { data: orders } = locationId
          ? await baseQuery.eq('location_id', locationId)
          : await baseQuery;

        const { data: driverStatus } = await supabase
          .from('driver_status')
          .select('ist_online')
          .eq('ist_online', true);

        const allOrders = (orders ?? []) as any[];
        const delivered = allOrders.filter((o) => ['geliefert', 'abgeholt', 'abgeschlossen'].includes(o.status));
        const pending   = allOrders.filter((o) => ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs'].includes(o.status));
        const revenue   = delivered.reduce((s: number, o: any) => s + (o.gesamtbetrag ?? 0), 0);

        const withTime = delivered.filter(
          (o: any) => o.fertig_am && o.lieferung_abgeschlossen_am,
        );
        const avgMin = withTime.length > 0
          ? withTime.reduce((s: number, o: any) => {
              const diff = (new Date(o.lieferung_abgeschlossen_am).getTime() - new Date(o.fertig_am).getTime()) / 60_000;
              return s + diff;
            }, 0) / withTime.length
          : null;

        const onTime = withTime.filter((o: any) => {
          if (!o.eta_earliest || !o.lieferung_abgeschlossen_am) return false;
          return new Date(o.lieferung_abgeschlossen_am) <= new Date(o.eta_earliest);
        });
        const onTimePct = withTime.length > 0 ? Math.round((onTime.length / withTime.length) * 100) : null;

        setPrevSnap(snap);
        setSnap({
          orders: delivered.length,
          revenue,
          avgDeliveryMin: avgMin ? Math.round(avgMin) : null,
          onTimePct,
          activeDrivers: (driverStatus ?? []).length,
          pendingOrders: pending.length,
        });
      } catch {
        // ignore
      }
    }

    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  function trend(curr: number | null, prev: number | null, invertBad = false): 'up' | 'down' | 'flat' {
    if (curr == null || prev == null) return 'flat';
    if (curr > prev) return invertBad ? 'down' : 'up';
    if (curr < prev) return invertBad ? 'up' : 'down';
    return 'flat';
  }

  const metriken: LiveMetrik[] = snap ? [
    {
      label: 'Lieferungen',
      value: String(snap.orders),
      subValue: snap.pendingOrders > 0 ? `+${snap.pendingOrders} offen` : undefined,
      trend: trend(snap.orders, prevSnap?.orders),
      color: 'matcha',
      icon: <Package className="h-4 w-4" />,
    },
    {
      label: 'Umsatz',
      value: snap.revenue.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €',
      trend: trend(snap.revenue, prevSnap?.revenue),
      color: 'emerald',
      icon: <Euro className="h-4 w-4" />,
    },
    {
      label: 'Ø Lieferzeit',
      value: snap.avgDeliveryMin != null ? `${snap.avgDeliveryMin} Min` : '—',
      trend: trend(snap.avgDeliveryMin, prevSnap?.avgDeliveryMin, true),
      color: snap.avgDeliveryMin != null && snap.avgDeliveryMin > 35 ? 'red' : snap.avgDeliveryMin != null && snap.avgDeliveryMin > 25 ? 'amber' : 'matcha',
      icon: <Clock className="h-4 w-4" />,
    },
    {
      label: 'Pünktlich',
      value: snap.onTimePct != null ? `${snap.onTimePct}%` : '—',
      trend: trend(snap.onTimePct, prevSnap?.onTimePct),
      color: snap.onTimePct != null && snap.onTimePct < 70 ? 'red' : snap.onTimePct != null && snap.onTimePct < 85 ? 'amber' : 'matcha',
      icon: <Target className="h-4 w-4" />,
    },
    {
      label: 'Fahrer online',
      value: String(snap.activeDrivers),
      trend: trend(snap.activeDrivers, prevSnap?.activeDrivers),
      color: snap.activeDrivers === 0 ? 'red' : snap.activeDrivers < 2 ? 'amber' : 'blue',
      icon: <Bike className="h-4 w-4" />,
    },
  ] : [];

  if (!snap) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-stone-100 animate-pulse" />
        ))}
      </div>
    );
  }

  const TrendIcon = ({ t }: { t?: 'up' | 'down' | 'flat' }) =>
    t === 'up'   ? <TrendingUp   className="h-3 w-3 text-emerald-500" /> :
    t === 'down' ? <TrendingDown className="h-3 w-3 text-red-500" /> :
                   <Minus        className="h-3 w-3 text-stone-400" />;

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {metriken.map((m) => {
        const c = colorMap[m.color];
        return (
          <div key={m.label} className={cn('rounded-xl border p-3 relative overflow-hidden', c.bg)}>
            <div className={cn('absolute top-2 right-2 opacity-20', c.text)}>
              {m.icon}
            </div>
            <div className={cn('text-[10px] font-bold uppercase tracking-wider mb-1', c.sub)}>
              {m.label}
            </div>
            <div className="flex items-end gap-1">
              <span className={cn('text-xl font-black tabular-nums leading-none', c.text)}>
                {m.value}
              </span>
              {m.trend && <TrendIcon t={m.trend} />}
            </div>
            {m.subValue && (
              <div className={cn('text-[9px] font-semibold mt-0.5', c.sub)}>
                {m.subValue}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
