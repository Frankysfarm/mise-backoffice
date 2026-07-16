'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  TrendingUp, TrendingDown, Clock, Euro, Package, Users,
  CheckCircle2, XCircle, AlertTriangle, Activity,
} from 'lucide-react';

interface StatsData {
  bestellungen_heute: number;
  umsatz_eur: number;
  avg_lieferzeit_min: number;
  puenktlichkeit_pct: number;
  aktive_fahrer: number;
  storno_pct: number;
  yesterday_bestellungen?: number;
  yesterday_umsatz?: number;
}

interface Props {
  locationId: string | null;
  orders?: { status?: string; total_price?: number; created_at?: string }[];
  drivers?: { is_online?: boolean }[];
}

const MOCK: StatsData = {
  bestellungen_heute: 47,
  umsatz_eur: 1284.50,
  avg_lieferzeit_min: 28,
  puenktlichkeit_pct: 87,
  aktive_fahrer: 4,
  storno_pct: 3.2,
  yesterday_bestellungen: 41,
  yesterday_umsatz: 1105.00,
};

function delta(curr: number, prev: number | undefined): { val: number; positive: boolean } | null {
  if (prev == null || prev === 0) return null;
  const d = Math.round(((curr - prev) / prev) * 100);
  return { val: Math.abs(d), positive: d >= 0 };
}

function TrendChip({ curr, prev, suffix = '%' }: { curr: number; prev: number | undefined; suffix?: string }) {
  const d = delta(curr, prev);
  if (!d) return null;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold',
      d.positive ? 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300' : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
    )}>
      {d.positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {d.val}{suffix} gg. gestern
    </span>
  );
}

export function LieferdienstPhase2005StatistikenLiveMasterHub({ locationId, orders = [], drivers = [] }: Props) {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    if (!locationId) {
      setData(MOCK);
      setLoading(false);
      return;
    }

    const load = () => {
      fetch(`/api/delivery/stats/today?location_id=${encodeURIComponent(locationId)}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d) {
            setData({
              bestellungen_heute: d.orders_today ?? MOCK.bestellungen_heute,
              umsatz_eur: d.revenue_eur ?? MOCK.umsatz_eur,
              avg_lieferzeit_min: d.avg_delivery_min ?? MOCK.avg_lieferzeit_min,
              puenktlichkeit_pct: d.on_time_pct ?? MOCK.puenktlichkeit_pct,
              aktive_fahrer: d.active_drivers ?? MOCK.aktive_fahrer,
              storno_pct: d.cancellation_pct ?? MOCK.storno_pct,
              yesterday_bestellungen: d.yesterday_orders,
              yesterday_umsatz: d.yesterday_revenue,
            });
          } else {
            setData(MOCK);
          }
        })
        .catch(() => setData(MOCK))
        .finally(() => {
          setLoading(false);
          setLastRefresh(new Date());
        });
    };

    load();
    const iv = setInterval(load, 120_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Statistiken-Live-Hub</div>
        <div className="grid grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const kpis = [
    {
      icon: <Package className="h-4 w-4" />,
      label: 'Bestellungen',
      value: data.bestellungen_heute.toString(),
      trend: <TrendChip curr={data.bestellungen_heute} prev={data.yesterday_bestellungen} suffix="%" />,
      color: 'text-blue-700 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      icon: <Euro className="h-4 w-4" />,
      label: 'Umsatz',
      value: data.umsatz_eur.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €',
      trend: <TrendChip curr={data.umsatz_eur} prev={data.yesterday_umsatz} suffix="%" />,
      color: 'text-matcha-700 dark:text-matcha-400',
      bg: 'bg-matcha-50 dark:bg-matcha-900/20',
    },
    {
      icon: <Clock className="h-4 w-4" />,
      label: 'Ø Lieferzeit',
      value: `${data.avg_lieferzeit_min} Min`,
      alert: data.avg_lieferzeit_min > 35,
      color: data.avg_lieferzeit_min > 35 ? 'text-red-600' : data.avg_lieferzeit_min > 28 ? 'text-amber-600' : 'text-matcha-700 dark:text-matcha-400',
      bg: data.avg_lieferzeit_min > 35 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-muted/40',
    },
    {
      icon: <CheckCircle2 className="h-4 w-4" />,
      label: 'Pünktlichkeit',
      value: `${data.puenktlichkeit_pct}%`,
      color: data.puenktlichkeit_pct >= 85 ? 'text-matcha-700 dark:text-matcha-400' : data.puenktlichkeit_pct >= 70 ? 'text-amber-600' : 'text-red-600',
      bg: data.puenktlichkeit_pct >= 85 ? 'bg-matcha-50 dark:bg-matcha-900/20' : data.puenktlichkeit_pct >= 70 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-red-50 dark:bg-red-900/20',
    },
    {
      icon: <Users className="h-4 w-4" />,
      label: 'Aktive Fahrer',
      value: data.aktive_fahrer.toString(),
      alert: data.aktive_fahrer === 0,
      color: data.aktive_fahrer === 0 ? 'text-red-600' : 'text-matcha-700 dark:text-matcha-400',
      bg: data.aktive_fahrer === 0 ? 'bg-red-50 dark:bg-red-900/20' : 'bg-muted/40',
    },
    {
      icon: <XCircle className="h-4 w-4" />,
      label: 'Stornoquote',
      value: `${data.storno_pct.toFixed(1)}%`,
      alert: data.storno_pct > 8,
      color: data.storno_pct > 8 ? 'text-red-600' : data.storno_pct > 5 ? 'text-amber-600' : 'text-matcha-700 dark:text-matcha-400',
      bg: data.storno_pct > 8 ? 'bg-red-50 dark:bg-red-900/20' : data.storno_pct > 5 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-muted/40',
    },
  ];

  const alertCount = kpis.filter(k => k.alert).length;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-muted/20">
        <Activity className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider flex-1">
          Statistiken · Live-Master-Hub
        </span>
        {alertCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-black text-white">
            <AlertTriangle className="h-2.5 w-2.5" />
            {alertCount} Alert{alertCount !== 1 ? 's' : ''}
          </span>
        )}
        {lastRefresh && (
          <span className="text-[9px] text-muted-foreground">
            {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4">
        {kpis.map(kpi => (
          <div key={kpi.label} className={cn('rounded-xl p-3 flex flex-col gap-1', kpi.bg)}>
            <div className={cn('flex items-center gap-1.5', kpi.color)}>
              {kpi.icon}
              <span className="text-[10px] font-semibold text-muted-foreground">{kpi.label}</span>
            </div>
            <div className={cn('text-xl font-black tabular-nums', kpi.color)}>
              {kpi.value}
            </div>
            {kpi.trend && <div>{kpi.trend}</div>}
          </div>
        ))}
      </div>

      {/* Bottom bar */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-1 text-[9px] text-muted-foreground">
          <TrendingUp className="h-3 w-3 text-matcha-500" />
          Auto-Refresh alle 2 Min · Mock-Fallback aktiv
        </div>
      </div>
    </div>
  );
}
