'use client';

import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';

interface ShiftStats {
  revenue: number;
  orders: number;
  avgOrderValue: number;
  deliveries: number;
  avgDeliveryMin: number;
  onTimeRatePct: number;
  pendingOrders: number;
  activeDrivers: number;
}

interface HourBucket {
  hour: string;
  orders: number;
  revenue: number;
}

function StatCard({
  label, value, sub, trend,
}: {
  label: string; value: string; sub?: string; trend?: 'up' | 'down' | 'neutral';
}) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-400';
  return (
    <div className="bg-white rounded-xl p-3.5 border shadow-sm">
      <div className="flex items-start justify-between">
        <span className="text-xs text-gray-500">{label}</span>
        {trend && <TrendIcon size={13} className={trendColor} />}
      </div>
      <div className="mt-1 text-xl font-bold text-gray-900 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

const MOCK_STATS: ShiftStats = {
  revenue: 0, orders: 0, avgOrderValue: 0, deliveries: 0,
  avgDeliveryMin: 0, onTimeRatePct: 0, pendingOrders: 0, activeDrivers: 0,
};

const HOUR_COLORS = ['#10b981', '#3b82f6', '#6366f1', '#f59e0b', '#f97316', '#ef4444'];

export function LieferdienstStatsDashboard() {
  const [stats, setStats] = useState<ShiftStats>(MOCK_STATS);
  const [hourData, setHourData] = useState<HourBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [shiftRes] = await Promise.all([
        fetch('/api/delivery/shifts?action=current_stats').catch(() => null),
      ]);

      if (shiftRes?.ok) {
        const d = await shiftRes.json();
        setStats({
          revenue: d.revenue ?? 0,
          orders: d.orders ?? 0,
          avgOrderValue: d.avgOrderValue ?? 0,
          deliveries: d.deliveries ?? 0,
          avgDeliveryMin: d.avgDeliveryMin ?? 0,
          onTimeRatePct: d.onTimeRatePct ?? 0,
          pendingOrders: d.pendingOrders ?? 0,
          activeDrivers: d.activeDrivers ?? 0,
        });
        if (d.hourBuckets) setHourData(d.hourBuckets);
      } else {
        // Mock data for demo
        const now = new Date();
        const buckets: HourBucket[] = Array.from({ length: 6 }, (_, i) => {
          const h = new Date(now.getTime() - (5 - i) * 3600_000);
          return {
            hour: `${String(h.getHours()).padStart(2, '0')}:00`,
            orders: Math.floor(Math.random() * 15 + 3),
            revenue: Math.random() * 300 + 50,
          };
        });
        setHourData(buckets);
        setStats({
          revenue: buckets.reduce((s, b) => s + b.revenue, 0),
          orders: buckets.reduce((s, b) => s + b.orders, 0),
          avgOrderValue: 22.5 + Math.random() * 5,
          deliveries: buckets.reduce((s, b) => s + b.orders, 0) - 2,
          avgDeliveryMin: 28 + Math.random() * 8,
          onTimeRatePct: 85 + Math.random() * 12,
          pendingOrders: Math.floor(Math.random() * 5),
          activeDrivers: Math.floor(Math.random() * 4 + 2),
        });
      }
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, []);

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, [load]);

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-800">Schicht-Statistiken Dashboard</h3>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[10px] text-gray-400">
              {lastUpdated.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="p-1 rounded-lg hover:bg-gray-100 text-gray-500 disabled:opacity-40 transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatCard
            label="Umsatz (Schicht)"
            value={`€${stats.revenue.toFixed(0)}`}
            sub={`Ø €${stats.avgOrderValue.toFixed(2)}/Bestellung`}
            trend={stats.revenue > 500 ? 'up' : 'neutral'}
          />
          <StatCard
            label="Bestellungen"
            value={`${stats.orders}`}
            sub={`${stats.pendingOrders} ausstehend`}
            trend={stats.pendingOrders > 5 ? 'down' : 'up'}
          />
          <StatCard
            label="Lieferzeit Ø"
            value={`${stats.avgDeliveryMin.toFixed(0)} min`}
            sub={`${stats.onTimeRatePct.toFixed(0)}% pünktlich`}
            trend={stats.avgDeliveryMin > 35 ? 'down' : stats.avgDeliveryMin < 28 ? 'up' : 'neutral'}
          />
          <StatCard
            label="Aktive Fahrer"
            value={`${stats.activeDrivers}`}
            sub={`${stats.deliveries} Lieferungen`}
            trend={stats.activeDrivers >= 3 ? 'up' : 'down'}
          />
        </div>

        {/* Stündliches Bestellvolumen */}
        {hourData.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-2">Bestellvolumen (letzte Stunden)</p>
            <ResponsiveContainer width="100%" height={110}>
              <BarChart data={hourData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(v: any, name: any) => [name === 'orders' ? `${v} Bestellungen` : `€${Number(v).toFixed(0)}`, '']}
                  labelFormatter={(l) => `${l} Uhr`}
                />
                <Bar dataKey="orders" radius={[3, 3, 0, 0]} maxBarSize={32}>
                  {hourData.map((_, i) => (
                    <Cell key={i} fill={HOUR_COLORS[i % HOUR_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Pünktlichkeits-Gauge */}
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Pünktlichkeit</span>
              <span className={`font-semibold ${stats.onTimeRatePct >= 90 ? 'text-green-600' : stats.onTimeRatePct >= 75 ? 'text-amber-600' : 'text-red-500'}`}>
                {stats.onTimeRatePct.toFixed(0)}%
              </span>
            </div>
            <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${stats.onTimeRatePct >= 90 ? 'bg-green-500' : stats.onTimeRatePct >= 75 ? 'bg-amber-400' : 'bg-red-500'}`}
                style={{ width: `${Math.min(100, stats.onTimeRatePct)}%` }}
              />
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-500">Lieferzeit Ø</div>
            <div className={`text-sm font-bold ${stats.avgDeliveryMin > 35 ? 'text-red-500' : stats.avgDeliveryMin < 28 ? 'text-green-600' : 'text-amber-600'}`}>
              {stats.avgDeliveryMin.toFixed(0)} min
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
