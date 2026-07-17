'use client';

/**
 * SmartDeliveryStatsPanel
 * Erweitertes Statistiken-Dashboard für Lieferdienst.
 * Zeigt KPIs: Lieferquote, Ø ETA, Pünktlichkeit, Fahrer-Score, Zone-Performance.
 */

import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, Target, Clock, Bike, Star, MapPin, BarChart3, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeliveryStats {
  orders_today: number;
  orders_yesterday: number;
  delivered_today: number;
  avg_eta_min: number;
  on_time_rate: number;
  avg_driver_score: number;
  revenue_today: number;
  revenue_yesterday: number;
  top_zone: string;
  top_zone_orders: number;
  cancellation_rate: number;
  active_drivers: number;
  total_drivers: number;
  avg_delivery_time_min: number;
  hourly_trend: number[];
}

const MOCK_STATS: DeliveryStats = {
  orders_today: 87,
  orders_yesterday: 74,
  delivered_today: 79,
  avg_eta_min: 28,
  on_time_rate: 91,
  avg_driver_score: 86,
  revenue_today: 2840.50,
  revenue_yesterday: 2420.00,
  top_zone: 'Innenstadt',
  top_zone_orders: 32,
  cancellation_rate: 3.2,
  active_drivers: 6,
  total_drivers: 9,
  avg_delivery_time_min: 31,
  hourly_trend: [2, 4, 3, 6, 8, 12, 15, 11, 9, 8, 5, 4],
};

function useDeliveryStats(locationId: string | null) {
  const [stats, setStats] = useState<DeliveryStats>(MOCK_STATS);

  const load = useCallback(async () => {
    const locId = locationId ?? 'bb01ae0a-da47-48b1-b986-3a1201aacc4b';
    try {
      const r = await fetch(`/api/delivery/stats?location_id=${locId}&period=today`, { cache: 'no-store' });
      if (r.ok) setStats(await r.json());
    } catch {}
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]);

  return stats;
}

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  trend?: number;
  icon: React.ReactNode;
  color?: 'green' | 'amber' | 'blue' | 'red' | 'purple';
}

function KpiCard({ label, value, sub, trend, icon, color = 'blue' }: KpiCardProps) {
  const colors = {
    green: { bg: 'bg-green-50', border: 'border-green-100', icon: 'text-green-600', text: 'text-green-700' },
    amber: { bg: 'bg-amber-50', border: 'border-amber-100', icon: 'text-amber-600', text: 'text-amber-700' },
    blue:  { bg: 'bg-blue-50',  border: 'border-blue-100',  icon: 'text-blue-600',  text: 'text-blue-700' },
    red:   { bg: 'bg-red-50',   border: 'border-red-100',   icon: 'text-red-600',   text: 'text-red-700' },
    purple:{ bg: 'bg-purple-50',border: 'border-purple-100',icon: 'text-purple-600',text: 'text-purple-700' },
  };
  const c = colors[color];

  return (
    <div className={cn('rounded-xl border p-3 flex flex-col gap-1', c.bg, c.border)}>
      <div className={cn('w-6 h-6 flex items-center justify-center', c.icon)}>{icon}</div>
      <div className="text-xl font-black text-stone-800 tabular-nums leading-tight">{value}</div>
      <div className="text-[10px] text-stone-500 leading-tight">{label}</div>
      {(sub || trend !== undefined) && (
        <div className="flex items-center gap-1 mt-0.5">
          {trend !== undefined && (
            <span className={cn('text-[9px] font-bold flex items-center gap-0.5', trend >= 0 ? 'text-green-600' : 'text-red-600')}>
              {trend >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
              {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
            </span>
          )}
          {sub && <span className="text-[9px] text-stone-400">{sub}</span>}
        </div>
      )}
    </div>
  );
}

function MiniBarChart({ data, label }: { data: number[]; label: string }) {
  const max = Math.max(...data, 1);
  const hours = ['12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23'];

  return (
    <div className="rounded-xl border border-stone-100 bg-stone-50 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-stone-700">{label}</div>
        <BarChart3 className="w-3.5 h-3.5 text-stone-400" />
      </div>
      <div className="flex items-end gap-0.5 h-12">
        {data.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div
              className={cn(
                'w-full rounded-t-sm transition-all',
                v === max ? 'bg-saffron' : v >= max * 0.7 ? 'bg-amber-300' : 'bg-stone-200'
              )}
              style={{ height: `${Math.max(4, (v / max) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-1">
        {hours.filter((_, i) => i % 3 === 0).map(h => (
          <span key={h} className="text-[8px] text-stone-300 tabular-nums">{h}</span>
        ))}
      </div>
    </div>
  );
}

function ScoreBar({ label, value, max = 100, color }: { label: string; value: number; max?: number; color: string }) {
  const pct = (value / max) * 100;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-stone-600">{label}</span>
        <span className="text-[10px] font-bold text-stone-800 tabular-nums">{value}{max === 100 ? '%' : ''}</span>
      </div>
      <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function SmartDeliveryStatsPanel({ locationId }: { locationId?: string | null }) {
  const stats = useDeliveryStats(locationId ?? null);

  const ordersTrend = stats.orders_yesterday > 0
    ? ((stats.orders_today - stats.orders_yesterday) / stats.orders_yesterday) * 100
    : 0;
  const revenueTrend = stats.revenue_yesterday > 0
    ? ((stats.revenue_today - stats.revenue_yesterday) / stats.revenue_yesterday) * 100
    : 0;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-100 bg-gradient-to-r from-purple-50 to-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-bold text-stone-800">Smart Delivery Statistiken</div>
            <div className="text-[10px] text-stone-500">Heute · Live-Daten</div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-black text-stone-800 tabular-nums">
            €{stats.revenue_today.toLocaleString('de-DE', { minimumFractionDigits: 0 })}
          </div>
          <div className={cn('text-[9px] font-semibold flex items-center justify-end gap-0.5', revenueTrend >= 0 ? 'text-green-600' : 'text-red-600')}>
            {revenueTrend >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
            {revenueTrend >= 0 ? '+' : ''}{revenueTrend.toFixed(1)}% vs. gestern
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <KpiCard
            label="Bestellungen heute"
            value={String(stats.orders_today)}
            trend={ordersTrend}
            sub={`${stats.delivered_today} zugestellt`}
            icon={<Target className="w-4 h-4" />}
            color="blue"
          />
          <KpiCard
            label="Pünktlichkeitsrate"
            value={`${stats.on_time_rate}%`}
            icon={<Clock className="w-4 h-4" />}
            color={stats.on_time_rate >= 90 ? 'green' : stats.on_time_rate >= 75 ? 'amber' : 'red'}
            sub={`Ø ${stats.avg_delivery_time_min}m Lieferzeit`}
          />
          <KpiCard
            label="Fahrer-Score Ø"
            value={String(stats.avg_driver_score)}
            icon={<Award className="w-4 h-4" />}
            color={stats.avg_driver_score >= 85 ? 'green' : 'amber'}
            sub={`${stats.active_drivers}/${stats.total_drivers} aktiv`}
          />
          <KpiCard
            label="Top-Zone"
            value={stats.top_zone}
            icon={<MapPin className="w-4 h-4" />}
            color="purple"
            sub={`${stats.top_zone_orders} Bestellungen`}
          />
        </div>

        {/* Hourly Trend */}
        <MiniBarChart data={stats.hourly_trend} label="Bestellungen nach Stunde" />

        {/* Performance Bars */}
        <div className="rounded-xl border border-stone-100 bg-stone-50 p-3 space-y-2.5">
          <div className="text-xs font-bold text-stone-700 mb-2 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-amber-500" />
            Performance-Übersicht
          </div>
          <ScoreBar label="Pünktlichkeitsrate" value={stats.on_time_rate} color="#22c55e" />
          <ScoreBar label="Fahrer-Score Ø" value={stats.avg_driver_score} color="#3b82f6" />
          <ScoreBar label="Fahrer-Auslastung" value={Math.round((stats.active_drivers / stats.total_drivers) * 100)} color="#a855f7" />
          <ScoreBar label="Storno-Quote (invertiert)" value={Math.round(100 - stats.cancellation_rate)} color="#f59e0b" />
        </div>

        {/* Key Metrics Row */}
        <div className="flex items-center justify-between bg-stone-50 rounded-xl border border-stone-100 px-3 py-2">
          <div className="text-center">
            <div className="text-sm font-black text-stone-800 tabular-nums">{stats.avg_eta_min}m</div>
            <div className="text-[9px] text-stone-400">Ø ETA</div>
          </div>
          <div className="w-px h-8 bg-stone-200" />
          <div className="text-center">
            <div className={cn(
              'text-sm font-black tabular-nums',
              stats.cancellation_rate <= 3 ? 'text-green-600' : stats.cancellation_rate <= 6 ? 'text-amber-600' : 'text-red-600'
            )}>{stats.cancellation_rate}%</div>
            <div className="text-[9px] text-stone-400">Stornos</div>
          </div>
          <div className="w-px h-8 bg-stone-200" />
          <div className="text-center">
            <div className="text-sm font-black text-stone-800 tabular-nums">{stats.active_drivers}</div>
            <div className="text-[9px] text-stone-400">Fahrer online</div>
          </div>
          <div className="w-px h-8 bg-stone-200" />
          <div className="text-center">
            <div className="text-sm font-black text-stone-800 tabular-nums">{Math.round(stats.orders_today / Math.max(stats.active_drivers, 1))}</div>
            <div className="text-[9px] text-stone-400">Bestell./Fahrer</div>
          </div>
        </div>
      </div>

      <div className="border-t border-stone-100 px-4 py-2 bg-stone-50 flex items-center justify-between text-[9px] text-stone-400">
        <span>Smart Delivery Statistics · mise</span>
        <span className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Live
        </span>
      </div>
    </div>
  );
}
