'use client';

import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Clock, Star, Bike, Euro, Target, AlertTriangle, RefreshCw, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShiftKpi {
  orders: number;
  revenue: number;
  avgDeliveryMin: number;
  onTimePct: number;
  avgRating: number | null;
  activeDrivers: number;
  cancelRatePct: number;
  slaPct: number;
}

interface HourBucket {
  label: string;
  orders: number;
  revenue: number;
}

interface Data {
  kpi: ShiftKpi;
  yesterday: Partial<ShiftKpi>;
  hourly: HourBucket[];
  currentHour: number;
}

const MOCK: Data = {
  kpi: {
    orders: 47, revenue: 1320.5, avgDeliveryMin: 28.4, onTimePct: 87,
    avgRating: 4.6, activeDrivers: 4, cancelRatePct: 3.2, slaPct: 84,
  },
  yesterday: {
    orders: 42, revenue: 1190, avgDeliveryMin: 31.1, onTimePct: 81,
    avgRating: 4.5, activeDrivers: 3, cancelRatePct: 4.1, slaPct: 79,
  },
  currentHour: new Date().getHours(),
  hourly: Array.from({ length: 12 }, (_, i) => ({
    label: `${(new Date().getHours() - 11 + i + 24) % 24}h`,
    orders: Math.round(Math.random() * 8 + 1),
    revenue: Math.round(Math.random() * 250 + 50),
  })),
};

function delta(now: number, prev: number | undefined, inverted = false): { pct: number; up: boolean; neutral: boolean } {
  if (prev == null || prev === 0) return { pct: 0, up: true, neutral: true };
  const pct = ((now - prev) / prev) * 100;
  return { pct: Math.abs(pct), up: inverted ? pct < 0 : pct > 0, neutral: Math.abs(pct) < 0.5 };
}

function TrendIcon({ d }: { d: ReturnType<typeof delta> }) {
  if (d.neutral) return <Minus className="h-3 w-3 text-muted-foreground" />;
  if (d.up) return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  return <TrendingDown className="h-3 w-3 text-red-500" />;
}

function ampel(value: number, thresholds: [number, number], inverted = false): string {
  const [warn, crit] = thresholds;
  if (!inverted) {
    if (value >= warn) return 'text-emerald-600 dark:text-emerald-400';
    if (value >= crit) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  } else {
    if (value <= warn) return 'text-emerald-600 dark:text-emerald-400';
    if (value <= crit) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  }
}

interface KpiCardProps {
  label: string;
  value: string;
  valueClass?: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  d?: ReturnType<typeof delta>;
  alert?: boolean;
}

function KpiCard({ label, value, valueClass, sub, icon: Icon, d, alert }: KpiCardProps) {
  return (
    <div className={cn('rounded-xl border bg-card p-3', alert && 'border-red-300 dark:border-red-800')}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Icon className={cn('h-3.5 w-3.5', alert ? 'text-red-500' : 'text-muted-foreground')} />
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        {d && !d.neutral && (
          <div className={cn('flex items-center gap-0.5 text-[9px] font-bold', d.up ? 'text-emerald-600' : 'text-red-600')}>
            <TrendIcon d={d} />
            <span>{d.pct.toFixed(1)}%</span>
          </div>
        )}
      </div>
      <div className={cn('text-xl font-black tabular-nums leading-none', valueClass ?? 'text-foreground')}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-[9px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

export function SchichtStatistikCockpit() {
  const [data, setData] = useState<Data>(MOCK);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'orders' | 'revenue'>('orders');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/delivery/admin/stats-kompakt');
      if (r.ok) {
        const d = await r.json();
        setData(d);
      }
    } catch {
      // use mock
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [load]);

  const { kpi, yesterday, hourly, currentHour } = data;

  const kpis = [
    {
      label: 'Bestellungen',
      value: String(kpi.orders),
      icon: Activity,
      d: delta(kpi.orders, yesterday.orders),
      valueClass: 'text-indigo-600 dark:text-indigo-400',
    },
    {
      label: 'Umsatz',
      value: `${kpi.revenue.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} €`,
      icon: Euro,
      d: delta(kpi.revenue, yesterday.revenue),
      valueClass: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Ø Lieferzeit',
      value: `${kpi.avgDeliveryMin.toFixed(0)} Min`,
      icon: Clock,
      d: delta(kpi.avgDeliveryMin, yesterday.avgDeliveryMin, true),
      valueClass: ampel(kpi.avgDeliveryMin, [30, 40], true),
    },
    {
      label: 'Pünktlichkeit',
      value: `${kpi.onTimePct.toFixed(0)} %`,
      icon: Target,
      d: delta(kpi.onTimePct, yesterday.onTimePct),
      valueClass: ampel(kpi.onTimePct, [85, 70]),
      alert: kpi.onTimePct < 70,
    },
    {
      label: 'Bewertung',
      value: kpi.avgRating != null ? `★ ${kpi.avgRating.toFixed(1)}` : '—',
      icon: Star,
      d: kpi.avgRating != null && yesterday.avgRating != null ? delta(kpi.avgRating, yesterday.avgRating) : undefined,
      valueClass: ampel(kpi.avgRating ?? 0, [4.5, 4.0]),
    },
    {
      label: 'Fahrer aktiv',
      value: String(kpi.activeDrivers),
      icon: Bike,
      valueClass: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'SLA-Rate',
      value: `${kpi.slaPct.toFixed(0)} %`,
      icon: Target,
      d: delta(kpi.slaPct, yesterday.slaPct),
      valueClass: ampel(kpi.slaPct, [85, 70]),
      alert: kpi.slaPct < 70,
    },
    {
      label: 'Storno',
      value: `${kpi.cancelRatePct.toFixed(1)} %`,
      icon: AlertTriangle,
      d: delta(kpi.cancelRatePct, yesterday.cancelRatePct, true),
      valueClass: ampel(kpi.cancelRatePct, [3, 6], true),
      alert: kpi.cancelRatePct > 6,
    },
  ];

  const alerts = kpis.filter(k => k.alert);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-indigo-600" />
          <span className="text-xs font-bold uppercase tracking-wider">Schicht-Statistik</span>
          {alerts.length > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/50 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300">
              <AlertTriangle className="h-3 w-3" />
              {alerts.length} Alert{alerts.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted/50 disabled:opacity-50 transition"
        >
          <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          Aktualisieren
        </button>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {kpis.map(k => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      {/* Hourly chart */}
      <div className="rounded-xl border bg-card p-3">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Verlauf (letzte 12h)</span>
          <div className="flex rounded-lg border overflow-hidden text-[9px] font-bold">
            <button
              onClick={() => setMode('orders')}
              className={cn('px-2 py-1 transition', mode === 'orders' ? 'bg-indigo-600 text-white' : 'text-muted-foreground hover:bg-muted/50')}
            >
              Bestellungen
            </button>
            <button
              onClick={() => setMode('revenue')}
              className={cn('px-2 py-1 transition', mode === 'revenue' ? 'bg-emerald-600 text-white' : 'text-muted-foreground hover:bg-muted/50')}
            >
              Umsatz
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={hourly} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'currentColor' }} tickLine={false} axisLine={false} className="text-muted-foreground" />
            <Tooltip
              contentStyle={{ fontSize: 10, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--card)', color: 'var(--foreground)' }}
              cursor={{ fill: 'var(--muted)' }}
            />
            <Bar dataKey={mode} radius={[3, 3, 0, 0]}>
              {hourly.map((h, i) => {
                const nowHour = new Date().getHours();
                const barHour = parseInt(h.label);
                const isCurrent = barHour === nowHour;
                return (
                  <Cell
                    key={i}
                    fill={isCurrent ? (mode === 'orders' ? '#6366f1' : '#16a34a') : 'var(--muted)'}
                    fillOpacity={isCurrent ? 1 : 0.5}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Alert strip */}
      {alerts.length > 0 && (
        <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-4 py-2.5 flex flex-wrap gap-3">
          {alerts.map(a => (
            <div key={a.label} className="flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{a.label}: {a.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
