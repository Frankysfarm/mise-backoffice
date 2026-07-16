'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import { BarChart2, CheckCircle2, Clock, Euro, Star, TrendingDown, TrendingUp, Truck, Users, XCircle } from 'lucide-react';

type Stats = {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  avgDeliveryMin: number | null;
  onTimePct: number | null;
  totalRevenue: number;
  avgOrderValue: number | null;
  activeDrivers: number;
};

function StatKachel({
  label, value, sub, icon: Icon, trend, color,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof TrendingUp;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-stone-200 bg-white p-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">{label}</span>
        <Icon className={cn('h-3.5 w-3.5', color ?? 'text-stone-400')} />
      </div>
      <div className={cn('text-xl font-black tabular-nums tracking-tight', color ?? 'text-stone-900')}>
        {value}
      </div>
      {sub && (
        <div className="flex items-center gap-1 text-[10px] text-stone-400">
          {trend === 'up' && <TrendingUp className="h-2.5 w-2.5 text-matcha-600" />}
          {trend === 'down' && <TrendingDown className="h-2.5 w-2.5 text-red-500" />}
          {sub}
        </div>
      )}
    </div>
  );
}

export function LieferdienstPhase890KompaktStatistikenCockpit({
  locationId,
}: {
  locationId: string | null;
}) {
  const supabase = createClient();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  async function load() {
    if (!locationId) return;
    const today = new Date(); today.setHours(0, 0, 0, 0);

    const [ordersRes, driversRes] = await Promise.all([
      supabase
        .from('customer_orders')
        .select('id, status, gesamtbetrag, fertig_am, bestellt_am, eta_earliest, eta_latest')
        .eq('location_id', locationId)
        .gte('bestellt_am', today.toISOString()),
      supabase
        .from('employees')
        .select('id, status:driver_status(ist_online)')
        .eq('rolle', 'fahrer')
        .eq('aktiv', true),
    ]);

    const orders = (ordersRes.data ?? []) as any[];
    const completed = orders.filter(o =>
      ['geliefert', 'abgeholt', 'abgeschlossen'].includes(o.status));
    const cancelled = orders.filter(o =>
      ['storniert', 'abgebrochen'].includes(o.status));

    const deliveryTimes: number[] = [];
    let onTimeCount = 0;
    for (const o of completed) {
      if (o.bestellt_am && o.fertig_am) {
        const min = (new Date(o.fertig_am).getTime() - new Date(o.bestellt_am).getTime()) / 60_000;
        if (min > 0 && min < 120) deliveryTimes.push(min);
      }
      if (o.eta_latest && o.fertig_am) {
        if (new Date(o.fertig_am) <= new Date(o.eta_latest)) onTimeCount++;
      }
    }

    const totalRevenue = completed.reduce((s: number, o: any) => s + (o.gesamtbetrag ?? 0), 0);
    const drivers = (driversRes.data ?? []) as any[];
    const activeDrivers = drivers.filter(d => (d.status as any)?.ist_online).length;

    setStats({
      totalOrders: orders.length,
      completedOrders: completed.length,
      cancelledOrders: cancelled.length,
      avgDeliveryMin: deliveryTimes.length > 0
        ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length)
        : null,
      onTimePct: completed.length > 0 ? Math.round((onTimeCount / completed.length) * 100) : null,
      totalRevenue,
      avgOrderValue: completed.length > 0
        ? Math.round(totalRevenue / completed.length * 100) / 100
        : null,
      activeDrivers,
    });
    setLoading(false);
  }

  if (!locationId) return null;
  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="h-4 w-48 bg-stone-100 rounded animate-pulse mb-4" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="h-20 bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }
  if (!stats) return null;

  const fmtEur = (v: number) =>
    v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  const cancelRate = stats.totalOrders > 0
    ? Math.round((stats.cancelledOrders / stats.totalOrders) * 100)
    : 0;

  return (
    <div className="rounded-2xl border border-stone-200 bg-stone-50 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-stone-100">
        <BarChart2 className="h-4 w-4 text-matcha-600 shrink-0" />
        <div className="text-sm font-bold text-stone-900">Statistiken · Heute</div>
        <div className="ml-auto text-[10px] text-stone-400">Echtzeit</div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
        <StatKachel
          label="Bestellungen"
          value={stats.totalOrders.toString()}
          sub={`${stats.completedOrders} abgeschlossen`}
          icon={CheckCircle2}
          trend="up"
          color="text-matcha-700"
        />
        <StatKachel
          label="Umsatz"
          value={fmtEur(stats.totalRevenue)}
          sub={stats.avgOrderValue != null ? `Ø ${fmtEur(stats.avgOrderValue)} / Bestellung` : undefined}
          icon={Euro}
          trend="up"
          color="text-emerald-700"
        />
        <StatKachel
          label="Pünktlichkeit"
          value={stats.onTimePct != null ? `${stats.onTimePct}%` : '—'}
          sub={stats.avgDeliveryMin != null ? `Ø ${stats.avgDeliveryMin} Min Lieferzeit` : undefined}
          icon={Clock}
          trend={stats.onTimePct != null && stats.onTimePct >= 85 ? 'up' : 'down'}
          color={stats.onTimePct == null ? 'text-stone-400' : stats.onTimePct >= 85 ? 'text-matcha-700' : stats.onTimePct >= 70 ? 'text-amber-600' : 'text-red-600'}
        />
        <StatKachel
          label="Stornoq."
          value={`${cancelRate}%`}
          sub={`${stats.cancelledOrders} Storno${stats.cancelledOrders !== 1 ? 's' : ''}`}
          icon={XCircle}
          trend={cancelRate <= 5 ? 'up' : 'down'}
          color={cancelRate <= 5 ? 'text-matcha-700' : cancelRate <= 10 ? 'text-amber-600' : 'text-red-600'}
        />
        <StatKachel
          label="Fahrer online"
          value={stats.activeDrivers.toString()}
          icon={Users}
          color="text-blue-700"
        />
      </div>

      {/* Ampel summary */}
      <div className="flex items-center gap-2 flex-wrap px-4 pb-3">
        {[
          {
            ok: stats.completedOrders > 0,
            label: `${stats.completedOrders} geliefert`,
            icon: Truck,
            color: stats.completedOrders > 0 ? 'text-matcha-600' : 'text-stone-400',
          },
          {
            ok: stats.onTimePct != null && stats.onTimePct >= 85,
            label: stats.onTimePct != null ? `${stats.onTimePct}% pünktlich` : 'keine Daten',
            icon: Star,
            color: stats.onTimePct != null && stats.onTimePct >= 85 ? 'text-amber-500' : 'text-stone-400',
          },
          {
            ok: cancelRate <= 5,
            label: `${cancelRate}% Storno`,
            icon: cancelRate <= 5 ? CheckCircle2 : XCircle,
            color: cancelRate <= 5 ? 'text-matcha-600' : 'text-red-500',
          },
        ].map((item, i) => (
          <span key={i} className={cn('flex items-center gap-1 text-[10px] font-semibold', item.color)}>
            <item.icon className="h-3 w-3" />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
