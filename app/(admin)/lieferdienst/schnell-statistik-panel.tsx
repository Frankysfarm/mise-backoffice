'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, Euro, Package, Clock, Star, Bike,
  AlertTriangle, RefreshCw, BarChart3, Target, CheckCircle2, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type StatsSnapshot = {
  total_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  revenue: number;
  avg_delivery_min: number | null;
  on_time_rate: number | null;
  avg_rating: number | null;
  active_drivers: number;
  orders_per_hour: number | null;
  revenue_prev: number | null;
  orders_prev: number | null;
};

function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  color,
  delta,
  deltaLabel,
  pulse,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  delta?: number | null;
  deltaLabel?: string;
  pulse?: boolean;
}) {
  const deltaPositive = delta != null && delta > 0;
  const deltaNeutral = delta == null;
  return (
    <div className={cn(
      'rounded-xl border bg-white p-3 space-y-1.5',
      pulse && 'ring-2 ring-orange-400 animate-pulse',
    )}>
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">{label}</span>
        <Icon className={cn('h-3.5 w-3.5 shrink-0', color)} />
      </div>
      <div className={cn('text-xl font-black tabular-nums leading-none', color)}>{value}</div>
      {sub && <div className="text-[9px] text-muted-foreground">{sub}</div>}
      {delta != null && (
        <div className={cn(
          'flex items-center gap-1 text-[9px] font-bold',
          deltaPositive ? 'text-matcha-600' : delta < 0 ? 'text-red-500' : 'text-muted-foreground',
        )}>
          {deltaPositive ? <TrendingUp className="h-2.5 w-2.5" /> : delta < 0 ? <TrendingDown className="h-2.5 w-2.5" /> : null}
          {deltaLabel ?? (deltaPositive ? `+${delta.toFixed(1)}%` : `${delta.toFixed(1)}%`)}
          <span className="text-muted-foreground font-normal">vs. gestern</span>
        </div>
      )}
    </div>
  );
}

export function LieferdienstSchnellStatistikPanel({ locationId }: { locationId?: string | null }) {
  const [stats, setStats] = useState<StatsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const url = locationId
          ? `/api/delivery/admin/stats?location_id=${locationId}&period=today`
          : '/api/delivery/admin/stats?period=today';
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return;
        const d = await res.json();
        if (cancelled) return;
        setStats({
          total_orders: d.total_orders ?? d.bestellungen_heute ?? 0,
          delivered_orders: d.delivered_orders ?? d.geliefert_heute ?? 0,
          cancelled_orders: d.cancelled_orders ?? d.storniert_heute ?? 0,
          revenue: d.revenue ?? d.umsatz_heute ?? 0,
          avg_delivery_min: d.avg_delivery_min ?? d.avg_lieferzeit ?? null,
          on_time_rate: d.on_time_rate ?? d.puenktlichkeit ?? null,
          avg_rating: d.avg_rating ?? d.bewertung ?? null,
          active_drivers: d.active_drivers ?? d.fahrer_online ?? 0,
          orders_per_hour: d.orders_per_hour ?? null,
          revenue_prev: d.revenue_prev ?? d.umsatz_gestern ?? null,
          orders_prev: d.orders_prev ?? d.bestellungen_gestern ?? null,
        });
        setLastUpdate(new Date());
      } catch {}
      if (!cancelled) setLoading(false);
    }
    load();
    const iv = setInterval(load, 2 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  // Fallback mock data for display when API is empty
  const s = stats ?? {
    total_orders: 0,
    delivered_orders: 0,
    cancelled_orders: 0,
    revenue: 0,
    avg_delivery_min: null,
    on_time_rate: null,
    avg_rating: null,
    active_drivers: 0,
    orders_per_hour: null,
    revenue_prev: null,
    orders_prev: null,
  };

  const revenueFormatted = s.revenue > 0
    ? new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(s.revenue)
    : '—';

  const revenueDelta = s.revenue_prev != null && s.revenue_prev > 0
    ? ((s.revenue - s.revenue_prev) / s.revenue_prev) * 100
    : null;

  const ordersDelta = s.orders_prev != null && s.orders_prev > 0
    ? ((s.total_orders - s.orders_prev) / s.orders_prev) * 100
    : null;

  const deliveryRate = s.total_orders > 0
    ? Math.round((s.delivered_orders / s.total_orders) * 100)
    : null;

  const hasData = s.total_orders > 0 || s.revenue > 0;

  return (
    <div className="rounded-xl border bg-card p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2 flex-wrap">
        <BarChart3 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-sm font-bold">Schnell-Statistik Heute</span>
        <span className={cn(
          'rounded-full px-2 py-0.5 text-[10px] font-black',
          s.active_drivers > 0 ? 'bg-matcha-100 text-matcha-700' : 'bg-gray-100 text-gray-500',
        )}>
          {s.active_drivers} Fahrer online
        </span>
        <div className="ml-auto flex items-center gap-1 text-[9px] text-muted-foreground">
          <RefreshCw className="h-2.5 w-2.5" />
          {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile
          label="Umsatz Heute"
          value={revenueFormatted}
          icon={Euro}
          color="text-matcha-700"
          delta={revenueDelta}
        />
        <StatTile
          label="Bestellungen"
          value={String(s.total_orders)}
          sub={`${s.delivered_orders} geliefert · ${s.cancelled_orders} storniert`}
          icon={Package}
          color="text-blue-700"
          delta={ordersDelta}
        />
        <StatTile
          label="Ø Lieferzeit"
          value={s.avg_delivery_min != null ? `${Math.round(s.avg_delivery_min)} Min` : '—'}
          sub={s.on_time_rate != null ? `${Math.round(s.on_time_rate)}% pünktlich` : undefined}
          icon={Clock}
          color={
            s.avg_delivery_min == null ? 'text-muted-foreground' :
            s.avg_delivery_min <= 25 ? 'text-matcha-700' :
            s.avg_delivery_min <= 35 ? 'text-amber-700' : 'text-red-700'
          }
        />
        <StatTile
          label="Bewertung"
          value={s.avg_rating != null ? s.avg_rating.toFixed(1) : '—'}
          sub={s.avg_rating != null ? '★★★★☆ Durchschnitt' : 'Noch keine Bewertungen'}
          icon={Star}
          color={
            s.avg_rating == null ? 'text-muted-foreground' :
            s.avg_rating >= 4.5 ? 'text-matcha-700' :
            s.avg_rating >= 4.0 ? 'text-amber-700' : 'text-red-700'
          }
        />
        {s.orders_per_hour != null && (
          <StatTile
            label="Tempo (B/Std)"
            value={s.orders_per_hour.toFixed(1)}
            sub="Bestellungen je Stunde"
            icon={Zap}
            color="text-purple-700"
            pulse={s.orders_per_hour >= 10}
          />
        )}
        {deliveryRate != null && (
          <StatTile
            label="Lieferrate"
            value={`${deliveryRate}%`}
            icon={Target}
            color={deliveryRate >= 95 ? 'text-matcha-700' : deliveryRate >= 85 ? 'text-amber-700' : 'text-red-700'}
          />
        )}
      </div>

      {/* Insight Strip */}
      {hasData && (
        <div className="flex gap-2 overflow-x-auto pb-0.5">
          {s.on_time_rate != null && s.on_time_rate < 85 && (
            <div className="flex items-center gap-1.5 shrink-0 rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-[10px] font-bold">
              <AlertTriangle className="h-3 w-3" />
              Pünktlichkeit unter 85% — Fahrerzuweisung optimieren
            </div>
          )}
          {s.avg_delivery_min != null && s.avg_delivery_min > 35 && (
            <div className="flex items-center gap-1.5 shrink-0 rounded-full bg-red-100 text-red-700 px-3 py-1 text-[10px] font-bold">
              <Clock className="h-3 w-3" />
              Ø Lieferzeit über 35 Min — Kapazität prüfen
            </div>
          )}
          {s.cancelled_orders > 0 && s.total_orders > 0 &&
           (s.cancelled_orders / s.total_orders) > 0.1 && (
            <div className="flex items-center gap-1.5 shrink-0 rounded-full bg-red-100 text-red-700 px-3 py-1 text-[10px] font-bold">
              <AlertTriangle className="h-3 w-3" />
              Hohe Stornoquote ({Math.round(s.cancelled_orders / s.total_orders * 100)}%)
            </div>
          )}
          {s.on_time_rate != null && s.on_time_rate >= 95 && (
            <div className="flex items-center gap-1.5 shrink-0 rounded-full bg-matcha-100 text-matcha-700 px-3 py-1 text-[10px] font-bold">
              <CheckCircle2 className="h-3 w-3" />
              Exzellente Pünktlichkeit: {Math.round(s.on_time_rate)}%
            </div>
          )}
          {revenueDelta != null && revenueDelta > 10 && (
            <div className="flex items-center gap-1.5 shrink-0 rounded-full bg-matcha-100 text-matcha-700 px-3 py-1 text-[10px] font-bold">
              <TrendingUp className="h-3 w-3" />
              +{revenueDelta.toFixed(0)}% Umsatz vs. gestern
            </div>
          )}
        </div>
      )}

      {!hasData && !loading && (
        <div className="text-center text-sm text-muted-foreground py-4">
          Noch keine Daten für heute verfügbar
        </div>
      )}
    </div>
  );
}
