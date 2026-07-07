'use client';

import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import {
  BarChart3, TrendingUp, TrendingDown, Minus, Clock, Users, Euro,
  Target, CheckCircle2, AlertTriangle, RefreshCw, Loader2, Zap,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type HourBucket = { label: string; orders: number; revenue: number };
type ZoneRow = { zone: string; orders: number; avgMin: number; onTimePct: number };
type DriverRow = { name: string; deliveries: number; avgMin: number };

type Stats = {
  totalOrders: number;
  totalRevenue: number;
  deliveries: number;
  avgDeliveryMin: number;
  onTimeRatePct: number;
  activeDrivers: number;
  pendingOrders: number;
  hourBuckets: HourBucket[];
  zones: ZoneRow[];
  drivers: DriverRow[];
};

function Kpi({
  label, value, sub, trend, color,
}: {
  label: string; value: string; sub?: string;
  trend?: 'up' | 'down' | 'neutral'; color?: string;
}) {
  const Icon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const tc = trend === 'up' ? 'text-matcha-600' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground';
  return (
    <div className={`rounded-xl p-3 border bg-white ${color ? `border-l-4 ${color}` : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
        {trend && <Icon className={`h-3 w-3 ${tc}`} />}
      </div>
      <div className="mt-1 text-xl font-black tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function LieferdienstPhase505SchichtStatistikenDashboard({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<number>(Date.now());
  const supabase = createClient();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();

      let ordersQ = supabase
        .from('customer_orders')
        .select('id, gesamtbetrag, status, bestellt_am, geliefert_am, delivery_zone, location_id')
        .gte('bestellt_am', todayStr);
      if (locationId) ordersQ = ordersQ.eq('location_id', locationId);

      const { data: orders } = await ordersQ;
      if (!orders) return;

      const totalOrders = orders.length;
      const totalRevenue = orders.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);

      const delivered = orders.filter((o) =>
        ['geliefert', 'abgeholt', 'abgeschlossen'].includes(o.status),
      );

      let totalDelivMin = 0;
      let onTimeCount = 0;
      for (const o of delivered) {
        if (o.bestellt_am && o.geliefert_am) {
          const diffMin = (new Date(o.geliefert_am).getTime() - new Date(o.bestellt_am).getTime()) / 60_000;
          totalDelivMin += diffMin;
          if (diffMin <= 45) onTimeCount++;
        }
      }
      const avgDeliveryMin = delivered.length > 0 ? Math.round(totalDelivMin / delivered.length) : 0;
      const onTimeRatePct = delivered.length > 0 ? Math.round((onTimeCount / delivered.length) * 100) : 0;
      const pendingOrders = orders.filter((o) => ['neu', 'bestätigt', 'in_zubereitung', 'fertig'].includes(o.status)).length;

      // Hourly buckets
      const nowH = new Date().getHours();
      const hourMap: Record<number, { orders: number; revenue: number }> = {};
      for (const o of orders) {
        if (!o.bestellt_am) continue;
        const h = new Date(o.bestellt_am).getHours();
        if (!hourMap[h]) hourMap[h] = { orders: 0, revenue: 0 };
        hourMap[h].orders++;
        hourMap[h].revenue += o.gesamtbetrag ?? 0;
      }
      const hourBuckets: HourBucket[] = [];
      for (let h = 10; h <= Math.max(nowH, 22); h++) {
        hourBuckets.push({
          label: `${h}h`,
          orders: hourMap[h]?.orders ?? 0,
          revenue: hourMap[h]?.revenue ?? 0,
        });
      }

      // Zone stats
      const zoneMap: Record<string, { orders: number; delivMin: number; delivCount: number; onTime: number }> = {};
      for (const o of orders) {
        const z = o.delivery_zone ?? 'Unbekannt';
        if (!zoneMap[z]) zoneMap[z] = { orders: 0, delivMin: 0, delivCount: 0, onTime: 0 };
        zoneMap[z].orders++;
        if (['geliefert', 'abgeholt', 'abgeschlossen'].includes(o.status) && o.bestellt_am && o.geliefert_am) {
          const diff = (new Date(o.geliefert_am).getTime() - new Date(o.bestellt_am).getTime()) / 60_000;
          zoneMap[z].delivMin += diff;
          zoneMap[z].delivCount++;
          if (diff <= 45) zoneMap[z].onTime++;
        }
      }
      const zones: ZoneRow[] = Object.entries(zoneMap)
        .map(([zone, v]) => ({
          zone,
          orders: v.orders,
          avgMin: v.delivCount > 0 ? Math.round(v.delivMin / v.delivCount) : 0,
          onTimePct: v.delivCount > 0 ? Math.round((v.onTime / v.delivCount) * 100) : 0,
        }))
        .sort((a, b) => b.orders - a.orders)
        .slice(0, 5);

      // Active drivers (mock — from delivery_driver_status)
      let activeDrivers = 0;
      try {
        let dQ = supabase.from('delivery_driver_status').select('id', { count: 'exact', head: true }).eq('ist_online', true);
        if (locationId) dQ = dQ.eq('location_id', locationId);
        const { count } = await dQ;
        activeDrivers = count ?? 0;
      } catch (_) {}

      setStats({
        totalOrders,
        totalRevenue,
        deliveries: delivered.length,
        avgDeliveryMin,
        onTimeRatePct,
        activeDrivers,
        pendingOrders,
        hourBuckets,
        zones,
        drivers: [],
      });
      setLastRefresh(Date.now());
    } catch (_) {
    } finally {
      setLoading(false);
    }
  }, [locationId, supabase]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]);

  const fmtEur = (v: number) =>
    v >= 1000
      ? `${(v / 1000).toFixed(1)}k €`
      : `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  if (loading && !stats) {
    return (
      <div className="rounded-2xl border bg-white p-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Statistiken werden geladen…
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b bg-matcha-50">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-matcha-600 text-white">
          <BarChart3 className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-foreground">Schicht Statistiken · Live</div>
          <div className="text-[10px] text-muted-foreground">
            Phase 505 · Stand: {fmtTime(new Date(lastRefresh))}
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg border border-matcha-300 bg-white px-2.5 py-1.5 text-[10px] font-bold text-matcha-700 hover:bg-matcha-50 transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          Aktualisieren
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Kpi
            label="Bestellungen"
            value={stats.totalOrders.toString()}
            sub={`${stats.pendingOrders} offen`}
            color="border-blue-400"
          />
          <Kpi
            label="Umsatz"
            value={fmtEur(stats.totalRevenue)}
            color="border-matcha-500"
          />
          <Kpi
            label="Lieferungen"
            value={stats.deliveries.toString()}
            sub="heute"
            color="border-emerald-400"
          />
          <Kpi
            label="Ø Lieferzeit"
            value={stats.avgDeliveryMin > 0 ? `${stats.avgDeliveryMin} Min` : '—'}
            trend={stats.avgDeliveryMin > 0 && stats.avgDeliveryMin <= 35 ? 'up' : stats.avgDeliveryMin > 45 ? 'down' : 'neutral'}
            color="border-amber-400"
          />
          <Kpi
            label="Pünktlichkeit"
            value={stats.onTimeRatePct > 0 ? `${stats.onTimeRatePct}%` : '—'}
            trend={stats.onTimeRatePct >= 85 ? 'up' : stats.onTimeRatePct < 70 ? 'down' : 'neutral'}
            color="border-purple-400"
          />
          <Kpi
            label="Fahrer online"
            value={stats.activeDrivers.toString()}
            color="border-cyan-400"
          />
        </div>

        {/* Hourly Chart */}
        {stats.hourBuckets.length > 0 && (
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Bestellungen je Stunde
            </div>
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.hourBuckets} barCategoryGap="25%">
                  <XAxis dataKey="label" tick={{ fontSize: 8 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: number, name: string) => [
                      name === 'orders' ? `${v} Bestellungen` : `${v.toLocaleString('de-DE')} €`,
                    ]}
                    contentStyle={{ fontSize: 10 }}
                  />
                  <Bar dataKey="orders" radius={[3, 3, 0, 0]}>
                    {stats.hourBuckets.map((b, i) => (
                      <Cell
                        key={i}
                        fill={
                          b.orders >= 10 ? '#16a34a' :
                          b.orders >= 5 ? '#ca8a04' :
                          '#94a3b8'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Zone Breakdown */}
        {stats.zones.length > 0 && (
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Zonen-Performance
            </div>
            <div className="space-y-1.5">
              {stats.zones.map((z) => (
                <div key={z.zone} className="flex items-center gap-2">
                  <span className="w-14 shrink-0 text-[10px] font-semibold text-foreground truncate">
                    {z.zone}
                  </span>
                  <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        z.onTimePct >= 85 ? 'bg-matcha-500' :
                        z.onTimePct >= 70 ? 'bg-amber-400' : 'bg-red-400'
                      }`}
                      style={{ width: `${z.onTimePct}%` }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-[10px] font-bold tabular-nums">
                    {z.onTimePct}%
                  </span>
                  <span className="w-16 shrink-0 text-right text-[9px] text-muted-foreground tabular-nums">
                    {z.orders} Best. · {z.avgMin > 0 ? `${z.avgMin}m` : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Summary Footer */}
        <div className="flex items-center gap-3 rounded-xl bg-matcha-50 border border-matcha-100 px-4 py-3">
          {stats.onTimeRatePct >= 85 ? (
            <CheckCircle2 className="h-4 w-4 text-matcha-600 shrink-0" />
          ) : stats.onTimeRatePct >= 70 ? (
            <Zap className="h-4 w-4 text-amber-500 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          )}
          <span className="text-xs font-medium text-foreground">
            {stats.onTimeRatePct >= 85
              ? 'Sehr gute Schicht-Performance — weiter so!'
              : stats.onTimeRatePct >= 70
              ? 'Durchschnittliche Performance — Optimierung möglich.'
              : 'Pünktlichkeit unter Ziel — sofortige Maßnahmen empfohlen.'}
          </span>
          <span className="ml-auto text-[10px] font-bold tabular-nums text-matcha-700">
            SLA {stats.onTimeRatePct}%
          </span>
        </div>
      </div>
    </div>
  );
}
