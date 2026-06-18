'use client';

import { useMemo } from 'react';
import { Package, Users, ChefHat, Target, Clock, Euro, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Order } from '@/lib/lieferdienst/orders';
import type { Driver } from '@/lib/lieferdienst/drivers';

interface StatItem {
  label: string;
  value: string;
  icon: React.ElementType;
  trend: 'up' | 'down' | 'neutral';
  trendValue: string;
  color: string;
}

interface Props {
  orders: Order[];
  drivers: Driver[];
}

function buildStats(orders: Order[], drivers: Driver[]): StatItem[] {
  const activeOrders = orders.filter(o =>
    ['pending', 'accepted', 'waiting_customer', 'call_customer'].includes(o.status),
  ).length;

  const onlineDrivers = drivers.filter(d => d.status !== 'offline').length;

  const prepTimes: number[] = [];
  for (const o of orders) {
    if (o.acceptedAt && o.doneAt) {
      const mins = (new Date(o.doneAt).getTime() - new Date(o.acceptedAt).getTime()) / 60_000;
      if (mins > 0 && mins < 120) prepTimes.push(mins);
    } else if (o.estimatedTime) {
      prepTimes.push(o.estimatedTime);
    }
  }
  const avgPrep = prepTimes.length > 0
    ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length)
    : null;

  const etaTimes: number[] = orders
    .filter(o => o.estimatedTime != null)
    .map(o => o.estimatedTime as number);
  const avgEta = etaTimes.length > 0
    ? Math.round(etaTimes.reduce((a, b) => a + b, 0) / etaTimes.length)
    : null;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const doneToday = orders.filter(o =>
    o.status === 'done' &&
    o.doneAt &&
    new Date(o.doneAt) >= todayStart,
  );
  const onTimeCount = doneToday.filter(o => {
    if (!o.acceptedAt || !o.doneAt || !o.estimatedTime) return false;
    const actualMin = (new Date(o.doneAt).getTime() - new Date(o.acceptedAt).getTime()) / 60_000;
    return actualMin <= o.estimatedTime * 1.1;
  }).length;
  const onTimeRate = doneToday.length > 0
    ? Math.round((onTimeCount / doneToday.length) * 100)
    : null;

  const revenue = doneToday.reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);

  return [
    {
      label: 'Aktive Bestellungen',
      value: String(activeOrders),
      icon: Package,
      trend: activeOrders > 0 ? 'up' : 'neutral',
      trendValue: activeOrders > 10 ? 'Viel los' : activeOrders > 0 ? 'In Bearbeitung' : 'Ruhig',
      color: 'text-amber-600',
    },
    {
      label: 'Fahrer online',
      value: String(onlineDrivers),
      icon: Users,
      trend: onlineDrivers >= 3 ? 'up' : onlineDrivers > 0 ? 'neutral' : 'down',
      trendValue: onlineDrivers >= 3 ? 'Gut besetzt' : onlineDrivers > 0 ? 'Knapp' : 'Engpass',
      color: onlineDrivers >= 3 ? 'text-emerald-600' : 'text-red-600',
    },
    {
      label: 'Ø Zubereitungszeit',
      value: avgPrep != null ? `${avgPrep} Min` : '–',
      icon: ChefHat,
      trend: avgPrep == null ? 'neutral' : avgPrep <= 18 ? 'up' : avgPrep <= 24 ? 'neutral' : 'down',
      trendValue: avgPrep == null ? 'Keine Daten' : avgPrep <= 18 ? 'Schnell' : avgPrep <= 24 ? 'Normal' : 'Langsam',
      color: avgPrep == null ? 'text-muted-foreground' : avgPrep <= 18 ? 'text-emerald-600' : avgPrep <= 24 ? 'text-amber-600' : 'text-red-600',
    },
    {
      label: 'Pünktlichkeitsrate',
      value: onTimeRate != null ? `${onTimeRate}%` : '–',
      icon: Target,
      trend: onTimeRate == null ? 'neutral' : onTimeRate >= 85 ? 'up' : onTimeRate >= 70 ? 'neutral' : 'down',
      trendValue: onTimeRate == null ? 'Keine Daten' : onTimeRate >= 85 ? 'Sehr gut' : onTimeRate >= 70 ? 'Gut' : 'Kritisch',
      color: onTimeRate == null ? 'text-muted-foreground' : onTimeRate >= 85 ? 'text-emerald-600' : onTimeRate >= 70 ? 'text-amber-600' : 'text-red-600',
    },
    {
      label: 'Ø ETA',
      value: avgEta != null ? `${avgEta} Min` : '–',
      icon: Clock,
      trend: avgEta == null ? 'neutral' : avgEta <= 30 ? 'up' : avgEta <= 40 ? 'neutral' : 'down',
      trendValue: avgEta == null ? 'Keine Daten' : avgEta <= 30 ? 'Gut' : avgEta <= 40 ? 'Erhöht' : 'Hoch',
      color: avgEta == null ? 'text-muted-foreground' : avgEta <= 30 ? 'text-emerald-600' : avgEta <= 40 ? 'text-amber-600' : 'text-red-600',
    },
    {
      label: 'Umsatz heute',
      value: revenue > 0
        ? revenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
        : '–',
      icon: Euro,
      trend: revenue > 1200 ? 'up' : revenue > 0 ? 'neutral' : 'neutral',
      trendValue: revenue > 1200 ? 'Stark' : revenue > 0 ? 'Im Plan' : 'Keine Daten',
      color: 'text-matcha-600',
    },
  ];
}

export function LiveOpsStats({ orders, drivers }: Props) {
  const stats = useMemo(() => buildStats(orders, drivers), [orders, drivers]);

  return (
    <div className="bg-card border rounded-xl p-4">
      <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
        Live-Betriebsstatistiken
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {stats.map(({ label, value, icon: Icon, trend, trendValue, color }) => (
          <div key={label} className="rounded-xl border bg-background px-3 py-3">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center bg-muted', color)}>
                <Icon size={16} />
              </div>
              <div className={cn(
                'flex items-center gap-0.5 text-[10px] font-bold rounded-full px-2 py-0.5',
                trend === 'up' ? 'bg-emerald-50 text-emerald-700' :
                trend === 'down' ? 'bg-red-50 text-red-700' : 'bg-muted text-muted-foreground',
              )}>
                {trend === 'up' ? <TrendingUp size={10} /> : trend === 'down' ? <TrendingDown size={10} /> : <Minus size={10} />}
                <span className="ml-0.5">{trendValue}</span>
              </div>
            </div>
            <div className={cn('font-display font-black text-2xl tabular-nums leading-none', color)}>
              {value}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1 leading-tight">{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
