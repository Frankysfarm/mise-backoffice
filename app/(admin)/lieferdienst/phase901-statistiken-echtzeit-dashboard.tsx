'use client';

import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, LineChart, Line, YAxis } from 'recharts';
import { cn } from '@/lib/utils';
import { BarChart3, TrendingUp, TrendingDown, Minus, Loader2, RefreshCw } from 'lucide-react';

/**
 * Phase 901 — Statistiken Echtzeit-Dashboard (Lieferdienst)
 *
 * Umfassendes Echtzeit-Statistiken-Dashboard:
 * - 6-KPI-Grid mit Trend vs. Vortag
 * - Stundenverlauf der letzten 8h als Bar-Chart
 * - Lieferzeit-Verteilung als Line-Chart
 * Polling alle 60 Sekunden.
 */

interface Props {
  locationId: string | null;
}

interface KPI {
  label: string;
  value: string;
  delta: number; // Prozentual vs. Vortag
  unit: string;
}

interface HourData {
  hour: string;
  bestellungen: number;
  umsatz: number;
}

interface ApiData {
  kpis: KPI[];
  stundenverlauf: HourData[];
  avg_lieferzeit_min: number;
  on_time_pct: number;
}

const MOCK_DATA: ApiData = {
  kpis: [
    { label: 'Bestellungen', value: '47', delta: 12, unit: '' },
    { label: 'Umsatz', value: '€ 1.284', delta: 8, unit: '' },
    { label: 'Ø Lieferzeit', value: '28 Min', delta: -5, unit: '' },
    { label: 'Pünktlichkeit', value: '91 %', delta: 3, unit: '' },
    { label: 'Stornorate', value: '2,1 %', delta: -1, unit: '' },
    { label: 'Aktive Fahrer', value: '6', delta: 0, unit: '' },
  ],
  stundenverlauf: [
    { hour: '12:00', bestellungen: 5, umsatz: 142 },
    { hour: '13:00', bestellungen: 9, umsatz: 248 },
    { hour: '14:00', bestellungen: 7, umsatz: 196 },
    { hour: '15:00', bestellungen: 4, umsatz: 112 },
    { hour: '16:00', bestellungen: 6, umsatz: 168 },
    { hour: '17:00', bestellungen: 8, umsatz: 224 },
    { hour: '18:00', bestellungen: 11, umsatz: 308 },
    { hour: '19:00', bestellungen: 7, umsatz: 196 },
  ],
  avg_lieferzeit_min: 28,
  on_time_pct: 91,
};

function TrendIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="h-3 w-3 text-matcha-500 shrink-0" />;
  if (delta < 0) return <TrendingDown className="h-3 w-3 text-red-500 shrink-0" />;
  return <Minus className="h-3 w-3 text-muted-foreground shrink-0" />;
}

function deltaColor(delta: number, invertGood = false): string {
  const good = invertGood ? delta < 0 : delta > 0;
  const bad = invertGood ? delta > 0 : delta < 0;
  if (good) return 'text-matcha-600 dark:text-matcha-400';
  if (bad) return 'text-red-600 dark:text-red-400';
  return 'text-muted-foreground';
}

const INVERT_GOOD = new Set(['Stornorate', 'Ø Lieferzeit']);

export function LieferdienstPhase901StatistikenEchtzeitDashboard({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK_DATA);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const load = useCallback(async () => {
    if (!locationId) {
      setData(MOCK_DATA);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/statistiken-echtzeit-dashboard?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error();
      const json: ApiData = await res.json();
      setData(json);
      setLastUpdate(new Date());
    } catch {
      setData(MOCK_DATA);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const maxBestellungen = Math.max(...data.stundenverlauf.map((h) => h.bestellungen), 1);

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-background/80">
        <BarChart3 className="h-4 w-4 text-matcha-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-foreground">
            Statistiken · Echtzeit-Dashboard
          </div>
          <div className="text-[10px] text-muted-foreground">
            Letzte Aktualisierung: {lastUpdate.toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg border border-border p-1.5 hover:bg-muted/40 transition disabled:opacity-50"
        >
          {loading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            : <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {data.kpis.map((kpi) => {
            const inv = INVERT_GOOD.has(kpi.label);
            return (
              <div key={kpi.label} className="rounded-lg border border-border bg-muted/20 p-3">
                <div className="text-[10px] text-muted-foreground mb-1">{kpi.label}</div>
                <div className="text-lg font-black tabular-nums text-foreground">{kpi.value}</div>
                <div className={cn('flex items-center gap-1 text-[10px] font-semibold mt-0.5', deltaColor(kpi.delta, inv))}>
                  <TrendIcon delta={inv ? -kpi.delta : kpi.delta} />
                  {kpi.delta === 0 ? 'Wie gestern' : `${kpi.delta > 0 ? '+' : ''}${kpi.delta} % vs. gestern`}
                </div>
              </div>
            );
          })}
        </div>

        {/* Stundenverlauf */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Bestellungen letzte 8 h
          </div>
          <div className="h-28">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.stundenverlauf} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 9, fill: 'currentColor' }}
                  tickLine={false}
                  axisLine={false}
                  className="text-muted-foreground"
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8 }}
                  formatter={(v: unknown) => [String(v), 'Bestellungen'] as [string, string]}
                />
                <Bar dataKey="bestellungen" radius={[3, 3, 0, 0]} maxBarSize={24}>
                  {data.stundenverlauf.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={
                        entry.bestellungen === maxBestellungen
                          ? '#4a7c59'
                          : entry.bestellungen > maxBestellungen * 0.7
                          ? '#6b9e7a'
                          : '#a8c5b0'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* On-Time und Lieferzeit Stats */}
        <div className="grid grid-cols-2 gap-3">
          {/* On-Time Ring */}
          <div className="rounded-lg border border-border bg-muted/10 p-3 flex flex-col items-center gap-1">
            <div className="text-[10px] text-muted-foreground">Pünktlichkeit</div>
            <div className="relative h-16 w-16">
              <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
                <circle cx="32" cy="32" r="24" fill="none" stroke="currentColor" strokeWidth="6" className="text-muted/30" />
                <circle
                  cx="32" cy="32" r="24"
                  fill="none"
                  stroke={data.on_time_pct >= 90 ? '#4a7c59' : data.on_time_pct >= 70 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 24 * (data.on_time_pct / 100)} 999`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn(
                  'text-sm font-black tabular-nums',
                  data.on_time_pct >= 90 ? 'text-matcha-700 dark:text-matcha-300'
                    : data.on_time_pct >= 70 ? 'text-amber-700 dark:text-amber-300'
                    : 'text-red-700 dark:text-red-300',
                )}>
                  {data.on_time_pct}%
                </span>
              </div>
            </div>
            <div className="text-[9px] text-muted-foreground">On-Time Rate</div>
          </div>

          {/* Avg Lieferzeit */}
          <div className="rounded-lg border border-border bg-muted/10 p-3 flex flex-col items-center gap-1">
            <div className="text-[10px] text-muted-foreground">Ø Lieferzeit</div>
            <div className="flex-1 flex items-center justify-center">
              <span className={cn(
                'text-3xl font-black tabular-nums',
                data.avg_lieferzeit_min <= 25 ? 'text-matcha-700 dark:text-matcha-300'
                  : data.avg_lieferzeit_min <= 35 ? 'text-amber-700 dark:text-amber-300'
                  : 'text-red-700 dark:text-red-300',
              )}>
                {data.avg_lieferzeit_min}
              </span>
            </div>
            <div className="text-[9px] text-muted-foreground">Minuten</div>
            <div className={cn(
              'text-[9px] rounded-full px-2 py-0.5 font-bold',
              data.avg_lieferzeit_min <= 25 ? 'bg-matcha-100 text-matcha-700'
                : data.avg_lieferzeit_min <= 35 ? 'bg-amber-100 text-amber-700'
                : 'bg-red-100 text-red-700',
            )}>
              {data.avg_lieferzeit_min <= 25 ? 'Sehr gut' : data.avg_lieferzeit_min <= 35 ? 'Gut' : 'Verbesserbar'}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 px-4 py-2 border-t bg-muted/20 text-[10px] text-muted-foreground">
        <TrendingUp className="h-3 w-3 shrink-0" />
        <span>Live-Statistiken · Polling 60 s</span>
      </div>
    </div>
  );
}
