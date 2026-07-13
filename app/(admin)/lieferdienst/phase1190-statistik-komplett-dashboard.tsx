'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { TrendingUp, TrendingDown, Minus, BarChart3, Truck, Clock, Star, AlertTriangle, Euro, Package } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1190 — Statistik-Komplett-Dashboard (Lieferdienst)
// Vollständiges Tages-Statistik-Dashboard mit KPI-Grid, Stunden-Histogramm,
// Trend-Vergleich Vortag, Lieferzeit-Verteilung und Top-Zonen

interface Props {
  locationId: string | null;
}

type KpiRow = {
  label: string;
  value: string;
  delta: number | null;  // positiv = besser, negativ = schlechter
  unit: string;
  icon: 'orders' | 'revenue' | 'time' | 'rating' | 'storno' | 'drivers';
  highlight?: boolean;
};

type HourBucket = {
  hour: string;
  orders: number;
  revenue: number;
};

type ZoneRow = {
  zone: string;
  orders: number;
  avgMin: number;
  revenue: number;
};

type DashboardData = {
  kpis: KpiRow[];
  hourly: HourBucket[];
  zones: ZoneRow[];
  generatedAt: string;
};

const MOCK_DATA: DashboardData = {
  kpis: [
    { label: 'Bestellungen heute', value: '147',   delta: 12,   unit: 'vs. gestern', icon: 'orders',  highlight: true },
    { label: 'Umsatz heute',       value: '2.834', delta: 8.3,  unit: '% vs. gestern', icon: 'revenue', highlight: true },
    { label: 'Ø Lieferzeit',       value: '28',    delta: -3.1, unit: 'Min (gestern: 31)', icon: 'time' },
    { label: 'Ø Kundenbewertung',  value: '4.7',   delta: 0.2,  unit: '/ 5.0',       icon: 'rating' },
    { label: 'Stornoquote',        value: '2,1',   delta: -0.5, unit: '% (besser)',   icon: 'storno' },
    { label: 'Fahrer heute',       value: '8',     delta: 1,    unit: 'aktiv',        icon: 'drivers' },
  ],
  hourly: [
    { hour: '10', orders: 3,  revenue: 58  },
    { hour: '11', orders: 8,  revenue: 156 },
    { hour: '12', orders: 22, revenue: 432 },
    { hour: '13', orders: 31, revenue: 612 },
    { hour: '14', orders: 18, revenue: 351 },
    { hour: '15', orders: 11, revenue: 218 },
    { hour: '16', orders: 9,  revenue: 174 },
    { hour: '17', orders: 14, revenue: 274 },
    { hour: '18', orders: 28, revenue: 543 },
    { hour: '19', orders: 3,  revenue: 16  },
  ],
  zones: [
    { zone: 'Nord',  orders: 47, avgMin: 26, revenue: 912 },
    { zone: 'Süd',   orders: 38, avgMin: 31, revenue: 734 },
    { zone: 'Mitte', orders: 35, avgMin: 22, revenue: 681 },
    { zone: 'Ost',   orders: 27, avgMin: 33, revenue: 507 },
  ],
  generatedAt: new Date().toISOString(),
};

const ICON_MAP = {
  orders:  Package,
  revenue: Euro,
  time:    Clock,
  rating:  Star,
  storno:  AlertTriangle,
  drivers: Truck,
};

function DeltaChip({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  const positive = delta > 0;
  const neutral = delta === 0;
  return (
    <span className={cn(
      'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-black',
      neutral  ? 'bg-muted text-muted-foreground'
      : positive ? 'bg-matcha-100 text-matcha-700'
      :            'bg-red-100 text-red-700',
    )}>
      {neutral ? <Minus className="h-2.5 w-2.5" /> : positive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {delta > 0 ? '+' : ''}{delta}
    </span>
  );
}

const BAR_COLORS = ['#6b8f6b', '#8cb08c', '#4d7a4d', '#3d6b3d', '#2e5c2e', '#1f4d1f', '#6b8f6b', '#8cb08c', '#4d7a4d', '#3d6b3d'];

export function LieferdienstPhase1190StatistikKomplettDashboard({ locationId }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeChart, setActiveChart] = useState<'orders' | 'revenue'>('orders');

  const load = useCallback(async () => {
    if (!locationId) { setData(MOCK_DATA); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/stats/dashboard?location_id=${locationId}&range=today`);
      if (!res.ok) throw new Error('err');
      const json = await res.json();
      if (json?.kpis) {
        setData(json as DashboardData);
      } else {
        setData(MOCK_DATA);
      }
    } catch {
      setData(MOCK_DATA);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 120_000);
    return () => clearInterval(iv);
  }, [load]);

  const d = data ?? MOCK_DATA;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white dark:border-stone-700 dark:bg-stone-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100 dark:border-stone-700">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700 dark:bg-matcha-900 dark:text-matcha-400">
          <BarChart3 className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-black text-foreground">Statistik-Dashboard</div>
          <div className="text-[10px] text-muted-foreground">Tages-Übersicht · Live-Aktualisierung</div>
        </div>
        {loading && (
          <div className="ml-auto h-1.5 w-12 rounded-full bg-matcha-200 overflow-hidden">
            <div className="h-full w-1/2 bg-matcha-500 animate-pulse rounded-full" />
          </div>
        )}
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
        {d.kpis.map(kpi => {
          const Icon = ICON_MAP[kpi.icon];
          return (
            <div
              key={kpi.label}
              className={cn(
                'rounded-xl p-3 border transition-all',
                kpi.highlight
                  ? 'bg-matcha-50 border-matcha-200 dark:bg-matcha-950/30 dark:border-matcha-700'
                  : 'bg-stone-50 border-stone-100 dark:bg-stone-800 dark:border-stone-700',
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <Icon className={cn('h-3.5 w-3.5', kpi.highlight ? 'text-matcha-600' : 'text-muted-foreground')} />
                <DeltaChip delta={kpi.delta} />
              </div>
              <div className={cn(
                'text-xl font-black tabular-nums leading-none',
                kpi.highlight ? 'text-matcha-700 dark:text-matcha-400' : 'text-foreground',
              )}>
                {kpi.value}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 font-semibold leading-tight">{kpi.label}</div>
              <div className="text-[9px] text-muted-foreground/70 mt-0.5">{kpi.unit}</div>
            </div>
          );
        })}
      </div>

      {/* Stunden-Histogramm */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Stündlicher Verlauf</span>
          <div className="ml-auto flex rounded-lg overflow-hidden border border-stone-200 dark:border-stone-700">
            <button
              onClick={() => setActiveChart('orders')}
              className={cn(
                'px-2.5 py-1 text-[10px] font-bold transition',
                activeChart === 'orders' ? 'bg-matcha-600 text-white' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              Bestellungen
            </button>
            <button
              onClick={() => setActiveChart('revenue')}
              className={cn(
                'px-2.5 py-1 text-[10px] font-bold transition',
                activeChart === 'revenue' ? 'bg-matcha-600 text-white' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              Umsatz
            </button>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={100}>
          <BarChart data={d.hourly} barSize={16} margin={{ top: 4, right: 0, left: -30, bottom: 0 }}>
            <XAxis dataKey="hour" tick={{ fontSize: 9, fill: 'currentColor' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 9, fill: 'currentColor' }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{ fontSize: 11, padding: '4px 8px', borderRadius: 8, border: 'none', background: 'var(--background)', color: 'var(--foreground)' }}
              formatter={(v: unknown) => [activeChart === 'revenue' ? `${v} €` : `${v} Bestellungen`, '']}
              labelFormatter={l => `${l}:00 Uhr`}
            />
            <Bar dataKey={activeChart} radius={[4, 4, 0, 0]}>
              {d.hourly.map((_, i) => (
                <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Zonen-Tabelle */}
      <div className="border-t border-stone-100 dark:border-stone-700 px-4 py-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Top-Zonen</div>
        <div className="space-y-1.5">
          {d.zones.map((z, i) => {
            const maxOrders = Math.max(...d.zones.map(z => z.orders));
            const pct = Math.round((z.orders / maxOrders) * 100);
            return (
              <div key={z.zone} className="flex items-center gap-2">
                <span className="w-4 text-[9px] font-black text-muted-foreground shrink-0">{i + 1}</span>
                <span className="w-12 text-[11px] font-bold shrink-0 truncate">{z.zone}</span>
                <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-matcha-500 transition-all duration-700"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-10 text-right text-[10px] font-bold tabular-nums shrink-0">{z.orders} Bst.</span>
                <span className="w-12 text-right text-[9px] text-muted-foreground shrink-0">Ø {z.avgMin} Min</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="px-4 py-2 border-t border-stone-100 dark:border-stone-700">
        <span className="text-[9px] text-muted-foreground">
          Aktualisiert: {new Date(d.generatedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
        </span>
      </div>
    </div>
  );
}
