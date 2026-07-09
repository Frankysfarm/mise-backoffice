'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { euro } from '@/lib/utils';
import {
  Activity, AlertTriangle, Bike, CheckCircle2, Clock, Euro, Package,
  TrendingDown, TrendingUp, Users, Zap,
} from 'lucide-react';

type ShiftKpi = {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  onTimeRate: number;         // 0–100
  avgDeliveryMin: number;
  activeDrivers: number;
  revenueEur: number;
  revenueTarget: number;
  activeTours: number;
  pendingOrders: number;
};

type KpiTile = {
  label: string;
  value: string;
  subLabel?: string;
  icon: React.ElementType;
  color: string;
  trend?: 'up' | 'down' | 'neutral';
  alert?: boolean;
};

function KpiCard({ tile }: { tile: KpiTile }) {
  const Icon = tile.icon;
  const TrendIcon = tile.trend === 'up' ? TrendingUp : tile.trend === 'down' ? TrendingDown : null;

  return (
    <div className={cn(
      'rounded-xl border p-3 space-y-2 transition-all',
      tile.alert ? 'border-red-200 bg-red-50' : 'border-border bg-card',
    )}>
      <div className="flex items-center justify-between">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-full', `${tile.color}/10`)}>
          <Icon className={cn('h-4 w-4', tile.color.replace('/10', ''))} />
        </div>
        {TrendIcon && (
          <TrendIcon className={cn(
            'h-3.5 w-3.5',
            tile.trend === 'up' ? 'text-matcha-500' : 'text-red-500',
          )} />
        )}
        {tile.alert && <AlertTriangle className="h-3.5 w-3.5 text-red-500" />}
      </div>
      <div>
        <div className="text-xl font-black tabular-nums leading-none">{tile.value}</div>
        <div className="text-[10px] font-semibold text-muted-foreground mt-0.5">{tile.label}</div>
        {tile.subLabel && (
          <div className="text-[9px] text-muted-foreground/70 mt-0.5">{tile.subLabel}</div>
        )}
      </div>
    </div>
  );
}

function RevenueProgress({ current, target }: { current: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const color = pct >= 90 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#f97316';
  return (
    <div className="rounded-xl border bg-card p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Schicht-Umsatz
        </span>
        <span className="text-[10px] font-black" style={{ color }}>
          {pct}% vom Ziel
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-2xl font-black tabular-nums">{euro(current)}</div>
          <div className="text-[9px] text-muted-foreground">von {euro(target)} Ziel</div>
        </div>
        <Euro className="h-8 w-8 text-muted-foreground/20 shrink-0" />
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export function LieferdienstPhase900SchichtExecutiveDashboard({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [kpi, setKpi] = useState<ShiftKpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(Date.now());

  const supabase = createClient();

  const load = async () => {
    if (!locationId) { setLoading(false); return; }
    try {
      const now = new Date();
      const shiftStart = new Date(now);
      shiftStart.setHours(now.getHours() < 15 ? 8 : 15, 0, 0, 0);

      const [ordersRes, driversRes, batchesRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, status, created_at, geliefert_am, delivered_at, total_price, prep_time_min, geschaetzte_zubereitung_min')
          .eq('location_id', locationId)
          .gte('created_at', shiftStart.toISOString()),
        supabase
          .from('drivers')
          .select('id, active')
          .eq('location_id', locationId)
          .eq('active', true),
        supabase
          .from('delivery_batches')
          .select('id, status')
          .eq('location_id', locationId)
          .in('status', ['assigned', 'pickup', 'unterwegs', 'on_route']),
      ]);

      const orders = (ordersRes.data ?? []) as any[];
      const drivers = (driversRes.data ?? []) as any[];
      const batches = (batchesRes.data ?? []) as any[];

      const completed = orders.filter(o => ['geliefert', 'delivered', 'abgeholt'].includes(o.status));
      const cancelled = orders.filter(o => ['storniert', 'cancelled', 'abgebrochen'].includes(o.status));
      const pending   = orders.filter(o => !['geliefert', 'delivered', 'abgeholt', 'storniert', 'cancelled', 'abgebrochen'].includes(o.status));

      // On-time: delivered within prep_time + 15min
      const onTime = completed.filter(o => {
        if (!o.created_at || !o.geliefert_am && !o.delivered_at) return false;
        const deliveredAt = o.geliefert_am ?? o.delivered_at;
        const elapsedMin = (new Date(deliveredAt).getTime() - new Date(o.created_at).getTime()) / 60000;
        const target = (o.prep_time_min ?? o.geschaetzte_zubereitung_min ?? 15) + 20;
        return elapsedMin <= target;
      });

      const avgDeliveryMin = completed.length > 0
        ? Math.round(
            completed
              .filter(o => o.created_at && (o.geliefert_am || o.delivered_at))
              .reduce((sum, o) => {
                const deliveredAt = o.geliefert_am ?? o.delivered_at;
                return sum + (new Date(deliveredAt).getTime() - new Date(o.created_at).getTime()) / 60000;
              }, 0) / Math.max(1, completed.filter(o => o.created_at && (o.geliefert_am || o.delivered_at)).length)
          )
        : 0;

      const revenue = completed.reduce((sum, o) => sum + (parseFloat(o.total_price) || 0), 0);

      setKpi({
        totalOrders: orders.length,
        completedOrders: completed.length,
        cancelledOrders: cancelled.length,
        onTimeRate: completed.length > 0 ? Math.round((onTime.length / completed.length) * 100) : 0,
        avgDeliveryMin,
        activeDrivers: drivers.length,
        revenueEur: revenue,
        revenueTarget: Math.max(200, revenue * 1.15), // fallback target
        activeTours: batches.length,
        pendingOrders: pending.length,
      });
    } catch {
      // silently handle errors
    } finally {
      setLoading(false);
      setLastUpdated(Date.now());
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-4">
        <div className="h-4 w-48 bg-muted rounded animate-pulse mb-4" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!kpi) return null;

  const tiles: KpiTile[] = [
    {
      label: 'Bestellungen',
      value: kpi.totalOrders.toString(),
      subLabel: `${kpi.completedOrders} geliefert`,
      icon: Package,
      color: 'text-blue-600',
      trend: 'neutral',
    },
    {
      label: 'Pünktlichkeit',
      value: `${kpi.onTimeRate}%`,
      subLabel: 'Lieferungen on-time',
      icon: CheckCircle2,
      color: kpi.onTimeRate >= 85 ? 'text-matcha-600' : kpi.onTimeRate >= 70 ? 'text-amber-600' : 'text-red-600',
      trend: kpi.onTimeRate >= 85 ? 'up' : kpi.onTimeRate < 70 ? 'down' : 'neutral',
      alert: kpi.onTimeRate < 70,
    },
    {
      label: 'Ø Lieferzeit',
      value: `${kpi.avgDeliveryMin} Min`,
      subLabel: 'pro Bestellung',
      icon: Clock,
      color: kpi.avgDeliveryMin <= 30 ? 'text-matcha-600' : kpi.avgDeliveryMin <= 45 ? 'text-amber-600' : 'text-red-600',
      trend: kpi.avgDeliveryMin <= 30 ? 'up' : 'down',
      alert: kpi.avgDeliveryMin > 45,
    },
    {
      label: 'Aktive Fahrer',
      value: kpi.activeDrivers.toString(),
      subLabel: `${kpi.activeTours} Tour${kpi.activeTours !== 1 ? 'en' : ''} aktiv`,
      icon: Bike,
      color: 'text-matcha-600',
      trend: 'neutral',
    },
    {
      label: 'Wartend',
      value: kpi.pendingOrders.toString(),
      subLabel: 'Bestellungen offen',
      icon: Activity,
      color: kpi.pendingOrders > 10 ? 'text-red-600' : kpi.pendingOrders > 5 ? 'text-amber-600' : 'text-matcha-600',
      alert: kpi.pendingOrders > 10,
    },
    {
      label: 'Storniert',
      value: kpi.cancelledOrders.toString(),
      subLabel: kpi.totalOrders > 0
        ? `${Math.round((kpi.cancelledOrders / kpi.totalOrders) * 100)}% Stornoquote`
        : 'heute',
      icon: Zap,
      color: kpi.cancelledOrders === 0 ? 'text-matcha-600' : 'text-red-600',
      alert: kpi.totalOrders > 0 && kpi.cancelledOrders / kpi.totalOrders > 0.1,
    },
  ];

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/30">
        <Activity className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wide">Schicht-Dashboard</span>
        <span className="ml-auto text-[9px] text-muted-foreground">
          {new Date(lastUpdated).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
        </span>
      </div>

      <div className="p-3 space-y-3">
        {/* Revenue progress */}
        <RevenueProgress current={kpi.revenueEur} target={kpi.revenueTarget} />

        {/* KPI grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {tiles.map(tile => (
            <KpiCard key={tile.label} tile={tile} />
          ))}
        </div>
      </div>
    </div>
  );
}
