'use client';

/**
 * ExecutiveKpiBanner
 * Schmal, immer sichtbarer Top-Banner mit den 5 wichtigsten Live-Metriken.
 * Holt Daten alle 60 Sekunden von /api/delivery/stats.
 */

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, Minus,
  Bike, Clock, Target, Star, Package,
  Activity, RefreshCw, Euro,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Kpi {
  orders_today: number;
  delivered_today: number;
  active_drivers: number;
  avg_delivery_min: number | null;
  on_time_pct: number | null;
  pending_orders: number;
  revenue_today: number | null;
}

function TrendIcon({ v, prev }: { v: number; prev: number | null }) {
  if (prev === null) return <Minus className="h-3 w-3 text-gray-400" />;
  if (v > prev) return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  if (v < prev) return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-gray-400" />;
}

function Karte({
  label, value, sub, icon: Icon, accent, trend, prevValue,
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; accent: string;
  trend?: number; prevValue?: number | null;
}) {
  return (
    <div className={cn('flex items-center gap-3 rounded-xl border-l-4 bg-white px-3 py-2.5 shadow-sm', accent)}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-current/10">
        <Icon className="h-4 w-4 text-inherit" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
          {label}
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-display text-lg font-black leading-none tabular-nums text-gray-900">
            {value}
          </span>
          {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
        </div>
      </div>
      {trend !== undefined && prevValue !== undefined && (
        <TrendIcon v={trend} prev={prevValue ?? null} />
      )}
    </div>
  );
}

interface Props {
  locationId?: string | null;
}

export function ExecutiveKpiBanner({ locationId }: Props) {
  const supabase = createClient();
  const [kpi, setKpi] = useState<Kpi | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    try {
      let q = supabase
        .from('customer_orders')
        .select('id, status, gesamtbetrag, bestellt_am, fertig_am, geliefert_am, typ')
        .gte('bestellt_am', todayIso);

      if (locationId) {
        q = q.eq('location_id', locationId);
      }

      const { data: orders } = await q;
      if (!orders) return;

      const todayOrders = orders as {
        id: string; status: string; gesamtbetrag: number;
        bestellt_am: string | null; fertig_am: string | null; geliefert_am: string | null; typ: string;
      }[];

      const delivered = todayOrders.filter(o => ['geliefert', 'abgeholt', 'abgeschlossen'].includes(o.status));
      const pending = todayOrders.filter(o => ['neu', 'bestätigt', 'in_zubereitung', 'fertig', 'unterwegs'].includes(o.status));

      // Avg delivery time
      const withTimes = delivered.filter(o => o.bestellt_am && o.geliefert_am);
      const avgMin = withTimes.length > 0
        ? Math.round(withTimes.reduce((acc, o) => {
            const ms = new Date(o.geliefert_am!).getTime() - new Date(o.bestellt_am!).getTime();
            return acc + ms / 60_000;
          }, 0) / withTimes.length)
        : null;

      // On-time: delivered within estimated time + 5 min
      const onTime = withTimes.filter(o => {
        const ms = new Date(o.geliefert_am!).getTime() - new Date(o.bestellt_am!).getTime();
        return ms / 60_000 <= 45;
      });
      const onTimePct = withTimes.length > 0 ? Math.round((onTime.length / withTimes.length) * 100) : null;

      // Revenue
      const revenue = todayOrders.reduce((acc, o) => acc + (o.gesamtbetrag ?? 0), 0);

      // Active drivers
      const { count: driverCount } = await supabase
        .from('driver_status')
        .select('id', { count: 'exact', head: true })
        .eq('ist_online', true);

      setKpi({
        orders_today: todayOrders.length,
        delivered_today: delivered.length,
        active_drivers: driverCount ?? 0,
        avg_delivery_min: avgMin,
        on_time_pct: onTimePct,
        pending_orders: pending.length,
        revenue_today: revenue,
      });
      setLastRefresh(new Date());
    } catch (err) {
      console.error('ExecutiveKpiBanner load error', err);
    } finally {
      setLoading(false);
    }
  }, [locationId, supabase]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]);

  if (loading && !kpi) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-muted/30 px-4 py-3 text-sm text-muted-foreground animate-pulse">
        <RefreshCw className="h-4 w-4 animate-spin" />
        KPI werden geladen…
      </div>
    );
  }

  if (!kpi) return null;

  const formatEuro = (v: number) => `${v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`;

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
        <Karte
          label="Bestellungen Heute"
          value={kpi.orders_today}
          icon={Package}
          accent="border-l-matcha-500"
        />
        <Karte
          label="Geliefert"
          value={kpi.delivered_today}
          sub={`/ ${kpi.orders_today}`}
          icon={Target}
          accent="border-l-emerald-500"
        />
        <Karte
          label="Ausstehend"
          value={kpi.pending_orders}
          icon={Clock}
          accent={kpi.pending_orders > 10 ? 'border-l-red-500' : kpi.pending_orders > 5 ? 'border-l-amber-500' : 'border-l-blue-500'}
        />
        <Karte
          label="Aktive Fahrer"
          value={kpi.active_drivers}
          icon={Bike}
          accent="border-l-blue-500"
        />
        <Karte
          label="Ø Lieferzeit"
          value={kpi.avg_delivery_min !== null ? `${kpi.avg_delivery_min}` : '—'}
          sub="Min"
          icon={Clock}
          accent={kpi.avg_delivery_min !== null && kpi.avg_delivery_min <= 35 ? 'border-l-emerald-500' : 'border-l-amber-500'}
        />
        <Karte
          label="Pünktlichkeit"
          value={kpi.on_time_pct !== null ? `${kpi.on_time_pct}%` : '—'}
          icon={Star}
          accent={kpi.on_time_pct !== null && kpi.on_time_pct >= 80 ? 'border-l-emerald-500' : 'border-l-red-500'}
        />
        {kpi.revenue_today !== null && (
          <Karte
            label="Umsatz Heute"
            value={formatEuro(kpi.revenue_today)}
            icon={Euro}
            accent="border-l-gold"
          />
        )}
      </div>

      {lastRefresh && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Activity size={9} />
          Zuletzt aktualisiert: {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      )}
    </div>
  );
}
