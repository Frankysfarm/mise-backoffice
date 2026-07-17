'use client';

import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Package, Clock, Star, Euro, Truck, AlertTriangle } from 'lucide-react';
import { cn, euro } from '@/lib/utils';

/**
 * Phase 2010 — Statistiken-Tages-Zusammenfassung
 *
 * Kompaktes Tages-Dashboard mit:
 * - 6 Echtzeit-KPIs (Umsatz, Bestellungen, Ø-Lieferzeit, Pünktlichkeit, Bewertung, Storno-Quote)
 * - Mini-Stundenbalken-Chart (Bestellungen je Stunde heute)
 * - Trend-Pfeile vs. gleicher Wochentag letzte Woche
 * - Alert-Row: SLA-Breach, hohe Storno-Quote, fehlende Fahrer
 *
 * Polling alle 2 Minuten über /api/delivery/admin/live-metriken.
 */

interface DayMetrics {
  totalRevenue: number;
  orderCount: number;
  avgDeliveryMin: number;
  onTimePct: number;
  avgRating: number;
  cancellationPct: number;
  activeDrivers: number;
  hourlyOrders: { h: number; label: string; orders: number }[];
  vsLastWeek?: {
    revenueDelta: number;
    ordersDelta: number;
    onTimeDelta: number;
  };
  alerts?: string[];
}

type Trend = 'up' | 'down' | 'flat';

function trend(delta: number | undefined, higherIsBetter = true): Trend {
  if (delta === undefined || Math.abs(delta) < 2) return 'flat';
  if (delta > 0) return higherIsBetter ? 'up' : 'down';
  return higherIsBetter ? 'down' : 'up';
}

function TrendIcon({ t }: { t: Trend }) {
  if (t === 'up') return <TrendingUp className="h-3 w-3 text-matcha-600" />;
  if (t === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

interface Props {
  locationId: string | null;
}

export function LieferdienstPhase2010StatistikTagesZusammenfassung({ locationId }: Props) {
  const [data, setData] = useState<DayMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    const load = () => {
      setLoading(true);
      fetch(`/api/delivery/admin/live-metriken?location_id=${locationId}`)
        .then((r) => r.ok ? r.json() : null)
        .then((d) => {
          if (!d) return;
          const hourly: { h: number; label: string; orders: number }[] = [];
          if (Array.isArray(d.hourlyOrders)) {
            for (const row of d.hourlyOrders) {
              hourly.push({ h: row.h ?? row.hour ?? 0, label: row.label ?? `${row.h ?? row.hour}:00`, orders: row.orders ?? row.count ?? 0 });
            }
          }
          setData({
            totalRevenue: d.totalRevenue ?? d.revenue ?? 0,
            orderCount: d.orderCount ?? d.orders ?? 0,
            avgDeliveryMin: d.avgDeliveryMin ?? d.avg_delivery_min ?? 0,
            onTimePct: d.onTimePct ?? d.on_time_pct ?? 0,
            avgRating: d.avgRating ?? d.avg_rating ?? 0,
            cancellationPct: d.cancellationPct ?? d.cancellation_pct ?? 0,
            activeDrivers: d.activeDrivers ?? d.active_drivers ?? 0,
            hourlyOrders: hourly,
            vsLastWeek: d.vsLastWeek ?? undefined,
            alerts: Array.isArray(d.alerts) ? d.alerts : undefined,
          });
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    };
    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!locationId) return null;

  const kpis = data
    ? [
        {
          icon: Euro,
          label: 'Umsatz heute',
          value: euro(data.totalRevenue),
          t: trend(data.vsLastWeek?.revenueDelta, true),
          delta: data.vsLastWeek?.revenueDelta,
          color: 'text-emerald-700',
          bg: 'bg-emerald-50',
        },
        {
          icon: Package,
          label: 'Bestellungen',
          value: data.orderCount.toString(),
          t: trend(data.vsLastWeek?.ordersDelta, true),
          delta: data.vsLastWeek?.ordersDelta,
          color: 'text-blue-700',
          bg: 'bg-blue-50',
        },
        {
          icon: Clock,
          label: 'Ø Lieferzeit',
          value: `${Math.round(data.avgDeliveryMin)} Min`,
          t: trend(data.avgDeliveryMin > 30 ? -5 : 5, true),
          delta: undefined,
          color: data.avgDeliveryMin > 35 ? 'text-red-700' : data.avgDeliveryMin > 28 ? 'text-amber-700' : 'text-matcha-700',
          bg: data.avgDeliveryMin > 35 ? 'bg-red-50' : data.avgDeliveryMin > 28 ? 'bg-amber-50' : 'bg-matcha-50',
        },
        {
          icon: Truck,
          label: 'Pünktlichkeit',
          value: `${Math.round(data.onTimePct)}%`,
          t: trend(data.vsLastWeek?.onTimeDelta, true),
          delta: data.vsLastWeek?.onTimeDelta,
          color: data.onTimePct < 70 ? 'text-red-700' : data.onTimePct < 85 ? 'text-amber-700' : 'text-matcha-700',
          bg: data.onTimePct < 70 ? 'bg-red-50' : data.onTimePct < 85 ? 'bg-amber-50' : 'bg-matcha-50',
        },
        {
          icon: Star,
          label: 'Ø Bewertung',
          value: data.avgRating > 0 ? data.avgRating.toFixed(1) : '–',
          t: 'flat' as Trend,
          delta: undefined,
          color: data.avgRating >= 4.5 ? 'text-matcha-700' : data.avgRating >= 4.0 ? 'text-amber-700' : 'text-red-700',
          bg: 'bg-amber-50',
        },
        {
          icon: AlertTriangle,
          label: 'Stornoquote',
          value: `${data.cancellationPct.toFixed(1)}%`,
          t: trend(data.cancellationPct > 5 ? -5 : 5, false),
          delta: undefined,
          color: data.cancellationPct > 8 ? 'text-red-700' : data.cancellationPct > 5 ? 'text-amber-700' : 'text-matcha-700',
          bg: data.cancellationPct > 8 ? 'bg-red-50' : 'bg-amber-50',
        },
      ]
    : [];

  const maxOrders = data ? Math.max(1, ...data.hourlyOrders.map((h) => h.orders)) : 1;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-muted/30 transition border-b"
      >
        <TrendingUp className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">
          Tages-Statistiken Zusammenfassung
        </span>
        {data && (
          <span className="text-[10px] text-muted-foreground">
            {data.activeDrivers} Fahrer aktiv
          </span>
        )}
        <span className="text-[10px] text-muted-foreground ml-1">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="p-4 space-y-4">
          {loading && !data && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />
              ))}
            </div>
          )}

          {/* KPI Grid */}
          {kpis.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {kpis.map((kpi) => (
                <div key={kpi.label} className={cn('rounded-xl p-2.5', kpi.bg)}>
                  <div className="flex items-center gap-1 mb-0.5">
                    <kpi.icon className={cn('h-3 w-3', kpi.color)} />
                    <TrendIcon t={kpi.t} />
                  </div>
                  <div className={cn('text-sm font-black tabular-nums leading-tight', kpi.color)}>
                    {kpi.value}
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight">{kpi.label}</div>
                  {kpi.delta !== undefined && Math.abs(kpi.delta) >= 2 && (
                    <div className={cn('text-[9px] font-bold', kpi.delta > 0 ? 'text-matcha-600' : 'text-red-600')}>
                      {kpi.delta > 0 ? '+' : ''}{Math.round(kpi.delta)}% vs. VW
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Stundenbalken */}
          {data && data.hourlyOrders.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5">
                Bestellungen je Stunde
              </div>
              <ResponsiveContainer width="100%" height={56}>
                <BarChart data={data.hourlyOrders} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="label" tick={{ fontSize: 8 }} interval={1} />
                  <Tooltip
                    formatter={(v) => [`${(v as number) ?? 0} Bestellungen`, '']}
                    contentStyle={{ fontSize: '10px' }}
                  />
                  <Bar dataKey="orders" radius={[2, 2, 0, 0]}>
                    {data.hourlyOrders.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={
                          entry.orders >= maxOrders * 0.8 ? '#16a34a'
                          : entry.orders >= maxOrders * 0.5 ? '#4ade80'
                          : '#86efac'
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Alerts */}
          {data?.alerts && data.alerts.length > 0 && (
            <div className="space-y-1">
              {data.alerts.map((alert, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                  <span className="text-[11px] text-amber-700 font-medium">{alert}</span>
                </div>
              ))}
            </div>
          )}

          {!data && !loading && (
            <div className="text-sm text-muted-foreground text-center py-2">
              Bitte Filiale auswählen.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
