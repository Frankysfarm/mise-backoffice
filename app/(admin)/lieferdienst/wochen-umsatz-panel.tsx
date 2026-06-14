'use client';

/**
 * WochenUmsatzPanel — 7-Tage Umsatz- und Lieferperformance
 *
 * Zieht Daten aus /api/delivery/admin/reporting?type=period&period_type=weekly.
 * Zeigt: Tagesbalken (Umsatz), Ø Lieferzeit, SLA-Quote, Top-Fahrer.
 */

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn, euro } from '@/lib/utils';
import {
  BarChart3, Bike, CheckCircle2, Clock, TrendingDown, TrendingUp,
} from 'lucide-react';

const LOCATION_ID = 'bb01ae0a-da47-48b1-b986-3a1201aacc4b';

type DailyKpi = {
  date: string;
  orders: { total: number; completed: number };
  revenue: { total: number | null };
};

type TopDriver = {
  driverName: string | null;
  deliveries: number;
  onTimePct: number | null;
};

type PeriodReport = {
  summary: {
    totalOrders: number;
    completedOrders: number;
    totalRevenue: number | null;
    onTimePct: number | null;
    avgEtaDeviationMin: number | null;
    activeDriversUnique: number;
  };
  dailyBreakdown: DailyKpi[];
  topDrivers: TopDriver[];
};

const DAY_LABELS: Record<number, string> = {
  0: 'So', 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa',
};

function dayLabel(iso: string): string {
  return DAY_LABELS[new Date(iso).getDay()] ?? iso.slice(5);
}

export function WochenUmsatzPanel() {
  const [report, setReport] = useState<PeriodReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const now = new Date();
        const to = now.toISOString().slice(0, 10);
        const from = new Date(now.getTime() - 6 * 86_400_000).toISOString().slice(0, 10);
        const res = await fetch(
          `/api/delivery/admin/reporting?type=period&location_id=${LOCATION_ID}&period_type=custom&from=${from}&to=${to}`,
          { cache: 'no-store' },
        );
        if (res.ok) setReport(await res.json());
      } catch {}
      setLoading(false);
    };
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl bg-white border border-stone-200 p-4 space-y-2 animate-pulse">
        <div className="h-4 w-32 bg-stone-200 rounded" />
        <div className="h-24 bg-stone-100 rounded" />
      </div>
    );
  }

  if (!report) return null;

  const { summary, dailyBreakdown, topDrivers } = report;

  const chartData = dailyBreakdown.map((d) => ({
    day: dayLabel(d.date),
    umsatz: d.revenue.total ?? 0,
    bestellungen: d.orders.total,
  }));

  const maxUmsatz = Math.max(...chartData.map((d) => d.umsatz), 1);

  return (
    <div className="rounded-2xl bg-white border border-stone-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2 border-b border-stone-100">
        <BarChart3 className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider text-stone-600">
          7-Tage Übersicht
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {(summary.onTimePct ?? 0) >= 85 ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-matcha-700 bg-matcha-50 rounded-full px-2 py-0.5">
              <CheckCircle2 className="h-2.5 w-2.5" />
              SLA {Math.round(summary.onTimePct ?? 0)}%
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 rounded-full px-2 py-0.5">
              <Clock className="h-2.5 w-2.5" />
              SLA {Math.round(summary.onTimePct ?? 0)}%
            </span>
          )}
        </div>
      </div>

      {/* KPI-Zeile */}
      <div className="grid grid-cols-3 divide-x divide-stone-100 border-b border-stone-100">
        {[
          { label: 'Bestellungen', value: summary.totalOrders.toString() },
          { label: 'Umsatz', value: euro(summary.totalRevenue ?? 0) },
          { label: 'Abgeschlossen', value: summary.completedOrders.toString() },
        ].map(({ label, value }) => (
          <div key={label} className="px-3 py-2 text-center">
            <div className="text-base font-black text-stone-800 tabular-nums">{value}</div>
            <div className="text-[9px] uppercase font-bold tracking-wide text-stone-400">{label}</div>
          </div>
        ))}
      </div>

      {/* Balkendiagramm */}
      <div className="px-3 pt-3 pb-1">
        <div className="text-[9px] font-bold uppercase tracking-wider text-stone-400 mb-1.5">
          Tagesumsatz (€)
        </div>
        <ResponsiveContainer width="100%" height={72}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barSize={14}>
            <XAxis dataKey="day" tick={{ fontSize: 9, fill: '#a8a29e' }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(v: unknown) => [euro(Number(v ?? 0)), 'Umsatz']}
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }}
            />
            <Bar dataKey="umsatz" radius={[3, 3, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.umsatz >= maxUmsatz * 0.8
                    ? '#4ade80'
                    : d.umsatz >= maxUmsatz * 0.5
                    ? '#86efac'
                    : '#d1fae5'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Ø Lieferzeit + Trend */}
      <div className="flex items-center gap-3 px-4 py-2 border-t border-stone-100">
        <Clock className="h-3.5 w-3.5 text-stone-400 shrink-0" />
        <span className="text-[11px] text-stone-500">
          Ø Abweichung:{' '}
          <span className={cn(
            'font-black',
            (summary.avgEtaDeviationMin ?? 0) <= 3 ? 'text-matcha-600' :
            (summary.avgEtaDeviationMin ?? 0) <= 7 ? 'text-amber-600' : 'text-red-600',
          )}>
            {summary.avgEtaDeviationMin != null
              ? `${summary.avgEtaDeviationMin > 0 ? '+' : ''}${Math.round(summary.avgEtaDeviationMin)} Min`
              : '–'}
          </span>
        </span>
        {(summary.avgEtaDeviationMin ?? 0) <= 3 ? (
          <TrendingUp className="h-3.5 w-3.5 text-matcha-500 ml-auto" />
        ) : (
          <TrendingDown className="h-3.5 w-3.5 text-red-400 ml-auto" />
        )}
        <span className="text-[10px] text-stone-400">
          {summary.activeDriversUnique} Fahrer
        </span>
        <Bike className="h-3 w-3 text-stone-300 shrink-0" />
      </div>

      {/* Top-Fahrer */}
      {topDrivers && topDrivers.length > 0 && (
        <div className="border-t border-stone-100 px-4 py-2 space-y-1">
          <div className="text-[9px] font-bold uppercase tracking-wider text-stone-400 mb-1">
            Top Fahrer diese Woche
          </div>
          {topDrivers.slice(0, 3).map((d, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={cn(
                'h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-black shrink-0',
                i === 0 ? 'bg-gold/20 text-gold' :
                i === 1 ? 'bg-stone-200 text-stone-600' :
                'bg-stone-100 text-stone-500',
              )}>
                {i + 1}
              </span>
              <span className="flex-1 text-[11px] font-semibold text-stone-700 truncate">
                {d.driverName ?? 'Fahrer'}
              </span>
              <span className="text-[10px] tabular-nums text-stone-500 shrink-0">
                {d.deliveries} Lieferungen
              </span>
              {d.onTimePct != null && (
                <span className={cn(
                  'text-[10px] font-bold shrink-0',
                  d.onTimePct >= 85 ? 'text-matcha-600' : 'text-amber-600',
                )}>
                  {Math.round(d.onTimePct)}%
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
