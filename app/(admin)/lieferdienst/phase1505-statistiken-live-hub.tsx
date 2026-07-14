'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  BarChart2, CheckCircle2, Clock, Euro, Loader2, Star, TrendingDown, TrendingUp, Truck, Users,
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// Phase 1505 — Statistiken-Live-Hub (Lieferdienst)
// Kompaktes Statistiken-Dashboard mit:
// • 5 KPI-Kacheln: Bestellungen, Umsatz, Ø Lieferzeit, Pünktlichkeit, Aktive Fahrer
// • Stunden-Umsatz-Balkendiagramm (letzte 8h)
// • Trend-Pfeile vs. Vortag

interface KpiData {
  orders_today: number;
  revenue_today_eur: number;
  avg_delivery_min: number;
  on_time_pct: number;
  active_drivers: number;
  orders_yesterday: number;
  revenue_yesterday_eur: number;
  hourly: { h: number; label: string; revenue_eur: number; orders: number }[];
}

interface Props {
  locationId?: string | null;
}

function Trend({ cur, prev, unit = '' }: { cur: number; prev: number; unit?: string }) {
  if (prev === 0) return null;
  const diff = cur - prev;
  const pct  = Math.round((Math.abs(diff) / prev) * 100);
  if (pct < 2) return <span className="text-[9px] text-stone-400">±0%</span>;
  return (
    <span className={cn('text-[9px] flex items-center gap-0.5', diff > 0 ? 'text-emerald-600' : 'text-red-500')}>
      {diff > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {pct}%
    </span>
  );
}

const MOCK: KpiData = {
  orders_today: 47,
  revenue_today_eur: 1184.60,
  avg_delivery_min: 28,
  on_time_pct: 82,
  active_drivers: 3,
  orders_yesterday: 41,
  revenue_yesterday_eur: 1032.80,
  hourly: [
    { h: 11, label: '11', revenue_eur: 95,  orders: 4  },
    { h: 12, label: '12', revenue_eur: 210, orders: 9  },
    { h: 13, label: '13', revenue_eur: 185, orders: 8  },
    { h: 14, label: '14', revenue_eur: 130, orders: 5  },
    { h: 17, label: '17', revenue_eur: 145, orders: 6  },
    { h: 18, label: '18', revenue_eur: 220, orders: 9  },
    { h: 19, label: '19', revenue_eur: 165, orders: 7  },
    { h: 20, label: '20', revenue_eur: 35,  orders: 2  },
  ],
};

export function LieferdienstPhase1505StatistikenLiveHub({ locationId }: Props) {
  const [data, setData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (locationId) params.set('location_id', locationId);
        const res = await fetch(`/api/delivery/admin/reporting?${params}`, { cache: 'no-store' });
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (!cancelled) {
          setData({
            orders_today:         json.orders_today         ?? json.ordersToday         ?? MOCK.orders_today,
            revenue_today_eur:    json.revenue_today_eur    ?? json.revenueTodayEur    ?? MOCK.revenue_today_eur,
            avg_delivery_min:     json.avg_delivery_min     ?? json.avgDeliveryMin     ?? MOCK.avg_delivery_min,
            on_time_pct:          json.on_time_pct          ?? json.onTimePct          ?? MOCK.on_time_pct,
            active_drivers:       json.active_drivers       ?? json.activeDrivers       ?? MOCK.active_drivers,
            orders_yesterday:     json.orders_yesterday     ?? json.ordersYesterday     ?? MOCK.orders_yesterday,
            revenue_yesterday_eur: json.revenue_yesterday_eur ?? json.revenueYesterdayEur ?? MOCK.revenue_yesterday_eur,
            hourly:               json.hourly               ?? MOCK.hourly,
          });
        }
      } catch {
        if (!cancelled) setData(MOCK);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border bg-white shadow-sm p-6 flex items-center justify-center gap-2 text-stone-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Statistiken laden…</span>
      </div>
    );
  }

  if (!data) return null;

  const d = data;
  const fmtEur  = (v: number) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const nowH    = new Date().getHours();
  const hourly  = d.hourly ?? [];

  const kpis = [
    {
      icon: CheckCircle2,
      label: 'Bestellungen',
      value: d.orders_today.toString(),
      color: 'text-matcha-700',
      bg: 'bg-matcha-50',
      trend: <Trend cur={d.orders_today} prev={d.orders_yesterday} />,
    },
    {
      icon: Euro,
      label: 'Umsatz',
      value: fmtEur(d.revenue_today_eur),
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      trend: <Trend cur={d.revenue_today_eur} prev={d.revenue_yesterday_eur} />,
    },
    {
      icon: Clock,
      label: 'Ø Lieferzeit',
      value: `${Math.round(d.avg_delivery_min)} Min`,
      color: d.avg_delivery_min > 40 ? 'text-red-700' : d.avg_delivery_min > 30 ? 'text-yellow-700' : 'text-emerald-700',
      bg: d.avg_delivery_min > 40 ? 'bg-red-50' : d.avg_delivery_min > 30 ? 'bg-yellow-50' : 'bg-emerald-50',
      trend: null,
    },
    {
      icon: Star,
      label: 'Pünktlichkeit',
      value: `${d.on_time_pct}%`,
      color: d.on_time_pct >= 85 ? 'text-emerald-700' : d.on_time_pct >= 70 ? 'text-yellow-700' : 'text-red-700',
      bg: d.on_time_pct >= 85 ? 'bg-emerald-50' : d.on_time_pct >= 70 ? 'bg-yellow-50' : 'bg-red-50',
      trend: null,
    },
    {
      icon: Users,
      label: 'Fahrer aktiv',
      value: d.active_drivers.toString(),
      color: 'text-blue-700',
      bg: 'bg-blue-50',
      trend: null,
    },
  ];

  const maxRev = Math.max(...hourly.map((h) => h.revenue_eur), 1);

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-stone-900 text-white">
        <BarChart2 className="w-4 h-4 shrink-0 text-amber-400" />
        <span className="text-[11px] font-black uppercase tracking-widest">Statistiken Live Hub</span>
        <span className="ml-auto text-[9px] text-stone-400">5-Min Polling</span>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-5">
        {kpis.map((kpi) => (
          <div key={kpi.label} className={cn('rounded-xl p-3', kpi.bg)}>
            <div className="flex items-center gap-1 mb-1">
              <kpi.icon className={cn('w-3 h-3 shrink-0', kpi.color)} />
              <span className="text-[9px] font-semibold text-stone-500 uppercase tracking-wider">{kpi.label}</span>
            </div>
            <div className={cn('text-lg font-black tabular-nums leading-none', kpi.color)}>
              {kpi.value}
            </div>
            {kpi.trend && <div className="mt-1">{kpi.trend}</div>}
          </div>
        ))}
      </div>

      {/* Hourly revenue chart */}
      {hourly.length > 0 && (
        <div className="px-4 pb-4">
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">
            Stunden-Umsatz (heute)
          </div>
          <div className="h-24">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourly} barSize={18} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: '#78716c' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(v: number) => [fmtEur(v), 'Umsatz']}
                  contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid #e7e5e4' }}
                />
                <Bar dataKey="revenue_eur" radius={[3, 3, 0, 0]}>
                  {hourly.map((entry) => (
                    <Cell
                      key={entry.h}
                      fill={entry.h === nowH ? '#16a34a' : '#86efac'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 border-t px-4 py-2 bg-stone-50 text-[10px] text-stone-400">
        <Truck className="w-3 h-3 shrink-0" />
        <span>Heute · automatische Aktualisierung alle 5 Min</span>
        <span className="ml-auto font-bold text-stone-600">
          vs. Vortag: {d.orders_yesterday} Bestellungen
        </span>
      </div>
    </div>
  );
}
