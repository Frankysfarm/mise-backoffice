'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Bike,
  Clock,
  Euro,
  Package,
  RefreshCw,
  Star,
  Target,
  Truck,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagesKpiData {
  orders?: number;
  revenue?: number;
  avgDeliveryMin?: number;
  onTimeRatePct?: number;
  activeDrivers?: number;
  cancelRatePct?: number;
  totalDeliveries?: number;
  avgRating?: number;
}

function euro(n: number) {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(n);
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border bg-white p-3 space-y-2 animate-pulse">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-stone-100 shrink-0" />
        <div className="h-3 w-20 rounded bg-stone-100" />
      </div>
      <div className="h-7 w-16 rounded bg-stone-100" />
    </div>
  );
}

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  iconBg: string;
  iconColor: string;
  valueColor: string;
}

function KpiCard({ icon: Icon, label, value, iconBg, iconColor, valueColor }: KpiCardProps) {
  return (
    <div className="rounded-xl border bg-white p-3 space-y-2">
      <div className="flex items-center gap-2">
        <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center shrink-0', iconBg)}>
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
        <span className="text-[10px] font-black uppercase tracking-wider text-stone-400 truncate">
          {label}
        </span>
      </div>
      <div className={cn('text-2xl font-black tabular-nums leading-none', valueColor)}>
        {value}
      </div>
    </div>
  );
}

export function LieferdienstTagesKpiExecutive({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<TagesKpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const cancelledRef = useRef(false);

  const load = async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/stats?location_id=${locationId}&period=today`,
        { cache: 'no-store' },
      );
      if (res.ok && !cancelledRef.current) {
        const json: TagesKpiData = await res.json();
        setData(json);
        setLastUpdated(new Date());
      }
    } catch {
      // silently ignore
    } finally {
      if (!cancelledRef.current) {
        setLoading(false);
        if (manual) setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    if (!locationId) return;
    cancelledRef.current = false;
    setLoading(true);
    load();
    const iv = setInterval(() => load(), 3 * 60_000);
    return () => {
      cancelledRef.current = true;
      clearInterval(iv);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  if (loading && !data) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-lg bg-stone-100 animate-pulse" />
            <div className="h-4 w-36 rounded bg-stone-100 animate-pulse" />
          </div>
          <div className="h-3 w-24 rounded bg-stone-100 animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  const d = data ?? {};

  const ordersValue = d.orders != null ? String(d.orders) : '—';
  const revenueValue = d.revenue != null ? euro(d.revenue) : '—';

  const avgDelMin = d.avgDeliveryMin != null ? Math.round(d.avgDeliveryMin) : null;
  const avgDelValue = avgDelMin != null ? `${avgDelMin} min` : '—';
  const avgDelColor =
    avgDelMin == null ? 'text-stone-700'
    : avgDelMin < 30 ? 'text-amber-600'
    : avgDelMin < 45 ? 'text-amber-500'
    : 'text-red-600';

  const onTime = d.onTimeRatePct != null ? Math.round(d.onTimeRatePct) : null;
  const onTimeValue = onTime != null ? `${onTime}%` : '—';
  const onTimeColor =
    onTime == null ? 'text-stone-700'
    : onTime >= 90 ? 'text-matcha-700'
    : onTime >= 70 ? 'text-amber-600'
    : 'text-red-600';

  const driversValue = d.activeDrivers != null ? String(d.activeDrivers) : '—';

  const cancelRate = d.cancelRatePct != null ? d.cancelRatePct : null;
  const cancelValue = cancelRate != null ? `${cancelRate.toFixed(1)}%` : '—';
  const cancelColor = cancelRate != null && cancelRate > 5 ? 'text-red-600' : 'text-stone-700';
  const cancelIconBg = cancelRate != null && cancelRate > 5 ? 'bg-red-50' : 'bg-stone-50';
  const cancelIconColor = cancelRate != null && cancelRate > 5 ? 'text-red-500' : 'text-stone-400';

  const deliveriesValue = d.totalDeliveries != null ? String(d.totalDeliveries) : '—';

  const rating = d.avgRating != null ? d.avgRating.toFixed(1) : null;
  const ratingValue = rating != null ? `★ ${rating}` : '—';
  const ratingColor =
    rating == null ? 'text-stone-700'
    : parseFloat(rating) >= 4.5 ? 'text-yellow-600'
    : parseFloat(rating) >= 4.0 ? 'text-amber-500'
    : 'text-red-600';

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-lg bg-matcha-100 flex items-center justify-center shrink-0">
            <Activity className="h-3.5 w-3.5 text-matcha-600" />
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-stone-600">
            Heute im Überblick
          </span>
        </div>

        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[9px] text-stone-400 tabular-nums hidden sm:inline">
              Stand {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className={cn(
              'rounded-lg p-1 text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors',
              refreshing && 'text-matcha-500',
            )}
            aria-label="Aktualisieren"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* KPI grid — 2 cols mobile, 4 cols sm+ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {/* 1. Bestellungen */}
        <KpiCard
          icon={Package}
          label="Bestellungen"
          value={ordersValue}
          iconBg="bg-blue-50"
          iconColor="text-blue-500"
          valueColor="text-blue-700"
        />

        {/* 2. Umsatz */}
        <KpiCard
          icon={Euro}
          label="Umsatz"
          value={revenueValue}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-500"
          valueColor="text-emerald-700"
        />

        {/* 3. Ø Lieferzeit */}
        <KpiCard
          icon={Clock}
          label="Ø Lieferzeit"
          value={avgDelValue}
          iconBg="bg-amber-50"
          iconColor="text-amber-500"
          valueColor={avgDelColor}
        />

        {/* 4. Pünktlichkeit */}
        <KpiCard
          icon={Target}
          label="Pünktlichkeit %"
          value={onTimeValue}
          iconBg="bg-matcha-50"
          iconColor="text-matcha-500"
          valueColor={onTimeColor}
        />

        {/* 5. Aktive Fahrer */}
        <KpiCard
          icon={Bike}
          label="Aktive Fahrer"
          value={driversValue}
          iconBg="bg-purple-50"
          iconColor="text-purple-500"
          valueColor="text-purple-700"
        />

        {/* 6. Stornoquote */}
        <KpiCard
          icon={XCircle}
          label="Stornoquote %"
          value={cancelValue}
          iconBg={cancelIconBg}
          iconColor={cancelIconColor}
          valueColor={cancelColor}
        />

        {/* 7. Lieferungen */}
        <KpiCard
          icon={Truck}
          label="Lieferungen"
          value={deliveriesValue}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-500"
          valueColor="text-indigo-700"
        />

        {/* 8. Ø Bewertung */}
        <KpiCard
          icon={Star}
          label="Ø Bewertung"
          value={ratingValue}
          iconBg="bg-yellow-50"
          iconColor="text-yellow-500"
          valueColor={ratingColor}
        />
      </div>
    </div>
  );
}
