'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Euro, Package, Clock, Users, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TagsBilanzData {
  revenueToday: number;
  ordersCompleted: number;
  avgDeliveryMin: number | null;
  onTimePct: number | null;
  driversOnline: number;
  pendingOrders: number;
  revenueYesterday: number | null;
  ordersYesterday: number | null;
}

function trend(today: number, yesterday: number | null): 'up' | 'down' | 'neutral' {
  if (yesterday == null || yesterday === 0) return 'neutral';
  const diff = (today - yesterday) / yesterday;
  if (diff > 0.05) return 'up';
  if (diff < -0.05) return 'down';
  return 'neutral';
}

function fmtEur(v: number): string {
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

function pct(v: number | null): string {
  if (v == null) return '–';
  return `${Math.round(v)}%`;
}

function TrendIcon({ t }: { t: 'up' | 'down' | 'neutral' }) {
  if (t === 'up') return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  if (t === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-stone-400" />;
}

export function LieferdienstTagsBilanz({ locationId }: { locationId: string }) {
  const [data, setData] = useState<TagsBilanzData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  const load = async () => {
    if (!locationId) return;
    try {
      const [slaRes, overviewRes, etaRes] = await Promise.all([
        fetch(`/api/delivery/admin/sla?location_id=${encodeURIComponent(locationId)}&days=1`).then(r => r.ok ? r.json() : null),
        fetch(`/api/delivery/admin/overview?location_id=${encodeURIComponent(locationId)}`).then(r => r.ok ? r.json() : null),
        fetch(`/api/delivery/eta/live?location_id=${encodeURIComponent(locationId)}`).then(r => r.ok ? r.json() : null),
      ]);

      const revenueToday = overviewRes?.today_stats?.revenue ?? slaRes?.summary?.totalRevenue ?? 0;
      const ordersCompleted = overviewRes?.today_stats?.delivered ?? slaRes?.summary?.totalStops ?? 0;
      const avgDeliveryMin = slaRes?.summary?.avgDeliveryMin ?? null;
      const onTimePct = slaRes?.summary?.onTimePct ?? null;
      const driversOnline = etaRes?.drivers_online ?? overviewRes?.today_stats?.drivers_online ?? 0;
      const pendingOrders = overviewRes?.today_stats?.pending ?? etaRes?.active_orders ?? 0;

      // Yesterday comparison from weekly analytics if available
      let revenueYesterday: number | null = null;
      let ordersYesterday: number | null = null;
      try {
        const weekRes = await fetch(`/api/delivery/admin/analytics?location_id=${encodeURIComponent(locationId)}&type=week`).then(r => r.ok ? r.json() : null);
        if (Array.isArray(weekRes?.daily)) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          const yKey = yesterday.toISOString().slice(0, 10);
          const yDay = weekRes.daily.find((d: { date: string }) => d.date === yKey);
          if (yDay) {
            revenueYesterday = yDay.revenue ?? null;
            ordersYesterday = yDay.orders ?? null;
          }
        }
      } catch {}

      setData({ revenueToday, ordersCompleted, avgDeliveryMin, onTimePct, driversOnline, pendingOrders, revenueYesterday, ordersYesterday });
      setLastRefresh(Date.now());
    } catch {}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="h-4 w-36 bg-stone-100 rounded animate-pulse mb-3" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const revTrend = trend(data.revenueToday, data.revenueYesterday);
  const ordTrend = trend(data.ordersCompleted, data.ordersYesterday);

  const kpis = [
    {
      label: 'Umsatz heute',
      value: fmtEur(data.revenueToday),
      sub: data.revenueYesterday != null ? `Gestern: ${fmtEur(data.revenueYesterday)}` : undefined,
      icon: Euro,
      accent: 'border-l-emerald-500',
      trendDir: revTrend,
    },
    {
      label: 'Bestellungen',
      value: data.ordersCompleted.toString(),
      sub: data.ordersYesterday != null ? `Gestern: ${data.ordersYesterday}` : undefined,
      icon: Package,
      accent: 'border-l-blue-500',
      trendDir: ordTrend,
    },
    {
      label: 'Ø Lieferzeit',
      value: data.avgDeliveryMin != null ? `${Math.round(data.avgDeliveryMin)} Min` : '–',
      sub: data.onTimePct != null ? `${pct(data.onTimePct)} pünktlich` : undefined,
      icon: Clock,
      accent: data.onTimePct != null && data.onTimePct < 80 ? 'border-l-amber-500' : 'border-l-matcha-500',
      trendDir: 'neutral' as const,
    },
    {
      label: 'Fahrer online',
      value: data.driversOnline.toString(),
      sub: data.pendingOrders > 0 ? `${data.pendingOrders} offen` : 'Alle frei',
      icon: Users,
      accent: data.driversOnline === 0 ? 'border-l-red-500' : 'border-l-stone-400',
      trendDir: 'neutral' as const,
    },
  ];

  const refreshAgo = Math.floor((Date.now() - lastRefresh) / 60_000);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-3 border-b border-stone-100">
        <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">
          Tages-Bilanz
        </span>
        <span className="ml-auto flex items-center gap-1 text-[9px] text-stone-400">
          <RefreshCw className="h-2.5 w-2.5" />
          {refreshAgo === 0 ? 'Gerade aktualisiert' : `vor ${refreshAgo} Min`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className={cn('rounded-xl border-l-4 bg-stone-50 p-3.5', kpi.accent)}>
              <div className="flex items-center justify-between mb-1.5">
                <Icon className="h-3.5 w-3.5 text-stone-400" />
                <TrendIcon t={kpi.trendDir} />
              </div>
              <div className="text-lg font-black tabular-nums text-stone-800 leading-none">
                {kpi.value}
              </div>
              <div className="text-[10px] font-semibold text-stone-500 mt-1">{kpi.label}</div>
              {kpi.sub && (
                <div className="text-[9px] text-stone-400 mt-0.5">{kpi.sub}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
