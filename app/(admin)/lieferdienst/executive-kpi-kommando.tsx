'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import { Activity, Award, Bike, Clock, Euro, Package, Target, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/client';

type KpiData = {
  orders_today: number;
  orders_active: number;
  revenue_today: number;
  avg_delivery_min: number | null;
  sla_rate_pct: number | null;
  drivers_online: number;
  cancellation_rate_pct: number | null;
  orders_last_hour: number;
  orders_prev_hour: number;
};

type KpiMeta = {
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
  color: string;
  bg: string;
};

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'neutral' | undefined }) {
  if (trend === 'up') return <TrendingUp className="w-3 h-3 text-matcha-600" />;
  if (trend === 'down') return <TrendingDown className="w-3 h-3 text-red-500" />;
  return null;
}

export function LieferdienstExecutiveKpiKommando({ locationId }: { locationId: string | null }) {
  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    const sb = createClient();

    async function load() {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const nowTs = new Date();
      const lastHourStart = new Date(nowTs.getTime() - 60 * 60_000);
      const prevHourStart = new Date(nowTs.getTime() - 120 * 60_000);

      const [ordersRes, activeRes, revenueRes, deliveredRes, cancelledRes, driversRes] = await Promise.all([
        sb.from('customer_orders').select('id', { count: 'exact', head: true })
          .eq('location_id', locationId).gte('bestellt_am', todayStart.toISOString()).neq('status', 'storniert'),
        sb.from('customer_orders').select('id', { count: 'exact', head: true })
          .eq('location_id', locationId).in('status', ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs']),
        sb.from('customer_orders').select('gesamtbetrag')
          .eq('location_id', locationId).gte('bestellt_am', todayStart.toISOString())
          .in('status', ['geliefert', 'abgeholt', 'abgeschlossen']),
        sb.from('customer_orders').select('bestellt_am, geliefert_am')
          .eq('location_id', locationId).gte('bestellt_am', todayStart.toISOString())
          .eq('status', 'geliefert').not('geliefert_am', 'is', null).not('bestellt_am', 'is', null),
        sb.from('customer_orders').select('id', { count: 'exact', head: true })
          .eq('location_id', locationId).eq('status', 'storniert').gte('bestellt_am', todayStart.toISOString()),
        sb.from('driver_status').select('ist_online').eq('ist_online', true),
      ]);

      // last hour vs prev hour
      const [lastHourRes, prevHourRes] = await Promise.all([
        sb.from('customer_orders').select('id', { count: 'exact', head: true })
          .eq('location_id', locationId).gte('bestellt_am', lastHourStart.toISOString()).neq('status', 'storniert'),
        sb.from('customer_orders').select('id', { count: 'exact', head: true })
          .eq('location_id', locationId).gte('bestellt_am', prevHourStart.toISOString())
          .lt('bestellt_am', lastHourStart.toISOString()).neq('status', 'storniert'),
      ]);

      const totalOrders = ordersRes.count ?? 0;
      const revenue = (revenueRes.data ?? []).reduce((s: number, o: any) => s + Number(o.gesamtbetrag ?? 0), 0);

      // avg delivery time
      const deliveries = (deliveredRes.data ?? []) as { bestellt_am: string; geliefert_am: string }[];
      const deliveryMins = deliveries.map(d => (new Date(d.geliefert_am).getTime() - new Date(d.bestellt_am).getTime()) / 60_000);
      const avgDelivery = deliveryMins.length > 0 ? deliveryMins.reduce((a, b) => a + b, 0) / deliveryMins.length : null;

      const slaRate = deliveryMins.length > 0
        ? (deliveryMins.filter(m => m <= 45).length / deliveryMins.length) * 100
        : null;

      const cancelCount = cancelledRes.count ?? 0;
      const cancellationRate = totalOrders > 0 ? (cancelCount / (totalOrders + cancelCount)) * 100 : 0;

      setKpi({
        orders_today: totalOrders,
        orders_active: activeRes.count ?? 0,
        revenue_today: revenue,
        avg_delivery_min: avgDelivery,
        sla_rate_pct: slaRate,
        drivers_online: (driversRes.data ?? []).length,
        cancellation_rate_pct: cancellationRate,
        orders_last_hour: lastHourRes.count ?? 0,
        orders_prev_hour: prevHourRes.count ?? 0,
      });
      setUpdatedAt(new Date());
      setLoading(false);
    }

    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!locationId || loading) return null;
  if (!kpi) return null;

  const hourTrend: 'up' | 'down' | 'neutral' = kpi.orders_last_hour > kpi.orders_prev_hour ? 'up' : kpi.orders_last_hour < kpi.orders_prev_hour ? 'down' : 'neutral';

  const tiles: KpiMeta[] = [
    {
      label: 'Bestellungen heute',
      value: kpi.orders_today.toString(),
      sub: kpi.orders_active > 0 ? `${kpi.orders_active} aktiv` : 'keine aktiv',
      icon: Package,
      color: 'text-blue-700',
      bg: 'bg-blue-50 border-blue-200',
    },
    {
      label: 'Umsatz heute',
      value: euro(kpi.revenue_today),
      sub: kpi.orders_today > 0 ? `Ø ${euro(kpi.revenue_today / kpi.orders_today)}/Bestellung` : undefined,
      icon: Euro,
      color: 'text-matcha-700',
      bg: 'bg-matcha-50 border-matcha-200',
    },
    {
      label: 'Ø Lieferzeit',
      value: kpi.avg_delivery_min != null ? `${Math.round(kpi.avg_delivery_min)} Min` : '—',
      sub: kpi.sla_rate_pct != null ? `SLA: ${kpi.sla_rate_pct.toFixed(0)}%` : undefined,
      trend: kpi.avg_delivery_min != null ? (kpi.avg_delivery_min <= 35 ? 'up' : 'down') : undefined,
      icon: Clock,
      color: kpi.avg_delivery_min != null && kpi.avg_delivery_min <= 35 ? 'text-matcha-700' : 'text-amber-700',
      bg: kpi.avg_delivery_min != null && kpi.avg_delivery_min <= 35 ? 'bg-matcha-50 border-matcha-200' : 'bg-amber-50 border-amber-200',
    },
    {
      label: 'SLA-Quote',
      value: kpi.sla_rate_pct != null ? `${kpi.sla_rate_pct.toFixed(0)}%` : '—',
      sub: '≤ 45 Min',
      trend: kpi.sla_rate_pct != null ? (kpi.sla_rate_pct >= 90 ? 'up' : 'down') : undefined,
      icon: Target,
      color: kpi.sla_rate_pct != null && kpi.sla_rate_pct >= 90 ? 'text-matcha-700' : 'text-orange-700',
      bg: kpi.sla_rate_pct != null && kpi.sla_rate_pct >= 90 ? 'bg-matcha-50 border-matcha-200' : 'bg-orange-50 border-orange-200',
    },
    {
      label: 'Fahrer online',
      value: kpi.drivers_online.toString(),
      sub: kpi.drivers_online === 0 ? 'Keiner verfügbar' : `${kpi.drivers_online} verfügbar`,
      icon: Bike,
      color: kpi.drivers_online > 0 ? 'text-blue-700' : 'text-red-700',
      bg: kpi.drivers_online > 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200',
    },
    {
      label: 'Letzte Stunde',
      value: kpi.orders_last_hour.toString(),
      sub: kpi.orders_prev_hour > 0 ? `vs. ${kpi.orders_prev_hour} davor` : undefined,
      trend: hourTrend,
      icon: Activity,
      color: hourTrend === 'up' ? 'text-matcha-700' : hourTrend === 'down' ? 'text-orange-700' : 'text-gray-700',
      bg: hourTrend === 'up' ? 'bg-matcha-50 border-matcha-200' : hourTrend === 'down' ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-200',
    },
    {
      label: 'Stornoquote',
      value: kpi.cancellation_rate_pct != null ? `${kpi.cancellation_rate_pct.toFixed(1)}%` : '—',
      sub: kpi.cancellation_rate_pct != null && kpi.cancellation_rate_pct <= 5 ? 'Gut' : 'Erhöht',
      trend: kpi.cancellation_rate_pct != null ? (kpi.cancellation_rate_pct <= 5 ? 'up' : 'down') : undefined,
      icon: Award,
      color: kpi.cancellation_rate_pct != null && kpi.cancellation_rate_pct <= 5 ? 'text-matcha-700' : 'text-red-700',
      bg: kpi.cancellation_rate_pct != null && kpi.cancellation_rate_pct <= 5 ? 'bg-matcha-50 border-matcha-200' : 'bg-red-50 border-red-200',
    },
  ];

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-500" />
          <span className="font-semibold text-sm text-gray-800">Executive-KPI-Kommando</span>
        </div>
        {updatedAt && (
          <span className="text-[10px] text-gray-400">
            {updatedAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {tiles.map(tile => {
          const Icon = tile.icon;
          return (
            <div key={tile.label} className={cn('p-3 rounded-xl border', tile.bg)}>
              <div className="flex items-start justify-between mb-1">
                <Icon className={cn('w-4 h-4 flex-shrink-0', tile.color)} />
                {tile.trend && <TrendIcon trend={tile.trend} />}
              </div>
              <p className={cn('text-xl font-bold tabular-nums leading-none', tile.color)}>{tile.value}</p>
              <p className="text-[10px] font-semibold text-gray-500 mt-0.5">{tile.label}</p>
              {tile.sub && <p className="text-[10px] text-gray-400 mt-0.5">{tile.sub}</p>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
