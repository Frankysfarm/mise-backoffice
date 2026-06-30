'use client';

/**
 * Phase 516 — WochenTrendAnalyse
 *
 * Vergleicht letzte 7 Tage mit der Vorwoche:
 * - Bestellvolumen: Balkendiagramm (diese Woche vs. Vorwoche)
 * - Umsatz-Trend mit Delta-Badge
 * - Tages-Kacheln mit Minibalken
 * - 300s Auto-Refresh
 */

import { useEffect, useState } from 'react';
import {
  TrendingUp, TrendingDown, Minus, BarChart2, Euro, Package, RefreshCw,
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface DayBucket {
  date: string;
  label: string;
  orders: number;
  revenue: number;
  avgDeliveryMin: number | null;
  onTimePct: number | null;
}

interface WochenTrendData {
  thisWeek: DayBucket[];
  lastWeek: DayBucket[];
  totals: {
    ordersThisWeek: number;
    ordersLastWeek: number;
    ordersDelta: number;
    revenueThisWeek: number;
    revenueLastWeek: number;
    revenueDelta: number;
    avgDeliveryThisWeek: number | null;
    avgDeliveryLastWeek: number | null;
    onTimePctThisWeek: number | null;
    onTimePctLastWeek: number | null;
  };
}

interface Props {
  locationId: string | null;
}

function DeltaBadge({ value }: { value: number }) {
  if (value > 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-matcha-700 bg-matcha-50 px-2 py-0.5 rounded-full">
      <TrendingUp className="h-3 w-3" />+{value}%
    </span>
  );
  if (value < 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
      <TrendingDown className="h-3 w-3" />{value}%
    </span>
  );
  return (
    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-stone-500 bg-stone-50 px-2 py-0.5 rounded-full">
      <Minus className="h-3 w-3" />0%
    </span>
  );
}

function fmtEur(v: number) {
  return v.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' €';
}

export function LieferdienstWochenTrendAnalyse({ locationId }: Props) {
  const [data, setData] = useState<WochenTrendData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(true);

  async function load() {
    try {
      const params = locationId ? `?location_id=${encodeURIComponent(locationId)}` : '';
      const res = await fetch(`/api/delivery/admin/wochen-trend-analyse${params}`);
      if (!res.ok) { setError(true); return; }
      const json = await res.json();
      if (json.ok && json.data) setData(json.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 300_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5 animate-pulse">
        <div className="h-4 w-48 bg-stone-100 rounded mb-4" />
        <div className="h-32 bg-stone-100 rounded-xl" />
      </div>
    );
  }

  if (error || !data) return null;

  // Merge this + last week into chart data
  const chartData = data.thisWeek.map((tw, i) => ({
    label: tw.label,
    dieseWoche: tw.orders,
    vorwoche: data.lastWeek[i]?.orders ?? 0,
    revDiese: tw.revenue,
  }));

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 border-b border-stone-100 hover:bg-stone-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700">
            <BarChart2 className="h-4 w-4" />
          </div>
          <div className="text-left">
            <div className="text-sm font-bold text-stone-800">7-Tage Trend-Analyse</div>
            <div className="text-[11px] text-stone-400">Diese Woche vs. Vorwoche</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DeltaBadge value={data.totals.ordersDelta} />
          <span className="text-stone-300">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <>
          {/* KPI-Row */}
          <div className="grid grid-cols-2 gap-3 px-5 pt-4 pb-2">
            <div className="rounded-xl bg-blue-50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Package className="h-3.5 w-3.5 text-blue-500" />
                <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Bestellungen</span>
              </div>
              <div className="text-xl font-black text-blue-700 tabular-nums">
                {data.totals.ordersThisWeek}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-xs text-stone-400">Vorwoche: {data.totals.ordersLastWeek}</span>
                <DeltaBadge value={data.totals.ordersDelta} />
              </div>
            </div>
            <div className="rounded-xl bg-matcha-50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Euro className="h-3.5 w-3.5 text-matcha-600" />
                <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-wide">Umsatz</span>
              </div>
              <div className="text-xl font-black text-matcha-700 tabular-nums">
                {fmtEur(data.totals.revenueThisWeek)}
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-xs text-stone-400">VW: {fmtEur(data.totals.revenueLastWeek)}</span>
                <DeltaBadge value={data.totals.revenueDelta} />
              </div>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="px-5 pb-2">
            <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-wide mb-2">
              Bestellungen je Tag
            </div>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={chartData} barGap={2} barCategoryGap={8}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#78716c' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e5e7eb', padding: '6px 10px' }}
                  formatter={(value, name) => [Number(value), name === 'dieseWoche' ? 'Diese Woche' : 'Vorwoche']}
                />
                <Bar dataKey="vorwoche" fill="#d1d5db" radius={[3, 3, 0, 0]} name="Vorwoche" />
                <Bar dataKey="dieseWoche" radius={[3, 3, 0, 0]} name="Diese Woche">
                  {chartData.map((entry, idx) => (
                    <Cell
                      key={idx}
                      fill={data.thisWeek[idx]?.date === today ? '#16a34a' : '#3b82f6'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-3 mt-1">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm bg-blue-500" />
                <span className="text-[10px] text-stone-400">Diese Woche</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm bg-stone-300" />
                <span className="text-[10px] text-stone-400">Vorwoche</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-sm bg-matcha-600" />
                <span className="text-[10px] text-stone-400">Heute</span>
              </div>
            </div>
          </div>

          {/* Day-Row Kacheln */}
          <div className="grid grid-cols-7 gap-1 px-5 pb-5 pt-3">
            {data.thisWeek.map((day, i) => {
              const isToday = day.date === today;
              const prev = data.lastWeek[i]?.orders ?? 0;
              const delta = day.orders - prev;
              return (
                <div
                  key={day.date}
                  className={`rounded-xl p-2 text-center ${isToday ? 'bg-matcha-100 border border-matcha-300' : 'bg-stone-50'}`}
                >
                  <div className={`text-[9px] font-bold uppercase ${isToday ? 'text-matcha-700' : 'text-stone-400'}`}>
                    {day.label}
                  </div>
                  <div className={`text-sm font-black tabular-nums mt-0.5 ${isToday ? 'text-matcha-800' : 'text-stone-700'}`}>
                    {day.orders}
                  </div>
                  {delta !== 0 && (
                    <div className={`text-[8px] font-semibold mt-0.5 ${delta > 0 ? 'text-matcha-600' : 'text-red-500'}`}>
                      {delta > 0 ? '+' : ''}{delta}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end px-5 pb-3">
            <button
              onClick={() => load()}
              className="flex items-center gap-1 text-[10px] text-stone-400 hover:text-stone-600 transition-colors"
            >
              <RefreshCw className="h-3 w-3" /> Aktualisieren
            </button>
          </div>
        </>
      )}
    </div>
  );
}
