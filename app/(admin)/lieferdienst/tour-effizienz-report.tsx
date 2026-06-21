'use client';

/**
 * LieferdienstTourEffizienzReport — Phase 362
 *
 * Tour-Effizienz-Dashboard: EUR/Stopp Trend + Fahrer-Benchmark-Tabelle.
 * Pollt /api/delivery/admin/tour-efficiency-report alle 10 Minuten.
 */

import { useEffect, useRef, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Medal, ChevronDown, ChevronUp, Euro } from 'lucide-react';

type DailyRow = {
  dayBerlin:        string;
  revenuePerStopEur: number | null;
  p75RevPerStop:    number | null;
  totalTours:       number;
  totalStops:       number;
};

type BenchmarkRow = {
  driverName:    string;
  revPerStopEur: number | null;
  stopsCompleted: number;
  benchmarkGrade: string;
};

type Dashboard = {
  trend:            DailyRow[];
  driverBenchmarks: BenchmarkRow[];
  p75Benchmark:     number | null;
  topDriverName:    string | null;
};

type Props = { locationId?: string | null };

const GRADE_COLOR: Record<string, string> = {
  'A+': 'text-emerald-700 bg-emerald-50',
  'A':  'text-green-700 bg-green-50',
  'B':  'text-amber-700 bg-amber-50',
  'C':  'text-orange-700 bg-orange-50',
  'D':  'text-red-700 bg-red-50',
};

export function LieferdienstTourEffizienzReport({ locationId }: Props) {
  const [data, setData]       = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen]       = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = new URLSearchParams({ days: '14' });
        if (locationId) params.set('location_id', locationId);
        const res = await fetch(`/api/delivery/admin/tour-efficiency-report?${params}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('non-ok');
        const json: Dashboard = await res.json();
        if (!cancelled) { setData(json); setLoading(false); }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    intervalRef.current = setInterval(load, 10 * 60_000);
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-100 bg-white px-4 py-3 shadow-sm animate-pulse">
        <div className="h-4 w-40 bg-stone-100 rounded mb-3" />
        <div className="h-24 bg-stone-50 rounded" />
      </div>
    );
  }

  if (!data || data.trend.length === 0) return null;

  const trendData = data.trend.map((d) => ({
    day:  d.dayBerlin.slice(5),
    rps:  d.revenuePerStopEur != null ? Math.round(d.revenuePerStopEur * 100) / 100 : null,
    p75:  d.p75RevPerStop != null ? Math.round(d.p75RevPerStop * 100) / 100 : null,
  })).filter((d) => d.rps != null);

  const last  = trendData[trendData.length - 1];
  const prev  = trendData[trendData.length - 2];
  const delta = last?.rps != null && prev?.rps != null ? last.rps - prev.rps : null;
  const TrendIcon = delta == null ? null : delta >= 0 ? TrendingUp : TrendingDown;
  const trendColor = delta == null ? '' : delta >= 0 ? 'text-emerald-600' : 'text-red-500';

  return (
    <div className="rounded-2xl border border-stone-100 bg-white px-4 py-3 shadow-sm">
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <Euro className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-bold text-stone-700">Tour-Effizienz Report</span>
        </div>
        <div className="flex items-center gap-2">
          {last?.rps != null && (
            <span className="text-sm font-black text-stone-800 tabular-nums">
              {last.rps.toFixed(2)}€/Stopp
            </span>
          )}
          {TrendIcon && (
            <TrendIcon className={cn('h-4 w-4', trendColor)} />
          )}
          {open ? <ChevronUp className="h-4 w-4 text-stone-400" /> : <ChevronDown className="h-4 w-4 text-stone-400" />}
        </div>
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          {/* KPI-Kacheln */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-matcha-50 px-3 py-2 text-center">
              <div className="text-[10px] text-matcha-600 font-semibold mb-0.5">Heute EUR/Stopp</div>
              <div className="text-base font-black text-matcha-800 tabular-nums">
                {last?.rps != null ? `${last.rps.toFixed(2)}€` : '–'}
              </div>
            </div>
            <div className="rounded-xl bg-stone-50 px-3 py-2 text-center">
              <div className="text-[10px] text-stone-500 font-semibold mb-0.5">P75-Bench</div>
              <div className="text-base font-black text-stone-700 tabular-nums">
                {data.p75Benchmark != null ? `${data.p75Benchmark.toFixed(2)}€` : '–'}
              </div>
            </div>
            <div className="rounded-xl bg-stone-50 px-3 py-2 text-center">
              <div className="text-[10px] text-stone-500 font-semibold mb-0.5">Top-Fahrer</div>
              <div className="text-xs font-black text-stone-700 truncate">
                {data.topDriverName ?? '–'}
              </div>
            </div>
          </div>

          {/* Area Chart */}
          {trendData.length >= 2 && (
            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rpsGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4d8c6c" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#4d8c6c" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(v: unknown) => {
                      const n = typeof v === 'number' ? v : null;
                      return n != null ? [`${n.toFixed(2)} €/Stopp`, ''] : ['–', ''];
                    }}
                    labelStyle={{ fontSize: 10 }}
                    contentStyle={{ fontSize: 10, borderRadius: 8 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="rps"
                    stroke="#4d8c6c"
                    strokeWidth={2}
                    fill="url(#rpsGrad)"
                    dot={false}
                    name="EUR/Stopp"
                  />
                  {trendData.some((d) => d.p75 != null) && (
                    <Area
                      type="monotone"
                      dataKey="p75"
                      stroke="#f59e0b"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      fill="none"
                      dot={false}
                      name="P75"
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Fahrer-Benchmark-Tabelle */}
          {data.driverBenchmarks.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-stone-500 uppercase tracking-wider mb-2">
                Fahrer-Benchmark (7 Tage)
              </div>
              <div className="space-y-1">
                {data.driverBenchmarks.slice(0, 5).map((d, i) => (
                  <div key={d.driverName + i} className="flex items-center gap-2">
                    {i === 0 && <Medal className="h-3 w-3 shrink-0 text-amber-500" />}
                    {i > 0  && <span className="w-3 text-center text-[10px] text-stone-400">{i + 1}</span>}
                    <span className="flex-1 text-[11px] font-semibold text-stone-700 truncate">
                      {d.driverName}
                    </span>
                    <span className="text-[11px] tabular-nums text-stone-600 font-bold">
                      {d.revPerStopEur != null ? `${d.revPerStopEur.toFixed(2)}€` : '–'}
                    </span>
                    <span className={cn(
                      'text-[9px] font-black px-1.5 py-0.5 rounded-full',
                      GRADE_COLOR[d.benchmarkGrade] ?? 'text-stone-500 bg-stone-50',
                    )}>
                      {d.benchmarkGrade}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="text-[9px] text-stone-400 text-right">10-Min-Polling · 14-Tage-Trend</div>
        </div>
      )}
    </div>
  );
}
