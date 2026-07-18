'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import {
  Activity, Bike, ChevronDown, ChevronUp, Clock, Euro, Package, ShoppingBag, TrendingDown, TrendingUp,
} from 'lucide-react';
import { cn, euro } from '@/lib/utils';

/* ── Typen ─────────────────────────────────────────────────────────────── */
interface StatBlock {
  label: string;
  value: string | number;
  unit?: string;
  trend?: 'up' | 'down' | 'neutral';
  delta?: string;
  good_when?: 'up' | 'down';
}

interface HourlyData {
  hour: string;
  bestellungen: number;
  umsatz: number;
}

interface ApiData {
  bestellungen_heute: number;
  bestellungen_delta_pct: number;
  umsatz_heute: number;
  umsatz_delta_pct: number;
  avg_lieferzeit_min: number;
  avg_lieferzeit_delta_min: number;
  stornoquote_pct: number;
  stornoquote_delta_pct: number;
  aktive_fahrer: number;
  stunden_verlauf: HourlyData[];
}

/* ── Mock-Daten ─────────────────────────────────────────────────────────── */
function getMockData(): ApiData {
  const hours = Array.from({ length: 10 }, (_, i) => {
    const h = 11 + i;
    return {
      hour: `${h}:00`,
      bestellungen: Math.round(8 + Math.random() * 22),
      umsatz: Math.round((120 + Math.random() * 280) * 100) / 100,
    };
  });
  return {
    bestellungen_heute: 247,
    bestellungen_delta_pct: 12.3,
    umsatz_heute: 4820.5,
    umsatz_delta_pct: 8.7,
    avg_lieferzeit_min: 28.4,
    avg_lieferzeit_delta_min: -2.1,
    stornoquote_pct: 3.2,
    stornoquote_delta_pct: -0.4,
    aktive_fahrer: 8,
    stunden_verlauf: hours,
  };
}

/* ── KPI-Kachel ─────────────────────────────────────────────────────────── */
function KpiKachel({ block }: { block: StatBlock }) {
  const isGood =
    block.trend == null ? null :
    block.good_when === 'up' ? block.trend === 'up' :
    block.good_when === 'down' ? block.trend === 'down' :
    null;

  const trendColor =
    isGood === true  ? 'text-matcha-600 dark:text-matcha-400' :
    isGood === false ? 'text-red-600 dark:text-red-400' :
    'text-muted-foreground';

  return (
    <div className="rounded-xl border bg-muted/20 p-3 space-y-1">
      <p className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{block.label}</p>
      <div className="flex items-baseline gap-1">
        <p className="text-xl font-black tabular-nums">{block.value}</p>
        {block.unit && <p className="text-xs text-muted-foreground">{block.unit}</p>}
      </div>
      {block.delta && block.trend && (
        <div className={cn('flex items-center gap-1 text-[10px] font-bold', trendColor)}>
          {block.trend === 'up'
            ? <TrendingUp className="h-3 w-3" />
            : block.trend === 'down'
            ? <TrendingDown className="h-3 w-3" />
            : null}
          {block.delta}
        </div>
      )}
    </div>
  );
}

/* ── Chart-Tooltip ──────────────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 text-[10px] shadow-lg">
      <p className="font-bold mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="text-muted-foreground">
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

/* ── Haupt-Komponente ───────────────────────────────────────────────────── */
export function LieferdienstPhase2245StatistikLiveDashboard({
  locationId,
  className,
}: {
  locationId?: string | null;
  className?: string;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);
  const [chartMetric, setChartMetric] = useState<'bestellungen' | 'umsatz'>('bestellungen');

  const load = useCallback(async () => {
    if (!locationId) {
      setData(getMockData());
      return;
    }
    try {
      const res = await fetch(`/api/delivery/delivery-analytics?location_id=${locationId}&period=today`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setData(getMockData());
      }
    } catch {
      setData(getMockData());
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const kpis = useMemo<StatBlock[]>(() => {
    if (!data) return [];
    return [
      {
        label: 'Bestellungen',
        value: data.bestellungen_heute,
        trend: data.bestellungen_delta_pct >= 0 ? 'up' : 'down',
        delta: `${data.bestellungen_delta_pct >= 0 ? '+' : ''}${data.bestellungen_delta_pct.toFixed(1)}%`,
        good_when: 'up',
      },
      {
        label: 'Umsatz',
        value: euro(data.umsatz_heute),
        trend: data.umsatz_delta_pct >= 0 ? 'up' : 'down',
        delta: `${data.umsatz_delta_pct >= 0 ? '+' : ''}${data.umsatz_delta_pct.toFixed(1)}%`,
        good_when: 'up',
      },
      {
        label: 'Ø Lieferzeit',
        value: data.avg_lieferzeit_min.toFixed(1),
        unit: 'Min',
        trend: data.avg_lieferzeit_delta_min <= 0 ? 'up' : 'down',
        delta: `${data.avg_lieferzeit_delta_min > 0 ? '+' : ''}${data.avg_lieferzeit_delta_min.toFixed(1)} Min`,
        good_when: 'up',
      },
      {
        label: 'Stornoquote',
        value: `${data.stornoquote_pct.toFixed(1)}%`,
        trend: data.stornoquote_delta_pct <= 0 ? 'up' : 'down',
        delta: `${data.stornoquote_delta_pct > 0 ? '+' : ''}${data.stornoquote_delta_pct.toFixed(1)} Pp`,
        good_when: 'up',
      },
    ];
  }, [data]);

  const chartMax = useMemo(
    () => data ? Math.max(...data.stunden_verlauf.map(h => h[chartMetric])) : 1,
    [data, chartMetric],
  );

  return (
    <div className={cn('rounded-xl border bg-card p-4 space-y-3', className)}>
      {/* Header */}
      <button
        className="flex w-full items-center justify-between gap-2"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-matcha-100 dark:bg-matcha-900/40">
            <Activity className="h-4 w-4 text-matcha-600" />
          </span>
          <div className="text-left">
            <p className="text-sm font-bold leading-tight">Statistiken Live</p>
            <p className="text-[10px] text-muted-foreground">KPIs · Umsatz · Lieferzeit · Storno</p>
          </div>
          {data && (
            <span className="flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 text-[9px] font-bold text-blue-700 dark:text-blue-300">
              <Bike className="h-3 w-3" /> {data.aktive_fahrer} Fahrer
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <>
          {/* KPI-Kacheln */}
          <div className="grid grid-cols-2 gap-2">
            {kpis.map(k => <KpiKachel key={k.label} block={k} />)}
          </div>

          {/* Chart */}
          {data && data.stunden_verlauf.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Stundenverlauf</p>
                <div className="flex gap-1">
                  {(['bestellungen', 'umsatz'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setChartMetric(m)}
                      className={cn(
                        'rounded px-2 py-0.5 text-[9px] font-bold transition-colors',
                        chartMetric === m
                          ? 'bg-matcha-500 text-white'
                          : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                      )}
                    >
                      {m === 'bestellungen' ? <><ShoppingBag className="h-2.5 w-2.5 inline mr-0.5" />Bestellungen</> : <><Euro className="h-2.5 w-2.5 inline mr-0.5" />Umsatz</>}
                    </button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={data.stunden_verlauf} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="hour" tick={{ fontSize: 8, fill: 'currentColor' }} className="text-muted-foreground" tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey={chartMetric} radius={[3, 3, 0, 0]} maxBarSize={18}>
                    {data.stunden_verlauf.map((entry, idx) => (
                      <Cell
                        key={idx}
                        fill={
                          entry[chartMetric] >= chartMax * 0.85
                            ? '#4caf82'   /* matcha */
                            : entry[chartMetric] >= chartMax * 0.5
                            ? '#60b0e8'   /* blue */
                            : '#d1d5db'   /* gray */
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Zusammenfassung */}
          {data && (
            <div className="rounded-lg bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span>
                Ø Lieferzeit{' '}
                <strong className={data.avg_lieferzeit_min <= 30 ? 'text-matcha-600' : 'text-amber-600'}>
                  {data.avg_lieferzeit_min.toFixed(1)} Min
                </strong>
                {' · '}
                Storno{' '}
                <strong className={data.stornoquote_pct <= 5 ? 'text-matcha-600' : 'text-red-600'}>
                  {data.stornoquote_pct.toFixed(1)}%
                </strong>
                {' · '}
                {data.aktive_fahrer} aktive Fahrer
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
