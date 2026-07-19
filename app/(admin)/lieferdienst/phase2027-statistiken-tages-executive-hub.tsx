'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Euro, Package, Truck, Clock, Star, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KpiCard {
  key: string;
  label: string;
  value: string;
  unit: string;
  trend_pct: number;
  color: 'ok' | 'warn' | 'err' | 'neutral';
}

interface HourBar {
  h: number;
  orders: number;
  umsatz: number;
}

interface DriverStat {
  name: string;
  score: number;
  touren: number;
  on_time_pct: number;
}

interface ApiData {
  kpis: KpiCard[];
  hourly: HourBar[];
  top_drivers: DriverStat[];
  zone_split: { zone: string; pct: number; orders: number }[];
}

const MOCK: ApiData = {
  kpis: [
    { key: 'umsatz',    label: 'Umsatz heute',    value: '1.842', unit: '€',   trend_pct: +12,  color: 'ok' },
    { key: 'orders',    label: 'Bestellungen',     value: '47',    unit: '',    trend_pct: +8,   color: 'ok' },
    { key: 'avg_time',  label: 'Ø Lieferzeit',     value: '28',    unit: 'min', trend_pct: -4,   color: 'ok' },
    { key: 'on_time',   label: 'Pünktlichkeit',    value: '84',    unit: '%',   trend_pct: +2,   color: 'ok' },
    { key: 'rating',    label: 'Ø Bewertung',      value: '4,3',   unit: '★',   trend_pct: 0,    color: 'neutral' },
    { key: 'storno',    label: 'Storno-Rate',      value: '3,1',   unit: '%',   trend_pct: +1,   color: 'warn' },
  ],
  hourly: [
    { h: 11, orders: 3, umsatz: 87 },  { h: 12, orders: 8, umsatz: 241 },
    { h: 13, orders: 11, umsatz: 312 }, { h: 14, orders: 7, umsatz: 198 },
    { h: 15, orders: 4, umsatz: 124 }, { h: 16, orders: 2, umsatz: 58 },
    { h: 17, orders: 5, umsatz: 142 }, { h: 18, orders: 7, umsatz: 201 },
  ],
  top_drivers: [
    { name: 'Tom H.',  score: 91, touren: 6, on_time_pct: 100 },
    { name: 'Jana R.', score: 79, touren: 5, on_time_pct: 80 },
    { name: 'Kai M.',  score: 68, touren: 4, on_time_pct: 75 },
  ],
  zone_split: [
    { zone: 'A', pct: 42, orders: 20 },
    { zone: 'B', pct: 32, orders: 15 },
    { zone: 'C', pct: 26, orders: 12 },
  ],
};

interface Props { locationId?: string | null }

function TrendIcon({ pct }: { pct: number }) {
  if (pct > 0) return <TrendingUp className="h-3 w-3 text-matcha-600" />;
  if (pct < 0) return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function trendTextColor(c: KpiCard['color'], pct: number): string {
  if (c === 'warn') return 'text-amber-600';
  if (c === 'err')  return 'text-red-600';
  if (c === 'neutral') return 'text-muted-foreground';
  return pct >= 0 ? 'text-matcha-600' : 'text-red-500';
}

export function LieferdienstPhase2027StatistikenTagesExecutiveHub({ locationId }: Props) {
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<'kpi' | 'hourly' | 'drivers'>('kpi');
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/stats/tages-executive?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch {}
    finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const t = setInterval(load, 60_000); return () => clearInterval(t); }, [load]);

  const ZONE_COLORS = ['#7A8C4A', '#D69638', '#5B7A8C'];

  return (
    <div className="rounded-2xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b hover:bg-muted/30 transition-colors"
      >
        <TrendingUp className="h-4 w-4 shrink-0 text-matcha-600" />
        <span className="text-xs font-bold uppercase tracking-wider">Statistiken · Tages-Executive-Hub</span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-1" />}
        <span className="ml-auto">
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </span>
      </button>

      {open && (
        <div className="p-3 space-y-3">
          {/* Tab navigation */}
          <div className="flex gap-1">
            {(['kpi', 'hourly', 'drivers'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[11px] font-bold transition-colors',
                  tab === t ? 'bg-saffron text-white shadow-sm' : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                {t === 'kpi' ? 'KPIs' : t === 'hourly' ? 'Stunden' : 'Fahrer'}
              </button>
            ))}
          </div>

          {/* KPI Grid */}
          {tab === 'kpi' && (
            <div className="grid grid-cols-3 gap-2">
              {data.kpis.map(k => (
                <div key={k.key} className="rounded-xl border bg-muted/30 px-2.5 py-2">
                  <div className="text-[9px] text-muted-foreground uppercase tracking-wide mb-1">{k.label}</div>
                  <div className="flex items-end gap-1">
                    <span className="text-lg font-black tabular-nums leading-none text-foreground">{k.value}</span>
                    <span className="text-[10px] text-muted-foreground mb-0.5">{k.unit}</span>
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <TrendIcon pct={k.trend_pct} />
                    <span className={cn('text-[10px] tabular-nums font-semibold', trendTextColor(k.color, k.trend_pct))}>
                      {k.trend_pct > 0 ? '+' : ''}{k.trend_pct}%
                    </span>
                    <span className="text-[9px] text-muted-foreground">vs. gestern</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Hourly chart */}
          {tab === 'hourly' && (
            <div>
              <div className="text-[10px] text-muted-foreground mb-2">Bestellungen pro Stunde</div>
              <ResponsiveContainer width="100%" height={100}>
                <BarChart data={data.hourly} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                  <XAxis dataKey="h" tickFormatter={h => `${h}h`} tick={{ fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    formatter={(v: any, name: any) => [v, name === 'orders' ? 'Bestellungen' : 'Umsatz €']}
                    contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  />
                  <Bar dataKey="orders" radius={[3, 3, 0, 0]}>
                    {data.hourly.map((entry, i) => (
                      <Cell key={i} fill={entry.orders === Math.max(...data.hourly.map(h => h.orders)) ? '#E68A2C' : '#7A8C4A'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              {/* Zone split */}
              <div className="mt-3">
                <div className="text-[10px] text-muted-foreground mb-1.5">Zonen-Split</div>
                <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                  {data.zone_split.map((z, i) => (
                    <div key={z.zone} style={{ width: `${z.pct}%`, backgroundColor: ZONE_COLORS[i] ?? '#8E8579' }} />
                  ))}
                </div>
                <div className="flex gap-3 mt-1">
                  {data.zone_split.map((z, i) => (
                    <div key={z.zone} className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: ZONE_COLORS[i] ?? '#8E8579' }} />
                      <span className="text-[10px] text-muted-foreground">Zone {z.zone} · {z.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Drivers */}
          {tab === 'drivers' && (
            <div className="space-y-2">
              {data.top_drivers.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2 rounded-xl border bg-muted/20 px-3 py-2">
                  <span className="text-[10px] font-black tabular-nums text-muted-foreground w-4 shrink-0">{i + 1}</span>
                  <Truck className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
                  <span className="flex-1 text-[11px] font-bold">{d.name}</span>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="tabular-nums">{d.touren} Touren</span>
                    <span className="tabular-nums">{d.on_time_pct}% pünktl.</span>
                    <span className={cn('tabular-nums font-black', d.score >= 80 ? 'text-matcha-700' : d.score >= 65 ? 'text-amber-700' : 'text-red-600')}>
                      {d.score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="text-[9px] text-muted-foreground text-right">60s-Update</div>
        </div>
      )}
    </div>
  );
}
