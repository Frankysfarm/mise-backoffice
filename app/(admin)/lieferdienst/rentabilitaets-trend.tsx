'use client';

/**
 * RentabilitaetsTrend — 30-day profitability trend chart for the Lieferdienst dashboard.
 *
 * Uses GET /api/delivery/admin/profitability?action=trend&days=30 to get daily P&L snapshots.
 * Shows a dual-line chart (Umsatz vs. Kosten) with margin % area,
 * plus summary cards for total profit, best day, and average margin.
 *
 * Intentionally different from ProfitKpiStrip (which only shows today's KPIs) —
 * this shows the multi-week trend needed for strategic decisions.
 */

import { useEffect, useState } from 'react';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { Loader2, TrendingDown, TrendingUp, Euro, Calendar } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DaySnapshot {
  snapshotDate: string;   // YYYY-MM-DD
  totalOrders: number;
  revenueEur: number;
  costEur: number;
  profitEur: number;
  marginPct: number | null;
}

interface TrendResponse {
  trend: DaySnapshot[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function fmtEur(v: number): string {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
}

function TrendChip({ pct, reverse = false }: { pct: number; reverse?: boolean }) {
  const positive = reverse ? pct < 0 : pct >= 0;
  const Icon = pct >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${positive ? 'text-matcha-600' : 'text-red-500'}`}>
      <Icon size={10} />
      {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
    </span>
  );
}

// ── Custom Tooltip ────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-stone-200 bg-white/95 px-3 py-2.5 shadow-md text-[11px]">
      <div className="font-bold text-stone-600 mb-1.5">{label}</div>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-stone-500">{p.name}:</span>
          <span className="font-bold text-char">
            {p.name === 'Marge %' ? `${p.value.toFixed(1)} %` : fmtEur(p.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function RentabilitaetsTrend({ locationId }: { locationId: string }) {
  const [data, setData] = useState<DaySnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/profitability?action=trend&days=30`)
      .then(r => r.ok ? r.json() : null)
      .then((d: TrendResponse | null) => {
        if (d?.trend) setData(d.trend);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5 flex items-center gap-2 text-xs text-stone-400">
        <Loader2 size={13} className="animate-spin" />
        Lade 30-Tage Rentabilitätstrend…
      </div>
    );
  }

  if (data.length < 3) {
    return null; // Not enough data to be meaningful
  }

  // Derived summary stats
  const totalProfit = data.reduce((s, d) => s + d.profitEur, 0);
  const avgMargin = data.filter(d => d.marginPct !== null).reduce((s, d) => s + (d.marginPct ?? 0), 0) /
    Math.max(1, data.filter(d => d.marginPct !== null).length);
  const bestDay = data.reduce((best, d) => d.profitEur > (best?.profitEur ?? -Infinity) ? d : best, data[0]);
  const lastTwoWeeks = data.slice(-14);
  const firstTwoWeeks = data.slice(0, 14);
  const avgProfitRecent = lastTwoWeeks.reduce((s, d) => s + d.profitEur, 0) / Math.max(1, lastTwoWeeks.length);
  const avgProfitEarlier = firstTwoWeeks.reduce((s, d) => s + d.profitEur, 0) / Math.max(1, firstTwoWeeks.length);
  const trendPct = avgProfitEarlier !== 0
    ? ((avgProfitRecent - avgProfitEarlier) / Math.abs(avgProfitEarlier)) * 100
    : 0;

  const chartData = data.map(d => ({
    date: shortDate(d.snapshotDate),
    'Umsatz': Math.round(d.revenueEur),
    'Kosten': Math.round(d.costEur),
    'Gewinn': Math.round(d.profitEur),
    'Marge %': d.marginPct ?? 0,
  }));

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-matcha-100 text-matcha-700 shrink-0">
          <Calendar size={15} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-char">30-Tage Rentabilitätstrend</div>
          <div className="text-[11px] text-stone-400">Umsatz · Kosten · Marge — tagesgenau</div>
        </div>
        <TrendChip pct={trendPct} />
      </div>

      {/* Summary KPI row */}
      <div className="grid grid-cols-3 divide-x divide-stone-100 border-b border-stone-100">
        <div className="px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-400 flex items-center gap-1">
            <Euro size={9} /> 30-Tage Gewinn
          </div>
          <div className={`text-lg font-black tabular-nums mt-0.5 ${totalProfit >= 0 ? 'text-matcha-700' : 'text-red-600'}`}>
            {fmtEur(totalProfit)}
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Ø Marge</div>
          <div className={`text-lg font-black tabular-nums mt-0.5 ${avgMargin >= 20 ? 'text-matcha-700' : avgMargin >= 10 ? 'text-amber-700' : 'text-red-600'}`}>
            {avgMargin.toFixed(1)} %
          </div>
        </div>
        <div className="px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-stone-400">Bester Tag</div>
          <div className="text-lg font-black tabular-nums text-matcha-700 mt-0.5">{fmtEur(bestDay.profitEur)}</div>
          <div className="text-[10px] text-stone-400">{shortDate(bestDay.snapshotDate)}</div>
        </div>
      </div>

      {/* Revenue vs Cost line chart */}
      <div className="px-5 pt-4 pb-2">
        <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">
          Umsatz vs. Kosten (30 Tage)
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={chartData} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${Math.round(v / 100) * 100}`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              iconSize={8}
              wrapperStyle={{ fontSize: '10px', paddingTop: '4px' }}
            />
            <Line type="monotone" dataKey="Umsatz" stroke="#16a34a" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="Kosten" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="4 2" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Margin area chart */}
      <div className="px-5 pb-4">
        <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">
          Marge % (täglich)
        </div>
        <ResponsiveContainer width="100%" height={90}>
          <AreaChart data={chartData} margin={{ top: 2, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 9, fill: '#94a3b8' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => `${v}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <defs>
              <linearGradient id="marginGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#15803d" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#15803d" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey="Marge %"
              stroke="#15803d"
              strokeWidth={2}
              fill="url(#marginGrad)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="mt-2 text-[10px] text-stone-400 text-right">
          Quelle: /api/delivery/admin/profitability · tägl. Snapshot
        </div>
      </div>
    </div>
  );
}
