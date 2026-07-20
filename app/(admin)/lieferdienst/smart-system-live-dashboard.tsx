'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import {
  Activity, AlertTriangle, Bike, ChefHat, CheckCircle2,
  Clock, Flame, Package, RefreshCw, Target, TrendingDown, TrendingUp, Truck, Zap,
} from 'lucide-react';

interface SystemStatus {
  kitchen: {
    activeOrders: number;
    avgPrepMin: number;
    overdueCount: number;
    capacityPct: number;
  };
  dispatch: {
    activeTours: number;
    pendingAssignments: number;
    avgTourStops: number;
    avgScorePct: number;
  };
  drivers: {
    onlineCount: number;
    onTourCount: number;
    avgDeliveryMin: number;
    onTimePct: number;
  };
  sla: {
    onTimePct: number;
    avgDeliveryMin: number;
    activeOrderCount: number;
    cancelPct: number;
  };
}

const MOCK: SystemStatus = {
  kitchen: { activeOrders: 8, avgPrepMin: 14, overdueCount: 1, capacityPct: 72 },
  dispatch: { activeTours: 4, pendingAssignments: 2, avgTourStops: 3.5, avgScorePct: 84 },
  drivers: { onlineCount: 6, onTourCount: 4, avgDeliveryMin: 28, onTimePct: 89 },
  sla: { onTimePct: 87, avgDeliveryMin: 32, activeOrderCount: 12, cancelPct: 3.2 },
};

function StatusBadge({ pct, thresholds }: { pct: number; thresholds: [number, number] }) {
  const [warn, crit] = thresholds;
  const color =
    pct >= crit ? 'bg-green-500/15 text-green-400 border border-green-500/30' :
    pct >= warn ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
                  'bg-red-500/15 text-red-400 border border-red-500/30';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', color)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', pct >= crit ? 'bg-green-400' : pct >= warn ? 'bg-amber-400' : 'bg-red-400')} />
      {pct >= crit ? 'OK' : pct >= warn ? 'Achtung' : 'Kritisch'}
    </span>
  );
}

function ProgressBar({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-1.5 w-full rounded-full bg-white/10">
      <div
        className={cn('h-full rounded-full transition-all duration-700', colorClass)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function KpiTile({
  icon: Icon,
  label,
  value,
  sub,
  trend,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  trend?: 'up' | 'down' | 'flat';
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center gap-1.5 text-white/50 text-xs">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="flex items-end justify-between gap-1">
        <span className="text-xl font-bold text-white">{value}</span>
        {trend && (
          <span className={cn('text-xs', trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-white/40')}>
            {trend === 'up' ? <TrendingUp className="h-4 w-4" /> : trend === 'down' ? <TrendingDown className="h-4 w-4" /> : '—'}
          </span>
        )}
      </div>
      {sub && <span className="text-xs text-white/40">{sub}</span>}
    </div>
  );
}

export function SmartSystemLiveDashboard({ locationId }: { locationId?: string | null }) {
  const [status, setStatus] = useState<SystemStatus>(MOCK);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [collapsed, setCollapsed] = useState(false);
  const supabase = createClient();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) {
      setStatus(MOCK);
      setLastUpdated(new Date());
      return;
    }

    setLoading(true);
    try {
      const now = new Date();
      const shiftStart = new Date(now);
      shiftStart.setHours(0, 0, 0, 0);

      const [ordersRes, toursRes, driversRes] = await Promise.all([
        supabase
          .from('customer_orders')
          .select('status, lieferzeit_min, kochstart_empfohlen_um, fertig_am, bestellt_am')
          .eq('location_id', locationId)
          .gte('bestellt_am', shiftStart.toISOString()),
        supabase
          .from('tours')
          .select('status, stop_count, score_pct, fertig_am')
          .eq('location_id', locationId)
          .gte('erstellt_am', shiftStart.toISOString()),
        supabase
          .from('drivers')
          .select('status, last_delivery_min, score_pct')
          .eq('location_id', locationId),
      ]);

      const orders = ordersRes.data ?? [];
      const tours = toursRes.data ?? [];
      const drivers = driversRes.data ?? [];

      const kitchenOrders = orders.filter((o: Record<string, unknown>) =>
        o.status === 'in_preparation' || o.status === 'confirmed'
      );
      const overdueOrders = kitchenOrders.filter((o: Record<string, unknown>) => {
        if (!o.kochstart_empfohlen_um) return false;
        return (now.getTime() - new Date(o.kochstart_empfohlen_um as string).getTime()) > 20 * 60_000;
      });
      const prepTimes = orders
        .filter((o: Record<string, unknown>) => o.fertig_am && o.bestellt_am)
        .map((o: Record<string, unknown>) =>
          (new Date(o.fertig_am as string).getTime() - new Date(o.bestellt_am as string).getTime()) / 60_000
        );
      const avgPrepMin = prepTimes.length > 0
        ? prepTimes.reduce((s: number, t: number) => s + t, 0) / prepTimes.length
        : MOCK.kitchen.avgPrepMin;

      const activeTours = (tours as Record<string, unknown>[]).filter((t) => t.status === 'active');
      const tourScores = (activeTours as Record<string, unknown>[]).filter((t) => t.score_pct != null).map((t) => t.score_pct as number);
      const avgScore = tourScores.length > 0
        ? tourScores.reduce((s, x) => s + x, 0) / tourScores.length
        : MOCK.dispatch.avgScorePct;

      const onlineDrivers = (drivers as Record<string, unknown>[]).filter((d) => d.status === 'online' || d.status === 'on_tour');
      const onTourDrivers = (drivers as Record<string, unknown>[]).filter((d) => d.status === 'on_tour');
      const deliveryTimes = (onlineDrivers as Record<string, unknown>[])
        .filter((d) => d.last_delivery_min != null)
        .map((d) => d.last_delivery_min as number);
      const avgDeliveryMin = deliveryTimes.length > 0
        ? deliveryTimes.reduce((s, t) => s + t, 0) / deliveryTimes.length
        : MOCK.drivers.avgDeliveryMin;

      const delivered = orders.filter((o: Record<string, unknown>) => o.status === 'delivered');
      const onTime = delivered.filter((o: Record<string, unknown>) => (o.lieferzeit_min as number ?? 99) <= 35);
      const onTimePct = delivered.length > 0 ? (onTime.length / delivered.length) * 100 : MOCK.sla.onTimePct;
      const cancelled = orders.filter((o: Record<string, unknown>) => o.status === 'cancelled');
      const cancelPct = orders.length > 0 ? (cancelled.length / orders.length) * 100 : MOCK.sla.cancelPct;
      const avgDelMin = delivered.length > 0
        ? delivered.reduce((s: number, o: Record<string, unknown>) => s + (o.lieferzeit_min as number ?? 32), 0) / delivered.length
        : MOCK.sla.avgDeliveryMin;

      setStatus({
        kitchen: {
          activeOrders: kitchenOrders.length,
          avgPrepMin: Math.round(avgPrepMin),
          overdueCount: overdueOrders.length,
          capacityPct: Math.min(100, (kitchenOrders.length / 15) * 100),
        },
        dispatch: {
          activeTours: activeTours.length,
          pendingAssignments: orders.filter((o: Record<string, unknown>) => o.status === 'confirmed' && !o.fertig_am).length,
          avgTourStops: activeTours.length > 0
            ? (activeTours as Record<string, unknown>[]).reduce((s, t) => s + (t.stop_count as number ?? 3), 0) / activeTours.length
            : MOCK.dispatch.avgTourStops,
          avgScorePct: Math.round(avgScore),
        },
        drivers: {
          onlineCount: onlineDrivers.length,
          onTourCount: onTourDrivers.length,
          avgDeliveryMin: Math.round(avgDeliveryMin),
          onTimePct: Math.round(onTimePct),
        },
        sla: {
          onTimePct: Math.round(onTimePct),
          avgDeliveryMin: Math.round(avgDelMin),
          activeOrderCount: orders.filter((o: Record<string, unknown>) =>
            !['delivered', 'cancelled'].includes(o.status as string)
          ).length,
          cancelPct: Math.round(cancelPct * 10) / 10,
        },
      });
    } catch {
      setStatus(MOCK);
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 30_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const systemScore = Math.round(
    (status.kitchen.capacityPct < 90 ? 100 : 60) * 0.25 +
    status.dispatch.avgScorePct * 0.25 +
    status.drivers.onTimePct * 0.25 +
    status.sla.onTimePct * 0.25
  );

  const systemOk = systemScore >= 80;
  const systemWarn = systemScore >= 65 && systemScore < 80;

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/80 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={cn(
            'flex h-8 w-8 items-center justify-center rounded-lg',
            systemOk ? 'bg-green-500/20' : systemWarn ? 'bg-amber-500/20' : 'bg-red-500/20'
          )}>
            <Activity className={cn('h-4 w-4', systemOk ? 'text-green-400' : systemWarn ? 'text-amber-400' : 'text-red-400')} />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">Smart Delivery System</p>
            <p className="text-xs text-white/40">
              Live-Status · alle Bereiche · Score {systemScore}%
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {loading && <RefreshCw className="h-3.5 w-3.5 text-white/40 animate-spin" />}
          <span className="text-xs text-white/30">
            {lastUpdated.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span className={cn(
            'text-xs font-medium px-2 py-0.5 rounded-full',
            systemOk ? 'bg-green-500/15 text-green-400' : systemWarn ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'
          )}>
            {systemOk ? '● Stabil' : systemWarn ? '● Achtung' : '● Kritisch'}
          </span>
        </div>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-4">
          {/* System score bar */}
          <div className="flex items-center gap-3">
            <span className="text-xs text-white/40 w-16 shrink-0">System</span>
            <ProgressBar
              value={systemScore}
              max={100}
              colorClass={systemOk ? 'bg-green-500' : systemWarn ? 'bg-amber-500' : 'bg-red-500'}
            />
            <span className="text-xs font-bold text-white w-10 text-right">{systemScore}%</span>
          </div>

          {/* 4 Service Sections */}
          <div className="grid grid-cols-2 gap-3">

            {/* Kitchen */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-white/60 text-xs font-medium">
                  <ChefHat className="h-3.5 w-3.5" />
                  Küche
                </div>
                <StatusBadge
                  pct={status.kitchen.overdueCount === 0 ? 100 : status.kitchen.overdueCount <= 1 ? 75 : 40}
                  thresholds={[70, 90]}
                />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <p className="text-white/40 text-[10px]">Aktiv</p>
                  <p className="text-white text-base font-bold">{status.kitchen.activeOrders}</p>
                </div>
                <div>
                  <p className="text-white/40 text-[10px]">Ø Prep</p>
                  <p className={cn('text-base font-bold', status.kitchen.avgPrepMin > 20 ? 'text-amber-400' : 'text-white')}>
                    {status.kitchen.avgPrepMin}m
                  </p>
                </div>
              </div>
              {status.kitchen.overdueCount > 0 && (
                <div className="flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-1">
                  <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0" />
                  <span className="text-xs text-amber-400">{status.kitchen.overdueCount} überfällig</span>
                </div>
              )}
              <ProgressBar
                value={status.kitchen.capacityPct}
                max={100}
                colorClass={status.kitchen.capacityPct > 85 ? 'bg-red-500' : status.kitchen.capacityPct > 60 ? 'bg-amber-500' : 'bg-green-500'}
              />
            </div>

            {/* Dispatch */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-white/60 text-xs font-medium">
                  <Truck className="h-3.5 w-3.5" />
                  Dispatch
                </div>
                <StatusBadge pct={status.dispatch.avgScorePct} thresholds={[70, 85]} />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <p className="text-white/40 text-[10px]">Touren</p>
                  <p className="text-white text-base font-bold">{status.dispatch.activeTours}</p>
                </div>
                <div>
                  <p className="text-white/40 text-[10px]">Score</p>
                  <p className={cn('text-base font-bold', status.dispatch.avgScorePct >= 85 ? 'text-green-400' : status.dispatch.avgScorePct >= 70 ? 'text-amber-400' : 'text-red-400')}>
                    {status.dispatch.avgScorePct}%
                  </p>
                </div>
              </div>
              {status.dispatch.pendingAssignments > 0 && (
                <div className="flex items-center gap-1 rounded-lg bg-blue-500/10 px-2 py-1">
                  <Package className="h-3 w-3 text-blue-400 shrink-0" />
                  <span className="text-xs text-blue-400">{status.dispatch.pendingAssignments} offen</span>
                </div>
              )}
              <ProgressBar
                value={status.dispatch.avgScorePct}
                max={100}
                colorClass={status.dispatch.avgScorePct >= 85 ? 'bg-green-500' : status.dispatch.avgScorePct >= 70 ? 'bg-amber-500' : 'bg-red-500'}
              />
            </div>

            {/* Drivers */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-white/60 text-xs font-medium">
                  <Bike className="h-3.5 w-3.5" />
                  Fahrer
                </div>
                <StatusBadge pct={status.drivers.onTimePct} thresholds={[75, 88]} />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <p className="text-white/40 text-[10px]">Online</p>
                  <p className="text-white text-base font-bold">{status.drivers.onlineCount}</p>
                  <p className="text-white/30 text-[10px]">{status.drivers.onTourCount} auf Tour</p>
                </div>
                <div>
                  <p className="text-white/40 text-[10px]">Ø Zeit</p>
                  <p className={cn('text-base font-bold', status.drivers.avgDeliveryMin > 35 ? 'text-red-400' : status.drivers.avgDeliveryMin > 28 ? 'text-amber-400' : 'text-green-400')}>
                    {status.drivers.avgDeliveryMin}m
                  </p>
                </div>
              </div>
              <ProgressBar
                value={status.drivers.onTimePct}
                max={100}
                colorClass={status.drivers.onTimePct >= 88 ? 'bg-green-500' : status.drivers.onTimePct >= 75 ? 'bg-amber-500' : 'bg-red-500'}
              />
            </div>

            {/* SLA */}
            <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-white/60 text-xs font-medium">
                  <Target className="h-3.5 w-3.5" />
                  SLA
                </div>
                <StatusBadge pct={status.sla.onTimePct} thresholds={[75, 88]} />
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div>
                  <p className="text-white/40 text-[10px]">Pünktlich</p>
                  <p className={cn('text-base font-bold', status.sla.onTimePct >= 88 ? 'text-green-400' : status.sla.onTimePct >= 75 ? 'text-amber-400' : 'text-red-400')}>
                    {status.sla.onTimePct}%
                  </p>
                </div>
                <div>
                  <p className="text-white/40 text-[10px]">Storno</p>
                  <p className={cn('text-base font-bold', status.sla.cancelPct > 8 ? 'text-red-400' : status.sla.cancelPct > 5 ? 'text-amber-400' : 'text-white')}>
                    {status.sla.cancelPct}%
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-white/40">
                <Zap className="h-3 w-3" />
                {status.sla.activeOrderCount} Bestellungen aktiv
              </div>
              <ProgressBar
                value={status.sla.onTimePct}
                max={100}
                colorClass={status.sla.onTimePct >= 88 ? 'bg-green-500' : status.sla.onTimePct >= 75 ? 'bg-amber-500' : 'bg-red-500'}
              />
            </div>
          </div>

          {/* Alerts */}
          {(status.kitchen.overdueCount > 0 || status.dispatch.pendingAssignments > 2 || status.sla.cancelPct > 8) && (
            <div className="space-y-1.5">
              {status.kitchen.overdueCount > 0 && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2">
                  <Flame className="h-4 w-4 text-amber-400 shrink-0" />
                  <span className="text-sm text-amber-300">
                    {status.kitchen.overdueCount} Bestellung{status.kitchen.overdueCount > 1 ? 'en' : ''} in Küche überfällig
                  </span>
                </div>
              )}
              {status.dispatch.pendingAssignments > 2 && (
                <div className="flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2">
                  <Package className="h-4 w-4 text-blue-400 shrink-0" />
                  <span className="text-sm text-blue-300">
                    {status.dispatch.pendingAssignments} offene Zuteilungen im Dispatch
                  </span>
                </div>
              )}
              {status.sla.cancelPct > 8 && (
                <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2">
                  <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
                  <span className="text-sm text-red-300">
                    Stornoquote {status.sla.cancelPct}% — Intervention empfohlen
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Bottom meta */}
          <div className="flex items-center justify-between text-xs text-white/25 pt-1 border-t border-white/5">
            <span>Smart Delivery System · Echtzeit · 30s Aktualisierung</span>
            <span>{lastUpdated.toLocaleTimeString('de-DE')}</span>
          </div>
        </div>
      )}
    </div>
  );
}
