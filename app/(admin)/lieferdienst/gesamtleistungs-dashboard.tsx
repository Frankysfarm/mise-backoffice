'use client';
import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Bike, Package, Clock, Target, Euro, Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';

type Kpi = {
  label: string;
  value: string;
  sub: string;
  trend: 'up' | 'down' | 'flat';
  color: string;
  bg: string;
  icon: React.ElementType;
};

type Props = {
  locationId: string | null;
};

export function LieferdienstGesamtleistungsDashboard({ locationId }: Props) {
  const [data, setData] = useState<{
    activeDrivers: number | null;
    ordersToday: number | null;
    avgDeliveryMin: number | null;
    onTimePct: number | null;
    revenuePerHour: number | null;
    feedbackAvg: number | null;
  }>({ activeDrivers: null, ordersToday: null, avgDeliveryMin: null, onTimePct: null, revenuePerHour: null, feedbackAvg: null });

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      try {
        const [slaRes, overviewRes] = await Promise.all([
          fetch(`/api/delivery/admin/sla?location_id=${locationId}&days=1`).then(r => r.ok ? r.json() : null).catch(() => null),
          fetch(`/api/delivery/admin/overview?location_id=${locationId}`).then(r => r.ok ? r.json() : null).catch(() => null),
        ]);
        setData(prev => ({
          ...prev,
          onTimePct: slaRes?.summary?.onTimePct ?? prev.onTimePct,
          avgDeliveryMin: slaRes?.summary?.avgDeliveryMin ?? prev.avgDeliveryMin,
          ordersToday: slaRes?.summary?.totalStops ?? overviewRes?.today_stats?.total_orders ?? prev.ordersToday,
          revenuePerHour: overviewRes?.today_stats?.revenue_per_hour ?? prev.revenuePerHour,
          feedbackAvg: overviewRes?.today_stats?.feedback_avg ?? prev.feedbackAvg,
        }));
      } catch {}
    };
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, [locationId]);

  // Get active drivers from parent via supabase or show placeholder
  // We compute it from a separate call
  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/driver?location_id=${locationId}`).then(r => r.ok ? r.json() : null).catch(() => null);
        if (res?.drivers) {
          const active = (res.drivers as any[]).filter((d: any) => d.ist_online).length;
          setData(prev => ({ ...prev, activeDrivers: active }));
        }
      } catch {}
    };
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const kpis: Kpi[] = [
    {
      label: 'Aktive Fahrer',
      value: data.activeDrivers != null ? String(data.activeDrivers) : '—',
      sub: 'gerade online',
      trend: 'flat',
      color: 'text-matcha-700',
      bg: 'bg-matcha-50',
      icon: Bike,
    },
    {
      label: 'Bestellungen heute',
      value: data.ordersToday != null ? String(data.ordersToday) : '—',
      sub: 'geliefert',
      trend: 'up',
      color: 'text-blue-700',
      bg: 'bg-blue-50',
      icon: Package,
    },
    {
      label: 'Ø Lieferzeit',
      value: data.avgDeliveryMin != null ? `${Math.round(data.avgDeliveryMin)} Min` : '—',
      sub: 'Ziel: <35 Min',
      trend: data.avgDeliveryMin != null ? (data.avgDeliveryMin < 35 ? 'up' : 'down') : 'flat',
      color: data.avgDeliveryMin != null && data.avgDeliveryMin < 35 ? 'text-matcha-700' : 'text-amber-700',
      bg: data.avgDeliveryMin != null && data.avgDeliveryMin < 35 ? 'bg-matcha-50' : 'bg-amber-50',
      icon: Clock,
    },
    {
      label: 'Pünktlichkeit',
      value: data.onTimePct != null ? `${Math.round(data.onTimePct)}%` : '—',
      sub: 'Ziel: ≥85%',
      trend: data.onTimePct != null ? (data.onTimePct >= 85 ? 'up' : 'down') : 'flat',
      color: data.onTimePct != null && data.onTimePct >= 85 ? 'text-matcha-700' : 'text-red-700',
      bg: data.onTimePct != null && data.onTimePct >= 85 ? 'bg-matcha-50' : 'bg-red-50',
      icon: Target,
    },
    {
      label: 'Umsatz/Stunde',
      value: data.revenuePerHour != null ? `${data.revenuePerHour.toFixed(0)} €` : '—',
      sub: 'aktuell',
      trend: 'up',
      color: 'text-gold-700',
      bg: 'bg-gold/10',
      icon: Euro,
    },
    {
      label: 'Ø Bewertung',
      value: data.feedbackAvg != null ? data.feedbackAvg.toFixed(1) : '—',
      sub: 'Kundenzufriedenheit',
      trend: data.feedbackAvg != null ? (data.feedbackAvg >= 4.0 ? 'up' : 'down') : 'flat',
      color: data.feedbackAvg != null && data.feedbackAvg >= 4.0 ? 'text-matcha-700' : 'text-amber-700',
      bg: data.feedbackAvg != null && data.feedbackAvg >= 4.0 ? 'bg-matcha-50' : 'bg-amber-50',
      icon: Star,
    },
  ];

  const TrendIcon = ({ trend }: { trend: Kpi['trend'] }) => {
    if (trend === 'up') return <TrendingUp className="h-3 w-3 text-matcha-600" />;
    if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-stone-400" />;
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-matcha-600" />
        <span className="text-sm font-bold text-foreground">Gesamtleistung heute</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className={cn('rounded-xl p-3 space-y-1', kpi.bg)}>
              <div className="flex items-center gap-1.5">
                <Icon className={cn('h-3.5 w-3.5', kpi.color)} />
                <span className="text-[10px] font-semibold text-muted-foreground">{kpi.label}</span>
              </div>
              <div className={cn('text-xl font-black tabular-nums', kpi.color)}>{kpi.value}</div>
              <div className="flex items-center gap-1">
                <TrendIcon trend={kpi.trend} />
                <span className="text-[9px] text-muted-foreground">{kpi.sub}</span>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
