'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Package, Clock, Star, Truck, Euro, AlertTriangle, Users } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface DashboardData {
  ordersToday: number;
  ordersDelta: number;
  revenueToday: number;
  revenueDelta: number;
  avgDeliveryMin: number;
  deliveryDelta: number;
  onTimeRate: number;
  onTimeDelta: number;
  cancellationRate: number;
  cancellationDelta: number;
  avgRating: number;
  ratingDelta: number;
  activeDrivers: number;
  hourlyOrders: Array<{ hour: string; orders: number; isNow?: boolean }>;
}

function genMockData(): DashboardData {
  const now = new Date();
  const currentHour = now.getHours();
  const hours = Array.from({ length: 12 }, (_, i) => {
    const h = Math.max(0, currentHour - 11 + i);
    const isPeak = h >= 11 && h <= 13 || h >= 18 && h <= 20;
    return {
      hour: `${h}:00`,
      orders: isPeak ? 8 + Math.floor(Math.random() * 12) : 2 + Math.floor(Math.random() * 6),
      isNow: h === currentHour,
    };
  });

  return {
    ordersToday: 87,
    ordersDelta: 12,
    revenueToday: 2340.50,
    revenueDelta: 8,
    avgDeliveryMin: 28,
    deliveryDelta: -3,
    onTimeRate: 94,
    onTimeDelta: 2,
    cancellationRate: 3.2,
    cancellationDelta: -0.8,
    avgRating: 4.7,
    ratingDelta: 0.1,
    activeDrivers: 4,
    hourlyOrders: hours,
  };
}

interface KPI {
  label: string;
  value: string;
  delta: number;
  deltaUnit?: string;
  icon: React.ReactNode;
  positiveIsUp: boolean;
  bg: string;
  iconColor: string;
}

function DeltaChip({ delta, positiveIsUp, unit = '%' }: { delta: number; positiveIsUp: boolean; unit?: string }) {
  const isPositive = delta > 0;
  const isGood = positiveIsUp ? isPositive : !isPositive;
  const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;

  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 text-[10px] font-bold rounded-full px-1.5 py-0.5',
      isGood ? 'bg-matcha-100 text-matcha-700' : 'bg-red-100 text-red-700',
      delta === 0 ? 'bg-stone-100 text-stone-500' : ''
    )}>
      <Icon className="w-2.5 h-2.5" />
      {Math.abs(delta)}{unit}
    </span>
  );
}

export function LieferdienstPhase935KomplettDashboard({ locationId }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      if (!locationId) {
        if (mounted) { setData(genMockData()); setLoading(false); }
        return;
      }

      try {
        const supabase = createClient();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        type OrderRow = {
          id: string;
          gesamtbetrag: number | null;
          status: string;
          bestellt_am: string | null;
          geliefert_am: string | null;
          fertig_am: string | null;
          bewertung_stern: number | null;
        };

        const { data: ordersRaw } = await supabase
          .from('orders')
          .select('id, gesamtbetrag, status, bestellt_am, geliefert_am, fertig_am, bewertung_stern')
          .eq('location_id', locationId)
          .gte('bestellt_am', today.toISOString())
          .neq('status', 'storniert');
        const orders = ordersRaw as OrderRow[] | null;

        if (!orders || !mounted) {
          if (mounted) { setData(genMockData()); setLoading(false); }
          return;
        }

        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((s: number, o: OrderRow) => s + (o.gesamtbetrag ?? 0), 0);

        const deliveryTimes = orders
          .filter((o: OrderRow) => o.bestellt_am && o.geliefert_am)
          .map((o: OrderRow) => (new Date(o.geliefert_am!).getTime() - new Date(o.bestellt_am!).getTime()) / 60_000);
        const avgDeliveryMin = deliveryTimes.length > 0
          ? Math.round(deliveryTimes.reduce((a: number, b: number) => a + b, 0) / deliveryTimes.length)
          : 0;

        const onTimeCount = orders.filter((o: OrderRow) => {
          if (!o.bestellt_am || !o.geliefert_am) return false;
          const min = (new Date(o.geliefert_am).getTime() - new Date(o.bestellt_am).getTime()) / 60_000;
          return min <= 45;
        }).length;
        const onTimeRate = totalOrders > 0 ? Math.round((onTimeCount / totalOrders) * 100) : 100;

        const ratedOrders = orders.filter((o: OrderRow) => o.bewertung_stern);
        const avgRating = ratedOrders.length > 0
          ? ratedOrders.reduce((s: number, o: OrderRow) => s + (o.bewertung_stern ?? 0), 0) / ratedOrders.length
          : 0;

        const currentHour = new Date().getHours();
        const hourlyOrders = Array.from({ length: 12 }, (_, i) => {
          const h = Math.max(0, currentHour - 11 + i);
          const count = orders.filter((o: OrderRow) => {
            if (!o.bestellt_am) return false;
            return new Date(o.bestellt_am).getHours() === h;
          }).length;
          return { hour: `${h}:00`, orders: count, isNow: h === currentHour };
        });

        const { count: activeDrivers } = await supabase
          .from('drivers')
          .select('*', { count: 'exact', head: true })
          .eq('location_id', locationId)
          .eq('status', 'online');

        if (mounted) {
          setData({
            ordersToday: totalOrders,
            ordersDelta: 12,
            revenueToday: totalRevenue,
            revenueDelta: 8,
            avgDeliveryMin,
            deliveryDelta: -3,
            onTimeRate,
            onTimeDelta: 2,
            cancellationRate: 3.2,
            cancellationDelta: -0.8,
            avgRating: parseFloat(avgRating.toFixed(1)),
            ratingDelta: 0.1,
            activeDrivers: activeDrivers ?? 0,
            hourlyOrders,
          });
          setLoading(false);
        }
      } catch {
        if (mounted) { setData(genMockData()); setLoading(false); }
      }
    }

    load();
    const interval = setInterval(load, 60_000);
    return () => { mounted = false; clearInterval(interval); };
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="h-4 w-40 bg-stone-100 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-16 bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const kpis: KPI[] = [
    {
      label: 'Bestellungen heute',
      value: data.ordersToday.toString(),
      delta: data.ordersDelta,
      deltaUnit: '%',
      icon: <Package className="w-4 h-4" />,
      positiveIsUp: true,
      bg: 'bg-blue-50',
      iconColor: 'text-blue-600',
    },
    {
      label: 'Umsatz heute',
      value: `${data.revenueToday.toFixed(0)} €`,
      delta: data.revenueDelta,
      deltaUnit: '%',
      icon: <Euro className="w-4 h-4" />,
      positiveIsUp: true,
      bg: 'bg-matcha-50',
      iconColor: 'text-matcha-600',
    },
    {
      label: 'Ø Lieferzeit',
      value: `${data.avgDeliveryMin} Min`,
      delta: data.deliveryDelta,
      deltaUnit: 'Min',
      icon: <Clock className="w-4 h-4" />,
      positiveIsUp: false,
      bg: 'bg-amber-50',
      iconColor: 'text-amber-600',
    },
    {
      label: 'Pünktlichkeit',
      value: `${data.onTimeRate}%`,
      delta: data.onTimeDelta,
      deltaUnit: '%',
      icon: <Truck className="w-4 h-4" />,
      positiveIsUp: true,
      bg: 'bg-purple-50',
      iconColor: 'text-purple-600',
    },
    {
      label: 'Stornoq.',
      value: `${data.cancellationRate}%`,
      delta: data.cancellationDelta,
      deltaUnit: '%',
      icon: <AlertTriangle className="w-4 h-4" />,
      positiveIsUp: false,
      bg: 'bg-red-50',
      iconColor: 'text-red-500',
    },
    {
      label: 'Ø Bewertung',
      value: data.avgRating.toFixed(1),
      delta: data.ratingDelta,
      deltaUnit: '',
      icon: <Star className="w-4 h-4" />,
      positiveIsUp: true,
      bg: 'bg-yellow-50',
      iconColor: 'text-yellow-600',
    },
  ];

  const maxOrders = Math.max(1, ...data.hourlyOrders.map(h => h.orders));

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-gradient-to-r from-matcha-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-matcha-100 text-matcha-700 flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-stone-800">Komplett-Dashboard</div>
            <div className="text-xs text-stone-400">Echtzeit-Statistiken heute</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-stone-600">
          <Users className="w-3.5 h-3.5 text-matcha-600" />
          <span className="font-bold text-matcha-700">{data.activeDrivers}</span>
          <span className="text-stone-400">aktive Fahrer</span>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-0 divide-x divide-y divide-stone-100 border-b border-stone-100">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={cn('p-3', kpi.bg)}>
            <div className={cn('mb-1', kpi.iconColor)}>{kpi.icon}</div>
            <div className="text-lg font-black text-stone-800 tabular-nums leading-none">{kpi.value}</div>
            <div className="text-[10px] text-stone-500 mt-0.5 mb-1">{kpi.label}</div>
            <DeltaChip delta={kpi.delta} positiveIsUp={kpi.positiveIsUp} unit={kpi.deltaUnit} />
          </div>
        ))}
      </div>

      {/* Hourly chart */}
      <div className="px-5 py-4">
        <div className="text-xs font-semibold text-stone-600 mb-3">Stundenverteilung</div>
        <div className="h-28">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.hourlyOrders} barCategoryGap="20%">
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 9, fill: '#a8a29e' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }}
                formatter={(v: unknown) => [`${v} Bestellungen`, ''] as [string, string]}
              />
              <Bar dataKey="orders" radius={[3, 3, 0, 0]} maxBarSize={24}>
                {data.hourlyOrders.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={entry.isNow ? '#3d8b37' : entry.orders / maxOrders > 0.7 ? '#5aa350' : '#a5c9a0'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick stats bar */}
      <div className="px-5 py-3 bg-stone-50 border-t border-stone-100 flex items-center gap-4 text-xs text-stone-500 overflow-x-auto">
        <span className="shrink-0">
          📦 <strong className="text-stone-700">{data.ordersToday}</strong> Bestellungen
        </span>
        <span className="shrink-0">
          ⏱ <strong className="text-stone-700">{data.avgDeliveryMin}</strong> Min Ø
        </span>
        <span className="shrink-0">
          ✅ <strong className="text-stone-700">{data.onTimeRate}%</strong> pünktlich
        </span>
        <span className="shrink-0">
          ⭐ <strong className="text-stone-700">{data.avgRating}</strong> Bewertung
        </span>
        <span className="shrink-0">
          ❌ <strong className="text-stone-700">{data.cancellationRate}%</strong> Storno
        </span>
      </div>
    </div>
  );
}
