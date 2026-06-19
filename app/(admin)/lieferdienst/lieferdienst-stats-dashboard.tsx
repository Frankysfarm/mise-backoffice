'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';
import {
  TrendingUp, TrendingDown, Minus, RefreshCw, MapPin, Bike,
  Clock, Target, Star, AlertTriangle, CheckCircle2, Zap,
  BarChart2, Users, Euro, Wifi, Calendar,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

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

interface ZoneStat {
  zone: string;
  orders: number;
  avgMin: number;
  onTimePct: number;
}

interface DriverStat {
  name: string;
  deliveries: number;
  avgMin: number;
  score: number;
}

interface SlaBucket {
  label: string;
  count: number;
  color: string;
  pct: number;
}

function StatCard({
  label, value, sub, trend, icon: Icon, accent,
}: {
  label: string; value: string; sub?: string; trend?: 'up' | 'down' | 'neutral';
  icon?: React.ElementType; accent?: string;
}) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-500' : trend === 'down' ? 'text-red-500' : 'text-gray-400';
  return (
    <div className={`bg-white rounded-xl p-3.5 border shadow-sm ${accent ? `border-l-4 ${accent}` : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          {Icon && <Icon size={12} className="text-gray-400 shrink-0" />}
          <span className="text-xs text-gray-500">{label}</span>
        </div>
        {trend && <TrendIcon size={13} className={trendColor} />}
      </div>
      <div className="mt-1 text-xl font-bold text-gray-900 tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}

function SlaBar({ bucket }: { bucket: SlaBucket }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 text-[11px] text-gray-500 text-right shrink-0">{bucket.label}</div>
      <div className="flex-1 h-4 bg-gray-100 rounded-full overflow-hidden relative">
        <div
          className={`h-full rounded-full transition-all ${bucket.color}`}
          style={{ width: `${bucket.pct}%` }}
        />
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white mix-blend-multiply" style={{ mixBlendMode: 'normal' }}>
          {bucket.count > 0 ? `${bucket.count}` : ''}
        </span>
      </div>
      <div className="w-10 text-[11px] font-bold text-gray-700 tabular-nums text-right shrink-0">
        {bucket.pct.toFixed(0)}%
      </div>
    </div>
  );
}

const MOCK_STATS: ShiftStats = {
  revenue: 0, orders: 0, avgOrderValue: 0, deliveries: 0,
  avgDeliveryMin: 0, onTimeRatePct: 0, pendingOrders: 0, activeDrivers: 0,
};

const HOUR_COLORS = ['#10b981', '#3b82f6', '#6366f1', '#f59e0b', '#f97316', '#ef4444'];
const ZONE_COLORS = ['#10b981', '#3b82f6', '#6366f1', '#f59e0b', '#f97316'];

function generateMockZones(): ZoneStat[] {
  const zones = ['Nord', 'Süd', 'Ost', 'West', 'Mitte'];
  return zones.map((zone) => ({
    zone,
    orders: Math.floor(Math.random() * 12 + 2),
    avgMin: Math.floor(Math.random() * 15 + 22),
    onTimePct: Math.floor(Math.random() * 25 + 70),
  })).sort((a, b) => b.orders - a.orders);
}

function generateMockDrivers(): DriverStat[] {
  const names = ['Kemal A.', 'Jana M.', 'Marco B.', 'Ayse K.', 'Luis P.'];
  return names.map((name) => ({
    name,
    deliveries: Math.floor(Math.random() * 8 + 3),
    avgMin: Math.floor(Math.random() * 10 + 24),
    score: Math.floor(Math.random() * 20 + 75),
  })).sort((a, b) => b.score - a.score).slice(0, 3);
}

export function LieferdienstStatsDashboard() {
  const [stats, setStats] = useState<ShiftStats>(MOCK_STATS);
  const [hourData, setHourData] = useState<HourBucket[]>([]);
  const [zones, setZones] = useState<ZoneStat[]>([]);
  const [drivers, setDrivers] = useState<DriverStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeTab, setActiveTab] = useState<'uebersicht' | 'zonen' | 'fahrer' | 'sla' | 'trends' | 'prognose'>('uebersicht');
  const [forecastData, setForecastData] = useState<{ hour: string; orders: number; confidence: number; drivers: number }[]>([]);
  const [realtimePulse, setRealtimePulse] = useState(false);
  const [weekTrend, setWeekTrend] = useState<{ day: string; orders: number; revenue: number; onTimePct: number }[]>([]);
  const loadRef = useRef<(() => void) | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [shiftRes, slaRes] = await Promise.all([
        fetch('/api/delivery/shifts?action=current_stats').catch(() => null),
        fetch('/api/delivery/admin/sla?days=1').catch(() => null),
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
        // Mock data
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

      // Load zone & driver stats (or mock)
      const [zoneRes, driverRes] = await Promise.all([
        fetch('/api/delivery/admin/zone-stats?days=1').catch(() => null),
        fetch('/api/delivery/admin/driver-leaderboard?days=1&limit=3').catch(() => null),
      ]);

      if (zoneRes?.ok) {
        const d = await zoneRes.json();
        if (Array.isArray(d?.zones)) setZones(d.zones);
        else setZones(generateMockZones());
      } else {
        setZones(generateMockZones());
      }

      if (driverRes?.ok) {
        const d = await driverRes.json();
        if (Array.isArray(d?.drivers)) {
          setDrivers(d.drivers.slice(0, 3).map((dr: any) => ({
            name: dr.name ?? dr.driverName ?? '–',
            deliveries: dr.deliveries ?? dr.stopsCompleted ?? 0,
            avgMin: dr.avgMin ?? dr.avgDeliveryMin ?? 0,
            score: dr.score ?? dr.performanceScore ?? 80,
          })));
        } else {
          setDrivers(generateMockDrivers());
        }
      } else {
        setDrivers(generateMockDrivers());
      }

      // Wochentrend: letzte 7 Tage (mock wenn API nicht verfügbar)
      const trendRes = await fetch('/api/delivery/admin/reporting?days=7&group=day').catch(() => null);
      if (trendRes?.ok) {
        const td = await trendRes.json();
        if (Array.isArray(td?.data)) {
          setWeekTrend(td.data.map((row: any) => ({
            day: row.day ?? row.date ?? '–',
            orders: row.orders ?? row.total_orders ?? 0,
            revenue: row.revenue ?? row.total_revenue ?? 0,
            onTimePct: row.onTimePct ?? row.on_time_pct ?? 0,
          })));
        }
      } else {
        // Mock: 7 Tage rückwärts
        const days = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
        const now = new Date();
        const dow = now.getDay(); // 0=So
        const trend = Array.from({ length: 7 }, (_, i) => {
          const d = new Date(now.getTime() - (6 - i) * 86_400_000);
          const label = days[d.getDay() === 0 ? 6 : d.getDay() - 1];
          return {
            day: label,
            orders: Math.floor(Math.random() * 40 + 20),
            revenue: Math.random() * 800 + 300,
            onTimePct: Math.floor(Math.random() * 20 + 75),
          };
        });
        setWeekTrend(trend);
      }

      // Nachfrage-Prognose nächste 3 Stunden
      const forecastRes = await fetch('/api/delivery/admin/demand-forecast?hours=3').catch(() => null);
      if (forecastRes?.ok) {
        const fd = await forecastRes.json();
        if (Array.isArray(fd?.forecast)) {
          setForecastData(fd.forecast.map((f: any) => ({
            hour: f.hour ?? f.label ?? '–',
            orders: f.orders ?? f.predicted ?? 0,
            confidence: f.confidence ?? f.conf ?? 0.8,
            drivers: f.drivers ?? f.requiredDrivers ?? 2,
          })));
        }
      } else {
        // Generiere plausible Mock-Prognose basierend auf Stunden-Trend
        const now = new Date();
        setForecastData(Array.from({ length: 3 }, (_, i) => {
          const h = new Date(now.getTime() + (i + 1) * 3600_000);
          const hourOfDay = h.getHours();
          const baseLoad = hourOfDay >= 11 && hourOfDay <= 13 ? 1.5 : hourOfDay >= 18 && hourOfDay <= 20 ? 1.8 : 1.0;
          const orders = Math.round((8 + Math.random() * 8) * baseLoad);
          return {
            hour: `${String(hourOfDay).padStart(2, '0')}:00`,
            orders,
            confidence: 0.65 + Math.random() * 0.25,
            drivers: Math.max(2, Math.ceil(orders / 5)),
          };
        }));
      }

    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, []);

  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);

    // Supabase realtime: Neuberechnung bei neuer abgeschlossener Bestellung
    const supabase = createClient();
    const channel = supabase
      .channel('lieferdienst-stats-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'customer_orders' },
        (payload: { new: Record<string, unknown> }) => {
          const row = payload.new as Record<string, unknown>;
          if (row?.status === 'geliefert' || row?.status === 'abgeschlossen') {
            setRealtimePulse(true);
            setTimeout(() => setRealtimePulse(false), 2000);
            loadRef.current?.();
          }
        },
      )
      .subscribe();

    return () => {
      clearInterval(iv);
      supabase.removeChannel(channel);
    };
  }, [load]);

  // SLA Breakdown
  const totalDeliveries = Math.max(1, stats.deliveries);
  const onTimeCount = Math.round((stats.onTimeRatePct / 100) * totalDeliveries);
  const lateCount = Math.round(((100 - stats.onTimeRatePct) / 100) * totalDeliveries * 0.7);
  const criticalCount = totalDeliveries - onTimeCount - lateCount;
  const slaBuckets: SlaBucket[] = [
    { label: 'Pünktlich', count: onTimeCount, color: 'bg-green-500', pct: stats.onTimeRatePct },
    { label: 'Leicht spät', count: lateCount, color: 'bg-amber-400', pct: lateCount > 0 ? Math.round((lateCount / totalDeliveries) * 100) : 0 },
    { label: 'Kritisch', count: Math.max(0, criticalCount), color: 'bg-red-500', pct: criticalCount > 0 ? Math.round((criticalCount / totalDeliveries) * 100) : 0 },
  ];

  const TABS = [
    { key: 'uebersicht', label: 'Übersicht', icon: BarChart2 },
    { key: 'zonen',      label: 'Zonen',    icon: MapPin },
    { key: 'fahrer',     label: 'Fahrer',   icon: Bike },
    { key: 'sla',        label: 'SLA',      icon: Target },
    { key: 'trends',     label: 'Trend',    icon: TrendingUp },
    { key: 'prognose',   label: 'Prognose', icon: Calendar },
  ] as const;

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
          <BarChart2 size={15} className="text-gray-500" />
          Schicht-Statistiken Dashboard
        </h3>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 transition-all duration-500 ${realtimePulse ? 'bg-matcha-100 text-matcha-700' : 'text-gray-400'}`}>
            <Wifi size={9} className={realtimePulse ? 'text-matcha-600' : 'text-gray-300'} />
            Live
          </span>
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

      {/* Tabs */}
      <div className="flex border-b bg-white">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 text-xs font-semibold transition-colors border-b-2 ${
              activeTab === key
                ? 'border-emerald-500 text-emerald-700 bg-emerald-50'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Icon size={12} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      <div className="p-4">
        {/* Übersicht Tab */}
        {activeTab === 'uebersicht' && (
          <div className="space-y-4">
            {/* KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <StatCard
                label="Umsatz (Schicht)"
                value={`€${stats.revenue.toFixed(0)}`}
                sub={`Ø €${stats.avgOrderValue.toFixed(2)}/Bestellung`}
                trend={stats.revenue > 500 ? 'up' : 'neutral'}
                icon={Euro}
                accent="border-l-emerald-400"
              />
              <StatCard
                label="Bestellungen"
                value={`${stats.orders}`}
                sub={`${stats.pendingOrders} ausstehend`}
                trend={stats.pendingOrders > 5 ? 'down' : 'up'}
                icon={BarChart2}
                accent={stats.pendingOrders > 5 ? 'border-l-red-400' : 'border-l-blue-400'}
              />
              <StatCard
                label="Lieferzeit Ø"
                value={`${stats.avgDeliveryMin.toFixed(0)} min`}
                sub={`${stats.onTimeRatePct.toFixed(0)}% pünktlich`}
                trend={stats.avgDeliveryMin > 35 ? 'down' : stats.avgDeliveryMin < 28 ? 'up' : 'neutral'}
                icon={Clock}
                accent={stats.avgDeliveryMin > 35 ? 'border-l-red-400' : 'border-l-green-400'}
              />
              <StatCard
                label="Aktive Fahrer"
                value={`${stats.activeDrivers}`}
                sub={`${stats.deliveries} Lieferungen`}
                trend={stats.activeDrivers >= 3 ? 'up' : 'down'}
                icon={Bike}
                accent="border-l-purple-400"
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
        )}

        {/* Zonen Tab */}
        {activeTab === 'zonen' && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-500">Zone-Performance heute</p>
            {zones.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">Keine Zonendaten verfügbar</div>
            ) : (
              <div className="space-y-2">
                {zones.map((z, i) => {
                  const color = z.onTimePct >= 90 ? 'text-green-600 bg-green-50 border-green-200'
                    : z.onTimePct >= 75 ? 'text-amber-600 bg-amber-50 border-amber-200'
                    : 'text-red-600 bg-red-50 border-red-200';
                  return (
                    <div key={z.zone} className="flex items-center gap-3 rounded-lg border bg-gray-50 px-3 py-2.5">
                      <div
                        className="h-7 w-7 rounded-lg flex items-center justify-center text-white text-xs font-black shrink-0"
                        style={{ background: ZONE_COLORS[i % ZONE_COLORS.length] }}
                      >
                        {z.zone.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-gray-800">{z.zone}</div>
                        <div className="text-[10px] text-gray-400">{z.orders} Bestellungen · Ø {z.avgMin} min</div>
                      </div>
                      <div className={`text-xs font-bold px-2 py-1 rounded-lg border ${color}`}>
                        {z.onTimePct}% ✓
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Zone-Balken-Chart */}
            {zones.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-gray-500 mb-2">Bestellungen je Zone</p>
                <ResponsiveContainer width="100%" height={90}>
                  <BarChart data={zones} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                    <XAxis dataKey="zone" tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => [`${v} Bestellungen`, '']} />
                    <Bar dataKey="orders" radius={[3, 3, 0, 0]} maxBarSize={36}>
                      {zones.map((_, i) => (
                        <Cell key={i} fill={ZONE_COLORS[i % ZONE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Fahrer Tab */}
        {activeTab === 'fahrer' && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-500">Top-Fahrer heute</p>
            {drivers.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">Keine Fahrerdaten verfügbar</div>
            ) : (
              <div className="space-y-2">
                {drivers.map((dr, i) => {
                  const medals = ['🥇', '🥈', '🥉'];
                  const scoreColor = dr.score >= 90 ? 'text-green-600' : dr.score >= 75 ? 'text-amber-600' : 'text-red-500';
                  return (
                    <div key={dr.name} className="flex items-center gap-3 rounded-xl border bg-white px-3 py-3 shadow-sm">
                      <span className="text-xl shrink-0">{medals[i] ?? `${i + 1}.`}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-gray-800">{dr.name}</div>
                        <div className="text-[10px] text-gray-400">
                          {dr.deliveries} Lieferungen · Ø {dr.avgMin} min
                        </div>
                        {/* Mini-Progress-Bar für Score */}
                        <div className="mt-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${dr.score >= 90 ? 'bg-green-500' : dr.score >= 75 ? 'bg-amber-400' : 'bg-red-400'}`}
                            style={{ width: `${dr.score}%` }}
                          />
                        </div>
                      </div>
                      <div className={`text-base font-black tabular-nums ${scoreColor}`}>
                        {dr.score}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Aktive Fahrer Überblick */}
            <div className="rounded-xl border bg-emerald-50 border-emerald-200 px-4 py-3 flex items-center gap-3">
              <Users size={18} className="text-emerald-600 shrink-0" />
              <div>
                <div className="text-sm font-bold text-emerald-800">
                  {stats.activeDrivers} Fahrer online
                </div>
                <div className="text-xs text-emerald-600">
                  {stats.deliveries} Lieferungen heute insgesamt
                </div>
              </div>
              <div className="ml-auto text-xl font-black text-emerald-700 tabular-nums">
                {stats.activeDrivers > 0 ? Math.round(stats.deliveries / stats.activeDrivers) : 0}
                <span className="text-xs font-medium text-emerald-500 ml-0.5">/Fahrer</span>
              </div>
            </div>
          </div>
        )}

        {/* SLA Tab */}
        {activeTab === 'sla' && (
          <div className="space-y-4">
            <p className="text-xs font-medium text-gray-500">SLA-Auswertung heute</p>

            {/* SLA Score Big Number */}
            <div className="flex items-center justify-center py-2">
              <div className="relative h-24 w-24">
                <svg className="-rotate-90" width="96" height="96" viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="38" fill="none" stroke="#f3f4f6" strokeWidth="8" />
                  <circle
                    cx="48" cy="48" r="38" fill="none"
                    stroke={stats.onTimeRatePct >= 90 ? '#10b981' : stats.onTimeRatePct >= 75 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 38}`}
                    strokeDashoffset={`${2 * Math.PI * 38 * (1 - Math.min(1, stats.onTimeRatePct / 100))}`}
                    style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.5s' }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-xl font-black tabular-nums ${stats.onTimeRatePct >= 90 ? 'text-green-600' : stats.onTimeRatePct >= 75 ? 'text-amber-600' : 'text-red-500'}`}>
                    {stats.onTimeRatePct.toFixed(0)}%
                  </span>
                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wide">SLA</span>
                </div>
              </div>
            </div>

            {/* SLA Breakdown Bars */}
            <div className="space-y-2">
              {slaBuckets.map((b) => (
                <SlaBar key={b.label} bucket={b} />
              ))}
            </div>

            {/* SLA Details */}
            <div className="rounded-xl border bg-gray-50 px-4 py-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Ø Lieferzeit</span>
                <span className={`font-bold ${stats.avgDeliveryMin > 35 ? 'text-red-600' : stats.avgDeliveryMin < 28 ? 'text-green-600' : 'text-amber-600'}`}>
                  {stats.avgDeliveryMin.toFixed(0)} min
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Gesamtlieferungen</span>
                <span className="font-bold text-gray-800">{stats.deliveries}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">SLA-Ziel</span>
                <span className="font-bold text-gray-800">≤ 35 min · ≥ 85%</span>
              </div>
            </div>

            {/* Status Badge */}
            {stats.onTimeRatePct > 0 && (
              <div className={`flex items-center gap-2 rounded-xl px-4 py-2.5 ${
                stats.onTimeRatePct >= 90 ? 'bg-green-50 border border-green-200' :
                stats.onTimeRatePct >= 75 ? 'bg-amber-50 border border-amber-200' :
                'bg-red-50 border border-red-200 animate-pulse'
              }`}>
                {stats.onTimeRatePct >= 90
                  ? <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                  : stats.onTimeRatePct >= 75
                  ? <AlertTriangle size={16} className="text-amber-600 shrink-0" />
                  : <AlertTriangle size={16} className="text-red-600 shrink-0" />
                }
                <span className={`text-sm font-semibold ${
                  stats.onTimeRatePct >= 90 ? 'text-green-800' :
                  stats.onTimeRatePct >= 75 ? 'text-amber-800' : 'text-red-800'
                }`}>
                  {stats.onTimeRatePct >= 90 ? 'SLA erfüllt — sehr gut!'
                    : stats.onTimeRatePct >= 75 ? 'SLA teilweise erfüllt — Verbesserung möglich'
                    : 'SLA-Ziel nicht erreicht — Maßnahmen erforderlich'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Trends Tab — 7-Tage-Vergleich */}
        {activeTab === 'trends' && (
          <div className="space-y-4">
            <p className="text-xs font-medium text-gray-500">Wochentrend — letzte 7 Tage</p>

            {/* Bestellvolumen-Linie */}
            {weekTrend.length > 0 && (
              <>
                <div>
                  <p className="text-[11px] text-gray-400 mb-1.5">Bestellungen pro Tag</p>
                  <ResponsiveContainer width="100%" height={100}>
                    <LineChart data={weekTrend} margin={{ top: 2, right: 4, left: -24, bottom: 0 }}>
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: any) => [`${v}`, 'Bestellungen']} />
                      <Line
                        type="monotone" dataKey="orders"
                        stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Umsatz-Linie */}
                <div>
                  <p className="text-[11px] text-gray-400 mb-1.5">Umsatz pro Tag (€)</p>
                  <ResponsiveContainer width="100%" height={100}>
                    <LineChart data={weekTrend} margin={{ top: 2, right: 4, left: -16, bottom: 0 }}>
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `€${v}`} />
                      <Tooltip formatter={(v: any) => [`€${Number(v).toFixed(0)}`, 'Umsatz']} />
                      <Line
                        type="monotone" dataKey="revenue"
                        stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: '#6366f1' }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Pünktlichkeits-Balken */}
                <div>
                  <p className="text-[11px] text-gray-400 mb-1.5">Pünktlichkeit % pro Tag</p>
                  <ResponsiveContainer width="100%" height={80}>
                    <BarChart data={weekTrend} margin={{ top: 2, right: 4, left: -24, bottom: 0 }}>
                      <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                      <Tooltip formatter={(v: any) => [`${v}%`, 'Pünktlich']} />
                      <Bar dataKey="onTimePct" radius={[3, 3, 0, 0]} maxBarSize={32}>
                        {weekTrend.map((d, i) => (
                          <Cell
                            key={i}
                            fill={d.onTimePct >= 90 ? '#10b981' : d.onTimePct >= 75 ? '#f59e0b' : '#ef4444'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* 7-Tage-Zusammenfassung */}
                {weekTrend.length > 0 && (() => {
                  const total = weekTrend.reduce((s, d) => s + d.orders, 0);
                  const avgRev = weekTrend.reduce((s, d) => s + d.revenue, 0) / weekTrend.length;
                  const avgOnTime = weekTrend.reduce((s, d) => s + d.onTimePct, 0) / weekTrend.length;
                  const best = [...weekTrend].sort((a, b) => b.orders - a.orders)[0];
                  return (
                    <div className="rounded-xl border bg-gray-50 px-4 py-3 space-y-2">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">7-Tage-Ø</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center">
                          <div className="text-base font-black text-gray-800 tabular-nums">{Math.round(total / 7)}</div>
                          <div className="text-[9px] text-gray-400">Bestellungen/Tag</div>
                        </div>
                        <div className="text-center">
                          <div className="text-base font-black text-gray-800 tabular-nums">€{avgRev.toFixed(0)}</div>
                          <div className="text-[9px] text-gray-400">Umsatz/Tag</div>
                        </div>
                        <div className="text-center">
                          <div className={`text-base font-black tabular-nums ${avgOnTime >= 90 ? 'text-green-600' : avgOnTime >= 75 ? 'text-amber-600' : 'text-red-500'}`}>
                            {avgOnTime.toFixed(0)}%
                          </div>
                          <div className="text-[9px] text-gray-400">Ø Pünktlich</div>
                        </div>
                      </div>
                      {best && (
                        <div className="text-[10px] text-gray-500 pt-1 border-t border-gray-200">
                          Stärkster Tag: <span className="font-bold text-gray-700">{best.day}</span> mit {best.orders} Bestellungen
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}

            {weekTrend.length === 0 && (
              <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
                Noch keine Trendendaten verfügbar
              </div>
            )}
          </div>
        )}

        {/* ── Prognose Tab ───────────────────────────────────────────── */}
        {activeTab === 'prognose' && (
          <div className="space-y-4">
            <p className="text-xs font-medium text-gray-500">Nachfrage-Prognose — nächste 3 Stunden</p>

            {forecastData.length > 0 ? (
              <>
                {/* Balken-Chart: Prognose-Bestellungen */}
                <div>
                  <p className="text-[11px] text-gray-400 mb-1.5">Erwartete Bestellungen</p>
                  <ResponsiveContainer width="100%" height={110}>
                    <BarChart data={forecastData} margin={{ top: 2, right: 4, left: -24, bottom: 0 }}>
                      <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                      <Tooltip
                        formatter={(v: any, name: string) => [
                          name === 'orders' ? `${v} Bestellungen` : `${Math.round(Number(v) * 100)}% Konfidenz`,
                          name === 'orders' ? 'Prognose' : 'Konfidenz',
                        ]}
                        labelFormatter={(l) => `${l} Uhr`}
                      />
                      <Bar dataKey="orders" radius={[3, 3, 0, 0]} maxBarSize={36}>
                        {forecastData.map((d, i) => (
                          <Cell
                            key={i}
                            fill={d.confidence >= 0.8 ? '#10b981' : d.confidence >= 0.65 ? '#f59e0b' : '#94a3b8'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Kacheln: pro Stunde */}
                <div className="space-y-2">
                  {forecastData.map((d, i) => {
                    const confPct = Math.round(d.confidence * 100);
                    const confColor = d.confidence >= 0.8 ? 'text-green-600 bg-green-50 border-green-200'
                      : d.confidence >= 0.65 ? 'text-amber-600 bg-amber-50 border-amber-200'
                      : 'text-gray-500 bg-gray-50 border-gray-200';
                    return (
                      <div key={d.hour} className="flex items-center gap-3 rounded-xl border bg-gray-50 px-3 py-2.5">
                        <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                          <Clock size={14} className="text-blue-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-gray-800">{d.hour} Uhr</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${confColor}`}>
                              {confPct}% sicher
                            </span>
                          </div>
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {d.drivers} Fahrer benötigt · Ø {Math.round(d.orders / Math.max(1, d.drivers))} Lieferungen/Fahrer
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-lg font-black text-gray-800 tabular-nums">{d.orders}</div>
                          <div className="text-[9px] text-gray-400">Bestellungen</div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Kapazitätsempfehlung */}
                {(() => {
                  const maxOrders = Math.max(...forecastData.map(d => d.orders));
                  const peakHour  = forecastData.find(d => d.orders === maxOrders);
                  const maxDrivers = Math.max(...forecastData.map(d => d.drivers));
                  return (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 space-y-1">
                      <div className="flex items-center gap-2">
                        <Zap size={14} className="text-blue-600 shrink-0" />
                        <span className="text-xs font-black text-blue-800">Kapazitäts-Empfehlung</span>
                      </div>
                      <p className="text-[11px] text-blue-700">
                        Peak um <strong>{peakHour?.hour} Uhr</strong> mit ca. <strong>{maxOrders} Bestellungen</strong>.
                        Mindestens <strong>{maxDrivers} Fahrer</strong> einplanen.
                      </p>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-gray-400">
                <Calendar size={24} />
                <span className="text-sm">Prognosedaten werden geladen…</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
