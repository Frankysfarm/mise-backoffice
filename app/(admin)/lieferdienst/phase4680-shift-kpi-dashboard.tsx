'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { BarChart, Bar, Cell, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import {
  Award, Bike, Clock, Euro, Package, Star, TrendingUp, TrendingDown,
  Users, Zap,
} from 'lucide-react';

/* ── Types ──────────────────────────────────────────────────────────────────── */

type HourlyRow = { hour: number; label: string; orders: number; revenue: number };

type ShiftStats = {
  totalOrders: number;
  totalRevenue: number; // cents
  avgDeliveryMin: number;
  onTimeRate: number;
  activeDrivers: number;
  topDriver: { name: string; deliveries: number } | null;
  hourly: HourlyRow[];
  cancelledOrders: number;
};

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

function fmtEur(cents: number): string {
  return (cents / 100).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

/* ── Mock data ─────────────────────────────────────────────────────────────── */

function buildMockStats(): ShiftStats {
  const now = new Date();
  const shiftStart = new Date(now);
  shiftStart.setHours(10, 0, 0, 0);
  const currentHour = now.getHours();
  const hourly: HourlyRow[] = [];

  for (let h = 10; h <= Math.min(currentHour, 22); h++) {
    const peak = h >= 12 && h <= 14 || h >= 18 && h <= 20;
    const orders = peak ? 8 + Math.floor(Math.random() * 6) : 2 + Math.floor(Math.random() * 4);
    hourly.push({
      hour: h,
      label: `${h}:00`,
      orders,
      revenue: orders * (1800 + Math.floor(Math.random() * 800)),
    });
  }

  const totalOrders = hourly.reduce((s, r) => s + r.orders, 0);
  const totalRevenue = hourly.reduce((s, r) => s + r.revenue, 0);

  return {
    totalOrders,
    totalRevenue,
    avgDeliveryMin: 24 + Math.floor(Math.random() * 8),
    onTimeRate: 82 + Math.floor(Math.random() * 12),
    activeDrivers: 4 + Math.floor(Math.random() * 3),
    cancelledOrders: Math.floor(totalOrders * 0.04),
    topDriver: { name: 'Klaus S.', deliveries: Math.floor(totalOrders * 0.28) },
    hourly,
  };
}

/* ── Component ─────────────────────────────────────────────────────────────── */

export function LieferdienstPhase4680ShiftKpiDashboard() {
  const supabase = createClient();
  const [stats, setStats] = useState<ShiftStats | null>(null);
  const [useMock, setUseMock] = useState(false);
  const [prevOrders, setPrevOrders] = useState<number | null>(null);

  const fetchStats = async () => {
    try {
      const shiftStartHour = 10;
      const now = new Date();
      const shiftStart = new Date(now);
      shiftStart.setHours(shiftStartHour, 0, 0, 0);
      if (shiftStart > now) shiftStart.setDate(shiftStart.getDate() - 1);

      const { data: orders, error } = await supabase
        .from('customer_orders')
        .select('id, status, gesamtbetrag, erstellt_am, geliefert_am, bestellung_typ')
        .gte('erstellt_am', shiftStart.toISOString())
        .order('erstellt_am', { ascending: true });

      if (error || !orders?.length) { setStats(buildMockStats()); setUseMock(true); return; }

      const delivered = orders.filter((o: any) => o.status === 'geliefert');
      const totalRevenue = orders
        .filter((o: any) => !['storniert'].includes(o.status))
        .reduce((s: number, o: any) => s + (o.gesamtbetrag ?? 0), 0);

      // Avg delivery time (min)
      const deliveryTimes = delivered
        .filter((o: any) => o.erstellt_am && o.geliefert_am)
        .map((o: any) => (new Date(o.geliefert_am).getTime() - new Date(o.erstellt_am).getTime()) / 60_000);
      const avgDeliveryMin = deliveryTimes.length
        ? Math.round(deliveryTimes.reduce((s: number, t: number) => s + t, 0) / deliveryTimes.length)
        : 0;

      // On-time (delivered within 35min)
      const onTimeCount = deliveryTimes.filter((t: number) => t <= 35).length;
      const onTimeRate = deliveryTimes.length
        ? Math.round((onTimeCount / deliveryTimes.length) * 100)
        : 100;

      // Hourly breakdown
      const hourlyMap = new Map<number, HourlyRow>();
      orders.forEach((o: any) => {
        const h = new Date(o.erstellt_am).getHours();
        if (!hourlyMap.has(h)) hourlyMap.set(h, { hour: h, label: `${h}:00`, orders: 0, revenue: 0 });
        const row = hourlyMap.get(h)!;
        row.orders++;
        if (!['storniert'].includes(o.status)) row.revenue += o.gesamtbetrag ?? 0;
      });
      const hourly = Array.from(hourlyMap.values()).sort((a, b) => a.hour - b.hour);

      // Active drivers (delivered today)
      const { data: driverData } = await supabase
        .from('mise_delivery_batches')
        .select('fahrer_id')
        .gte('created_at', shiftStart.toISOString())
        .not('fahrer_id', 'is', null);
      const activeDrivers = new Set((driverData ?? []).map((d: any) => d.fahrer_id)).size;

      const result: ShiftStats = {
        totalOrders: orders.length,
        totalRevenue,
        avgDeliveryMin,
        onTimeRate,
        activeDrivers,
        cancelledOrders: orders.filter((o: any) => o.status === 'storniert').length,
        topDriver: null,
        hourly,
      };

      if (prevOrders !== null && result.totalOrders === prevOrders) {
        // no change, skip update
      } else {
        setPrevOrders(result.totalOrders);
        setStats(result);
      }
      setUseMock(false);
    } catch {
      setStats(buildMockStats());
      setUseMock(true);
    }
  };

  useEffect(() => {
    fetchStats();
    const iv = setInterval(fetchStats, 30_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!stats) return null;

  const stornoRate = stats.totalOrders > 0
    ? Math.round((stats.cancelledOrders / stats.totalOrders) * 100)
    : 0;

  const peakHour = stats.hourly.length
    ? stats.hourly.reduce((best, r) => r.orders > best.orders ? r : best)
    : null;

  const kpis = [
    {
      label: 'Bestellungen',
      value: String(stats.totalOrders),
      icon: Package,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      label: 'Umsatz',
      value: fmtEur(stats.totalRevenue),
      icon: Euro,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50',
    },
    {
      label: 'Ø Lieferzeit',
      value: `${stats.avgDeliveryMin}min`,
      icon: Clock,
      color: stats.avgDeliveryMin <= 30 ? 'text-emerald-600' : stats.avgDeliveryMin <= 40 ? 'text-yellow-600' : 'text-red-600',
      bg: 'bg-slate-50',
    },
    {
      label: 'Pünktlichkeit',
      value: `${stats.onTimeRate}%`,
      icon: stats.onTimeRate >= 85 ? TrendingUp : TrendingDown,
      color: stats.onTimeRate >= 85 ? 'text-emerald-600' : stats.onTimeRate >= 70 ? 'text-yellow-600' : 'text-red-600',
      bg: 'bg-slate-50',
    },
    {
      label: 'Fahrer aktiv',
      value: String(stats.activeDrivers),
      icon: Bike,
      color: 'text-matcha-600',
      bg: 'bg-matcha-50',
    },
    {
      label: 'Storno-Rate',
      value: `${stornoRate}%`,
      icon: Zap,
      color: stornoRate <= 3 ? 'text-emerald-600' : stornoRate <= 7 ? 'text-yellow-600' : 'text-red-600',
      bg: 'bg-slate-50',
    },
  ];

  const maxOrders = Math.max(...stats.hourly.map(h => h.orders), 1);

  return (
    <div className="rounded-2xl border border-matcha-100 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 bg-matcha-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-matcha-300" />
          <span className="text-sm font-bold text-white">Schicht-Statistiken</span>
          {useMock && (
            <span className="rounded bg-white/20 px-1.5 py-0.5 text-[9px] font-medium text-white/80">Demo</span>
          )}
        </div>
        <span className="text-[10px] text-matcha-400">
          {new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
        </span>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-px bg-slate-100 border-b border-slate-100">
        {kpis.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={cn('flex flex-col items-center py-3 gap-0.5', bg)}>
            <Icon className={cn('h-3.5 w-3.5 mb-0.5', color)} />
            <span className={cn('text-sm font-black tabular-nums leading-none', color)}>{value}</span>
            <span className="text-[9px] text-slate-400 uppercase tracking-wide text-center">{label}</span>
          </div>
        ))}
      </div>

      {/* Hourly bar chart */}
      {stats.hourly.length > 0 && (
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Stundenverlauf</span>
            {peakHour && (
              <span className="text-[9px] text-amber-600 font-semibold">
                Peak: {peakHour.label} ({peakHour.orders} Bestellungen)
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={80}>
            <BarChart data={stats.hourly} barSize={12} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 8, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                formatter={(v: number) => [`${v} Bestellungen`, '']}
                contentStyle={{ fontSize: 10, padding: '4px 8px', borderRadius: 8, border: '1px solid #e5e7eb' }}
              />
              <Bar dataKey="orders" radius={[3, 3, 0, 0]}>
                {stats.hourly.map((row, idx) => (
                  <Cell
                    key={idx}
                    fill={row.orders === maxOrders ? '#d97706' : '#6366f1'}
                    opacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top driver + insights */}
      <div className="flex items-center gap-3 border-t border-slate-50 px-4 py-2.5 bg-slate-50">
        {stats.topDriver ? (
          <>
            <Award className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-[11px] font-bold text-slate-700">{stats.topDriver.name}</span>
              <span className="text-[10px] text-slate-500 ml-1">· {stats.topDriver.deliveries} Lieferungen</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-[10px] text-slate-500">{stats.activeDrivers} Fahrer im Einsatz</span>
          </div>
        )}
        <span className="text-[9px] text-slate-400 flex-shrink-0">30-Sek-Polling</span>
      </div>
    </div>
  );
}
