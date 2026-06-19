'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  TrendingUp, TrendingDown, Clock, Package, Truck, Euro, Users,
  BarChart3, CheckCircle2, AlertTriangle, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface OrderRow {
  status: string;
  typ: string | null;
  gesamtbetrag: number | null;
  bestellt_am: string | null;
  fertig_am: string | null;
  geschaetzte_zubereitung_min: number | null;
}

interface ShiftKPI {
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  avgPrepMin: number | null;
  avgDeliveryMin: number | null;
  revenue: number;
  onTimeRate: number;
  deliveryOrders: number;
  takeawayOrders: number;
  dineInOrders: number;
  hourlyData: { hour: string; orders: number; revenue: number }[];
  peakHour: string | null;
}

const HOUR_COLORS = ['#6b9e3c', '#4d8c2a', '#3a7a1e', '#8cb84e', '#a8cc6e', '#c3de8e'];

export function SchichtKennzahlenCockpit({ locationId }: { locationId: string }) {
  const [kpi, setKpi] = useState<ShiftKPI | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    const load = async () => {
      setLoading(true);
      try {
        const { data: orders } = await supabase
          .from('customer_orders')
          .select('status, typ, gesamtbetrag, bestellt_am, fertig_am, geschaetzte_zubereitung_min')
          .gte('bestellt_am', todayIso)
          .eq('location_id', locationId);

        if (!orders) { setLoading(false); return; }

        const typedOrders = orders as OrderRow[];

        const completed = typedOrders.filter((o) =>
          ['fertig', 'geliefert', 'abgeholt', 'abgeschlossen'].includes(o.status),
        );
        const cancelled = typedOrders.filter((o) =>
          ['storniert', 'abgebrochen'].includes(o.status),
        );

        const revenue = completed.reduce((s, o) => s + (o.gesamtbetrag ?? 0), 0);

        const prepTimes = completed
          .filter((o) => o.geschaetzte_zubereitung_min)
          .map((o) => o.geschaetzte_zubereitung_min as number);
        const avgPrepMin = prepTimes.length
          ? Math.round(prepTimes.reduce((s, v) => s + v, 0) / prepTimes.length)
          : null;

        const deliveryMins = completed
          .filter((o) => o.bestellt_am && o.fertig_am)
          .map((o) => {
            const diff = new Date(o.fertig_am!).getTime() - new Date(o.bestellt_am!).getTime();
            return Math.floor(diff / 60_000);
          })
          .filter((m) => m > 0 && m < 120);
        const avgDeliveryMin = deliveryMins.length
          ? Math.round(deliveryMins.reduce((s, v) => s + v, 0) / deliveryMins.length)
          : null;

        const onTimeCount = completed.filter((o) => {
          if (!o.bestellt_am || !o.fertig_am || !o.geschaetzte_zubereitung_min) return false;
          const actual = (new Date(o.fertig_am).getTime() - new Date(o.bestellt_am).getTime()) / 60_000;
          return actual <= o.geschaetzte_zubereitung_min * 1.1;
        }).length;
        const onTimeRate = completed.length > 0
          ? Math.round((onTimeCount / completed.length) * 100)
          : 0;

        // Hourly breakdown
        const hourMap = new Map<string, { orders: number; revenue: number }>();
        for (const o of completed) {
          if (!o.bestellt_am) continue;
          const h = new Date(o.bestellt_am).getHours();
          const key = `${h}:00`;
          const prev = hourMap.get(key) ?? { orders: 0, revenue: 0 };
          hourMap.set(key, {
            orders: prev.orders + 1,
            revenue: prev.revenue + (o.gesamtbetrag ?? 0),
          });
        }
        const hourlyData = Array.from(hourMap.entries())
          .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
          .map(([hour, v]) => ({ hour, ...v }));

        const peakHour = hourlyData.length
          ? hourlyData.reduce((max, h) => h.orders > max.orders ? h : max).hour
          : null;

        setKpi({
          totalOrders: typedOrders.length,
          completedOrders: completed.length,
          cancelledOrders: cancelled.length,
          avgPrepMin,
          avgDeliveryMin,
          revenue,
          onTimeRate,
          deliveryOrders: typedOrders.filter((o) => o.typ === 'lieferung').length,
          takeawayOrders: typedOrders.filter((o) => o.typ === 'abholung').length,
          dineInOrders: typedOrders.filter((o) => o.typ === 'vor_ort').length,
          hourlyData,
          peakHour,
        });
      } catch {}
      finally { setLoading(false); }
    };

    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const fmtEur = (v: number) =>
    v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5 animate-pulse">
        <div className="h-4 w-48 bg-stone-100 rounded mb-4" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-stone-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!kpi) return null;

  const completionRate = kpi.totalOrders > 0
    ? Math.round((kpi.completedOrders / kpi.totalOrders) * 100)
    : 0;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 border-b border-stone-100 hover:bg-stone-50 transition text-left"
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100">
          <BarChart3 className="h-4 w-4 text-matcha-700" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-stone-800">Schicht-Kennzahlen</div>
          <div className="text-[10px] text-stone-400">
            {kpi.completedOrders} abgeschlossen · {fmtEur(kpi.revenue)} Umsatz
          </div>
        </div>
        <span className="text-stone-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-5 py-4 space-y-5">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              {
                label: 'Gesamt',
                value: kpi.totalOrders.toString(),
                sub: `${kpi.completedOrders} fertig`,
                icon: Package,
                color: 'text-stone-700',
                bg: 'bg-stone-50',
              },
              {
                label: 'Umsatz',
                value: fmtEur(kpi.revenue),
                sub: `${kpi.deliveryOrders} Lieferungen`,
                icon: Euro,
                color: 'text-emerald-700',
                bg: 'bg-emerald-50',
              },
              {
                label: 'Pünktlichkeit',
                value: `${kpi.onTimeRate}%`,
                sub: kpi.onTimeRate >= 80 ? 'Sehr gut' : kpi.onTimeRate >= 60 ? 'OK' : 'Verbesserbar',
                icon: kpi.onTimeRate >= 80 ? CheckCircle2 : AlertTriangle,
                color: kpi.onTimeRate >= 80 ? 'text-matcha-700' : kpi.onTimeRate >= 60 ? 'text-amber-700' : 'text-red-700',
                bg: kpi.onTimeRate >= 80 ? 'bg-matcha-50' : kpi.onTimeRate >= 60 ? 'bg-amber-50' : 'bg-red-50',
              },
              {
                label: 'Ø Lieferzeit',
                value: kpi.avgDeliveryMin ? `${kpi.avgDeliveryMin} Min` : '—',
                sub: kpi.avgPrepMin ? `Zubereitung: ${kpi.avgPrepMin} Min` : 'Zubereitung: —',
                icon: Clock,
                color: 'text-blue-700',
                bg: 'bg-blue-50',
              },
            ].map((kpiItem) => {
              const Icon = kpiItem.icon;
              return (
                <div key={kpiItem.label} className={cn('rounded-xl p-3.5', kpiItem.bg)}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-black uppercase tracking-wider text-stone-500">
                      {kpiItem.label}
                    </span>
                    <Icon className={cn('h-3.5 w-3.5', kpiItem.color)} />
                  </div>
                  <div className={cn('text-xl font-black tabular-nums leading-tight', kpiItem.color)}>
                    {kpiItem.value}
                  </div>
                  <div className="text-[10px] text-stone-400 mt-0.5">{kpiItem.sub}</div>
                </div>
              );
            })}
          </div>

          {/* Order type breakdown */}
          <div>
            <div className="text-[10px] font-black uppercase tracking-wider text-stone-400 mb-2">
              Bestellungstypen
            </div>
            <div className="flex gap-2">
              {[
                { label: 'Lieferung', count: kpi.deliveryOrders, color: 'bg-matcha-500', icon: Truck },
                { label: 'Abholung', count: kpi.takeawayOrders, color: 'bg-blue-400', icon: Package },
                { label: 'Vor Ort', count: kpi.dineInOrders, color: 'bg-amber-400', icon: Users },
              ].map(({ label, count, color, icon: Icon }) => {
                const pct = kpi.totalOrders > 0
                  ? Math.round((count / kpi.totalOrders) * 100)
                  : 0;
                return (
                  <div key={label} className="flex-1 rounded-xl bg-stone-50 border border-stone-100 p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <div className={cn('h-2 w-2 rounded-full', color)} />
                      <span className="text-[10px] font-bold text-stone-600">{label}</span>
                    </div>
                    <div className="text-lg font-black text-stone-800">{count}</div>
                    <div className="mt-1.5 h-1 bg-stone-200 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', color)}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-stone-400 mt-0.5">{pct}%</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hourly chart */}
          {kpi.hourlyData.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-stone-400">
                  Stündliche Verteilung
                </div>
                {kpi.peakHour && (
                  <div className="flex items-center gap-1">
                    <Zap className="h-3 w-3 text-amber-500" />
                    <span className="text-[10px] font-bold text-amber-600">
                      Peak: {kpi.peakHour}
                    </span>
                  </div>
                )}
              </div>
              <div className="h-28">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={kpi.hourlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <XAxis
                      dataKey="hour"
                      tick={{ fontSize: 9, fill: '#78716c' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid #e7e5e4' }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(val: any) => [`${val ?? 0} Bestellungen`, 'Bestellungen'] as [string, string]}
                    />
                    <Bar dataKey="orders" radius={[3, 3, 0, 0]}>
                      {kpi.hourlyData.map((h, i) => (
                        <Cell
                          key={h.hour}
                          fill={h.hour === kpi.peakHour ? '#f59e0b' : HOUR_COLORS[i % HOUR_COLORS.length]}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Completion rate */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-stone-400">
                Abschlussrate
              </span>
              <span className={cn(
                'text-[11px] font-black',
                completionRate >= 90 ? 'text-matcha-600' : completionRate >= 70 ? 'text-amber-600' : 'text-red-600',
              )}>
                {completionRate}%
              </span>
            </div>
            <div className="h-2.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all',
                  completionRate >= 90 ? 'bg-matcha-500' : completionRate >= 70 ? 'bg-amber-400' : 'bg-red-500',
                )}
                style={{ width: `${completionRate}%` }}
              />
            </div>
            {kpi.cancelledOrders > 0 && (
              <div className="mt-1 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-red-400" />
                <span className="text-[9px] text-red-500">{kpi.cancelledOrders} storniert</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
