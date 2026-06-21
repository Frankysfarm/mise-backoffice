'use client';

import { useEffect, useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type TodayStats = {
  total_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  revenue: number;
  revenue_prev: number;
  orders_prev: number;
  avg_delivery_min: number | null;
  on_time_pct: number | null;
  active_drivers: number;
  orders_per_hour: number;
};

function euro(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

function Skeleton() {
  return (
    <div className="rounded-xl border bg-white p-4 space-y-4">
      <div className="h-5 w-32 bg-gray-100 rounded animate-pulse" />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  );
}

interface KpiCardProps {
  label: string;
  value: string;
  delta?: string | null;
  deltaPositive?: boolean;
  colorClass?: string;
}

function KpiCard({ label, value, delta, deltaPositive, colorClass }: KpiCardProps) {
  return (
    <div className="rounded-lg border bg-white p-3 space-y-1">
      <div className="text-xs text-muted-foreground font-medium">{label}</div>
      <div className={cn('text-xl font-black', colorClass ?? 'text-foreground')}>{value}</div>
      {delta != null && (
        <div className={cn(
          'flex items-center gap-0.5 text-xs font-semibold',
          deltaPositive ? 'text-green-600' : 'text-red-500',
        )}>
          {deltaPositive
            ? <TrendingUp className="h-3 w-3" />
            : <TrendingDown className="h-3 w-3" />}
          {delta}
        </div>
      )}
    </div>
  );
}

export function LieferdienstTagesKPIPanel({ locationId }: { locationId: string }) {
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/stats?period=today&location_id=${locationId}`, { cache: 'no-store' });
        if (res.ok && !cancelled) {
          const d = await res.json();
          setStats(d);
          setLastUpdated(new Date());
        }
      } catch {
        // silently ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (loading) return <Skeleton />;
  if (!stats || stats.total_orders === 0) return null;

  const ordersDelta = stats.orders_prev > 0
    ? `${((stats.total_orders - stats.orders_prev) / stats.orders_prev * 100).toFixed(0)}% vs. gestern`
    : null;
  const ordersUp = stats.orders_prev > 0 ? stats.total_orders >= stats.orders_prev : true;

  const revenueDelta = stats.revenue_prev > 0
    ? `${((stats.revenue - stats.revenue_prev) / stats.revenue_prev * 100).toFixed(0)}% vs. gestern`
    : null;
  const revenueUp = stats.revenue_prev > 0 ? stats.revenue >= stats.revenue_prev : true;

  const delivTimeColor = stats.avg_delivery_min == null ? undefined :
    stats.avg_delivery_min < 30 ? 'text-green-600' :
    stats.avg_delivery_min < 45 ? 'text-amber-600' :
    'text-red-600';

  const onTimeColor = stats.on_time_pct == null ? undefined :
    stats.on_time_pct > 90 ? 'text-green-600' :
    stats.on_time_pct > 70 ? 'text-amber-600' :
    'text-red-600';

  return (
    <div className="rounded-xl border bg-white p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-matcha-600" />
          <span className="font-bold text-sm">Heute Live</span>
        </div>
        {lastUpdated && (
          <span className="text-[10px] text-muted-foreground">
            Aktualisiert {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Bestellungen"
          value={String(stats.total_orders)}
          delta={ordersDelta}
          deltaPositive={ordersUp}
        />
        <KpiCard
          label="Umsatz"
          value={euro(stats.revenue)}
          delta={revenueDelta}
          deltaPositive={revenueUp}
        />
        <KpiCard
          label="Ø Lieferzeit"
          value={stats.avg_delivery_min != null ? `${Math.round(stats.avg_delivery_min)} min` : '—'}
          colorClass={delivTimeColor}
        />
        <KpiCard
          label="Pünktlichkeit"
          value={stats.on_time_pct != null ? `${Math.round(stats.on_time_pct)}%` : '—'}
          colorClass={onTimeColor}
        />
      </div>

      {/* Bottom row */}
      <div className="flex items-center gap-4 pt-1 text-xs text-muted-foreground">
        <div>
          <span className="font-bold text-foreground">{stats.active_drivers}</span> aktive Fahrer
        </div>
        <div>
          <span className="font-bold text-foreground">{stats.orders_per_hour.toFixed(1)}</span> Bestellungen/h
        </div>
        <div>
          <span className="font-bold text-green-600">{stats.delivered_orders}</span> geliefert
        </div>
        {stats.cancelled_orders > 0 && (
          <div>
            <span className="font-bold text-red-500">{stats.cancelled_orders}</span> storniert
          </div>
        )}
      </div>
    </div>
  );
}
