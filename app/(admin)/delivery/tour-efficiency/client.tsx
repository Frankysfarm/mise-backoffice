'use client';

/**
 * TourEfficiencyClient — Phase 362
 *
 * Tour-Effizienz-Dashboard: EUR/Stopp Trend + P75-Benchmark + Fahrer-Rangliste.
 * Tabs: 14-Tage-Trend / Fahrer-Benchmark
 */

import { useCallback, useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { cn } from '@/lib/utils';
import {
  Euro, Medal, TrendingUp, TrendingDown, Users,
  RefreshCcw, Loader2, BarChart3,
} from 'lucide-react';
import { Card } from '@/components/ui/card';

type DayRow = {
  dayBerlin: string;
  totalTours: number;
  totalStops: number;
  revenuePerStopEur: number | null;
  p75RevPerStop: number | null;
  totalRevenueEur: number;
};

type DriverRow = {
  driverId: string;
  driverName: string;
  stopsCompleted: number;
  revenueEur: number;
  revPerStopEur: number | null;
  benchmarkGrade: string;
};

type Dashboard = {
  trend: DayRow[];
  driverBenchmarks: DriverRow[];
  p75Benchmark: number | null;
  topDriverName: string | null;
};

const GRADE_STYLE: Record<string, string> = {
  'A+': 'bg-emerald-100 text-emerald-700',
  'A':  'bg-green-100 text-green-700',
  'B':  'bg-amber-100 text-amber-700',
  'C':  'bg-orange-100 text-orange-700',
  'D':  'bg-red-100 text-red-700',
};

export function TourEfficiencyClient() {
  const [data, setData]     = useState<Dashboard | null>(null);
  const [tab, setTab]       = useState<'trend' | 'benchmark'>('trend');
  const [days, setDays]     = useState(14);
  const [loading, setLoading] = useState(true);
  const [aggregating, setAggregating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/tour-efficiency-report?days=${days}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('non-ok');
      const json: Dashboard = await res.json();
      setData(json);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  async function triggerAggregate() {
    setAggregating(true);
    try {
      await fetch('/api/delivery/admin/tour-efficiency-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'aggregate' }),
      });
      await load();
    } finally { setAggregating(false); }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 gap-3 text-stone-400">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span>Lade Tour-Effizienz…</span>
      </div>
    );
  }

  const trend = data?.trend ?? [];
  const benchmarks = data?.driverBenchmarks ?? [];
  const p75 = data?.p75Benchmark;

  const latest = trend[trend.length - 1];
  const prev   = trend[trend.length - 2];
  const delta  = latest?.revenuePerStopEur != null && prev?.revenuePerStopEur != null
    ? latest.revenuePerStopEur - prev.revenuePerStopEur
    : null;

  const chartData = trend.map((d) => ({
    day:  d.dayBerlin.slice(5),
    rps:  d.revenuePerStopEur != null ? Math.round(d.revenuePerStopEur * 100) / 100 : null,
    p75:  d.p75RevPerStop != null ? Math.round(d.p75RevPerStop * 100) / 100 : null,
    rev:  Math.round(d.totalRevenueEur * 100) / 100,
  }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-stone-900">Tour-Effizienz Report</h1>
          <p className="text-sm text-stone-500 mt-0.5">EUR/Stopp · P75-Benchmark · Fahrer-Rangliste</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="rounded-lg border border-stone-200 px-2 py-1.5 text-sm text-stone-700"
          >
            <option value={7}>7 Tage</option>
            <option value={14}>14 Tage</option>
            <option value={30}>30 Tage</option>
          </select>
          <button
            onClick={triggerAggregate}
            disabled={aggregating}
            className="flex items-center gap-2 rounded-xl bg-matcha-600 px-4 py-2 text-sm font-bold text-white hover:bg-matcha-700 disabled:opacity-50 transition"
          >
            {aggregating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            {aggregating ? 'Aggregiere…' : 'Heute aggregieren'}
          </button>
        </div>
      </div>

      {/* KPI-Kacheln */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-1">
            <Euro className="h-4 w-4 text-matcha-600" />
            <span className="text-xs text-stone-500 font-semibold">Heute EUR/Stopp</span>
          </div>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-black text-matcha-800 tabular-nums">
              {latest?.revenuePerStopEur != null ? `${latest.revenuePerStopEur.toFixed(2)}€` : '–'}
            </span>
            {delta != null && (
              delta >= 0
                ? <TrendingUp className="h-4 w-4 text-emerald-600 mb-1" />
                : <TrendingDown className="h-4 w-4 text-red-500 mb-1" />
            )}
          </div>
        </Card>
        <Card className="p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 className="h-4 w-4 text-amber-500" />
            <span className="text-xs text-stone-500 font-semibold">P75-Benchmark</span>
          </div>
          <div className="text-2xl font-black text-stone-700 tabular-nums">
            {p75 != null ? `${p75.toFixed(2)}€` : '–'}
          </div>
        </Card>
        <Card className="p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-1">
            <Medal className="h-4 w-4 text-amber-400" />
            <span className="text-xs text-stone-500 font-semibold">Top-Fahrer</span>
          </div>
          <div className="text-base font-black text-stone-700 truncate">
            {data?.topDriverName ?? '–'}
          </div>
        </Card>
        <Card className="p-4 rounded-2xl">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-blue-400" />
            <span className="text-xs text-stone-500 font-semibold">Fahrer bewertet</span>
          </div>
          <div className="text-2xl font-black text-stone-700 tabular-nums">
            {benchmarks.length}
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-stone-200">
        {(['trend', 'benchmark'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-bold rounded-t-lg transition',
              tab === t
                ? 'bg-white border-x border-t border-stone-200 text-matcha-700 -mb-px'
                : 'text-stone-500 hover:text-stone-700',
            )}
          >
            {t === 'trend' ? `${days}-Tage-Trend` : 'Fahrer-Benchmark'}
          </button>
        ))}
      </div>

      {/* Trend Tab */}
      {tab === 'trend' && (
        <Card className="p-4 rounded-2xl">
          {chartData.length < 2 ? (
            <div className="text-sm text-stone-400 text-center py-8">
              Noch zu wenige Daten — täglich aggregieren lassen (03:30 UTC Cron)
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rpsGradMain" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4d8c6c" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#4d8c6c" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                  <Tooltip
                    formatter={(v: unknown, name: unknown) => {
                      const n = typeof v === 'number' ? v : null;
                      const label = name === 'rps' ? 'EUR/Stopp' : name === 'p75' ? 'P75' : String(name);
                      return n != null ? [`${n.toFixed(2)} €`, label] : ['–', String(name)];
                    }}
                    contentStyle={{ fontSize: 10, borderRadius: 8 }}
                  />
                  {p75 != null && (
                    <ReferenceLine y={p75} stroke="#f59e0b" strokeDasharray="4 3" label={{ value: 'P75', position: 'right', fontSize: 9, fill: '#f59e0b' }} />
                  )}
                  <Area
                    type="monotone"
                    dataKey="rps"
                    stroke="#4d8c6c"
                    strokeWidth={2.5}
                    fill="url(#rpsGradMain)"
                    dot={false}
                    name="rps"
                    connectNulls
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      )}

      {/* Benchmark Tab */}
      {tab === 'benchmark' && (
        <Card className="p-4 rounded-2xl">
          {benchmarks.length === 0 ? (
            <div className="text-sm text-stone-400 text-center py-8">
              Noch keine Fahrer-Benchmark-Daten
            </div>
          ) : (
            <div className="space-y-2">
              {benchmarks.map((d, i) => (
                <div key={d.driverId} className="flex items-center gap-3 p-2 rounded-xl hover:bg-stone-50 transition">
                  <span className={cn(
                    'w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-black',
                    i === 0 ? 'bg-amber-400 text-white' : 'bg-stone-100 text-stone-500',
                  )}>
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-stone-700 truncate">
                    {d.driverName}
                  </span>
                  <span className="text-sm font-black text-stone-800 tabular-nums">
                    {d.revPerStopEur != null ? `${d.revPerStopEur.toFixed(2)}€` : '–'}
                  </span>
                  <span className="text-xs text-stone-400 tabular-nums">
                    {d.stopsCompleted} Stops
                  </span>
                  <span className={cn(
                    'text-[10px] font-black px-2 py-0.5 rounded-full',
                    GRADE_STYLE[d.benchmarkGrade] ?? 'bg-stone-100 text-stone-500',
                  )}>
                    {d.benchmarkGrade}
                  </span>
                </div>
              ))}
            </div>
          )}
          {p75 != null && (
            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-700 font-semibold">
              P75-Benchmark: {p75.toFixed(2)} €/Stopp — Fahrer mit A+ übertreffen diesen Wert um &gt;10%
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
