'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import { BarChart2, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface Props {
  locationId: string;
}

interface TodayStats {
  orders: number;
  revenue_eur: number;
  avg_delivery_min: number;
  on_time_pct: number;
  active_drivers: number;
  pending_orders: number;
  cancelled_orders: number;
}

interface Trends {
  orders_delta_pct: number;
  revenue_delta_pct: number;
  delivery_time_delta_pct: number;
}

interface StatsData {
  today: TodayStats;
  trends: Trends;
}

const MOCK_DATA: StatsData = {
  today: {
    orders: 47,
    revenue_eur: 1284.5,
    avg_delivery_min: 32,
    on_time_pct: 84,
    active_drivers: 5,
    pending_orders: 3,
    cancelled_orders: 2,
  },
  trends: {
    orders_delta_pct: 12,
    revenue_delta_pct: 8.5,
    delivery_time_delta_pct: -5,
  },
};

function TrendIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-emerald-500" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-stone-400" />;
}

function TrendLabel({ delta, inverted = false }: { delta: number; inverted?: boolean }) {
  const isPositive = inverted ? delta < 0 : delta > 0;
  const isNegative = inverted ? delta > 0 : delta < 0;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 text-xs font-medium',
        isPositive && 'text-emerald-600',
        isNegative && 'text-red-500',
        delta === 0 && 'text-stone-400',
      )}
    >
      <TrendIcon delta={inverted ? -delta : delta} />
      {Math.abs(delta).toFixed(1)}%
    </span>
  );
}

function getOnTimeBg(pct: number): string {
  if (pct >= 90) return 'bg-emerald-50 border-emerald-200';
  if (pct >= 70) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

function getOnTimeText(pct: number): string {
  if (pct >= 90) return 'text-emerald-700';
  if (pct >= 70) return 'text-amber-700';
  return 'text-red-700';
}

interface KpiCardProps {
  label: string;
  value: string;
  subtitle?: string;
  trend?: React.ReactNode;
  className?: string;
  valueClass?: string;
}

function KpiCard({ label, value, subtitle, trend, className, valueClass }: KpiCardProps) {
  return (
    <div className={cn('rounded-xl border bg-white p-4 flex flex-col gap-1', className)}>
      <p className="text-xs font-medium text-stone-500 uppercase tracking-wide leading-tight">{label}</p>
      <p className={cn('text-2xl font-bold text-stone-800 leading-none', valueClass)}>{value}</p>
      {subtitle && <p className="text-xs text-stone-400">{subtitle}</p>}
      {trend && <div className="mt-1">{trend}</div>}
    </div>
  );
}

export function LieferdienstLiveStatistikPanel({ locationId }: Props) {
  const [data, setData] = useState<StatsData>(MOCK_DATA);
  const [loading, setLoading] = useState(true);
  const [usingMock, setUsingMock] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/delivery/admin/stats?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('fetch failed');
      const json = await res.json();
      if (!json.today) {
        setData(MOCK_DATA);
        setUsingMock(true);
      } else {
        setData(json as StatsData);
        setUsingMock(false);
      }
    } catch {
      setData(MOCK_DATA);
      setUsingMock(true);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30_000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  const { today, trends } = data;
  const stornoPct = today.orders > 0 ? ((today.cancelled_orders / today.orders) * 100).toFixed(1) : '0';

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-200 bg-white">
        <BarChart2 className="w-4 h-4 text-[#5c7a4e]" />
        <h2 className="text-sm font-semibold text-stone-700">Live-Statistik</h2>
        {usingMock && (
          <span className="ml-2 text-xs text-amber-500">(Demo-Daten)</span>
        )}
        {!loading && (
          <span className="ml-auto text-xs text-stone-400">alle 30s</span>
        )}
      </div>

      {loading ? (
        <div className="p-6 text-center text-sm text-stone-400">Lade Statistiken...</div>
      ) : (
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* 1. Bestellungen heute */}
          <KpiCard
            label="Bestellungen heute"
            value={String(today.orders)}
            className="border-stone-200"
            trend={
              <TrendLabel delta={trends.orders_delta_pct} />
            }
            subtitle="vs. gestern"
          />

          {/* 2. Umsatz heute */}
          <KpiCard
            label="Umsatz heute"
            value={euro(today.revenue_eur)}
            className="border-stone-200"
            trend={<TrendLabel delta={trends.revenue_delta_pct} />}
            subtitle="vs. gestern"
          />

          {/* 3. Ø Lieferzeit */}
          <KpiCard
            label="Ø Lieferzeit"
            value={`${today.avg_delivery_min} Min`}
            className="border-stone-200"
            // inverted: lower is better
            trend={<TrendLabel delta={trends.delivery_time_delta_pct} inverted />}
            subtitle="vs. gestern"
          />

          {/* 4. Pünktlichkeitsrate */}
          <KpiCard
            label="Pünktlichkeitsrate"
            value={`${today.on_time_pct}%`}
            className={getOnTimeBg(today.on_time_pct)}
            valueClass={getOnTimeText(today.on_time_pct)}
          />

          {/* 5. Aktive Fahrer */}
          <KpiCard
            label="Aktive Fahrer"
            value={String(today.active_drivers)}
            className="border-stone-200"
            subtitle={`${today.pending_orders} offene Bestellungen`}
          />

          {/* 6. Stornos */}
          <KpiCard
            label="Stornos"
            value={String(today.cancelled_orders)}
            className={today.cancelled_orders > 0 ? 'border-red-200 bg-red-50' : 'border-stone-200'}
            valueClass={today.cancelled_orders > 0 ? 'text-red-700' : 'text-stone-800'}
            subtitle={`${stornoPct}% aller Bestellungen`}
          />
        </div>
      )}
    </div>
  );
}
