'use client';

/**
 * SchichtDowTrendChart — Phase 412
 *
 * Zeigt den historischen Verlauf (8 Wochen) für den aktuellen Wochentag.
 * API: GET /api/delivery/admin/schicht-vergleich?location_id=...&action=history&dow=<0-6>&weeks=8
 *
 * Metriken im Linien-Chart:
 * - Umsatz (€)
 * - Lieferungen
 * - Pünktlichkeit (%)
 */

import { useEffect, useState, useCallback } from 'react';
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { BarChart3, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HistoryPoint {
  snapshotDate: string;
  revenueEur: number;
  deliveryCount: number;
  avgDeliveryMin: number | null;
  onTimePct: number | null;
  netMarginPct: number | null;
}

type Metric = 'revenue' | 'deliveries' | 'onTime';

const METRIC_CONFIG: Record<Metric, { label: string; color: string; format: (v: number) => string }> = {
  revenue:    { label: 'Umsatz (€)', color: '#4a7c59', format: v => v.toLocaleString('de-DE', { maximumFractionDigits: 0 }) + ' €' },
  deliveries: { label: 'Lieferungen', color: '#2563eb', format: v => Math.round(v).toString() },
  onTime:     { label: 'Pünktlichkeit', color: '#d97706', format: v => Math.round(v) + '%' },
};

const DOW_LABELS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

export function SchichtDowTrendChart({ locationId }: { locationId: string }) {
  const dow = new Date().getDay();
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<Metric>('revenue');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/schicht-vergleich?location_id=${encodeURIComponent(locationId)}&action=history&dow=${dow}&weeks=8`
      );
      if (!res.ok) return;
      const json = await res.json();
      setPoints(Array.isArray(json.history) ? json.history : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [locationId, dow]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="h-4 w-48 bg-stone-100 rounded animate-pulse mb-4" />
        <div className="h-32 bg-stone-50 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (points.length < 2) return null;

  const chartData = points.map(p => ({
    label: new Date(p.snapshotDate).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }),
    revenue: p.revenueEur,
    deliveries: p.deliveryCount,
    onTime: p.onTimePct ?? null,
  }));

  const metricKey = metric === 'revenue' ? 'revenue' : metric === 'deliveries' ? 'deliveries' : 'onTime';
  const cfg = METRIC_CONFIG[metric];

  const values = chartData.map(d => d[metricKey]).filter((v): v is number => v !== null);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-stone-100">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50">
          <BarChart3 className="h-4 w-4 text-blue-600" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-bold text-stone-800">
            {DOW_LABELS[dow]}-Verlauf — letzte {points.length} Wochen
          </div>
          <div className="text-[11px] text-stone-500">Rollende Baseline-Vergleiche je Wochentag</div>
        </div>
        <TrendingUp className="h-4 w-4 text-stone-300" />
      </div>

      {/* Metric selector */}
      <div className="flex gap-1.5 px-5 pt-3">
        {(Object.keys(METRIC_CONFIG) as Metric[]).map(m => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={cn(
              'rounded-lg px-3 py-1 text-[11px] font-bold transition',
              metric === m
                ? 'bg-stone-800 text-white'
                : 'bg-stone-100 text-stone-500 hover:bg-stone-200',
            )}
          >
            {METRIC_CONFIG[m].label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="px-5 pt-2 pb-5">
        <ResponsiveContainer width="100%" height={120}>
          <LineChart data={chartData} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 9, fill: '#a8a29e' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e7e5e4' }}
              formatter={(v) => [cfg.format(Number(v ?? 0)), cfg.label]}
            />
            {avg !== null && (
              <ReferenceLine
                y={avg}
                stroke={cfg.color}
                strokeDasharray="3 3"
                strokeOpacity={0.4}
              />
            )}
            <Line
              type="monotone"
              dataKey={metricKey}
              stroke={cfg.color}
              strokeWidth={2.5}
              dot={{ r: 3, fill: cfg.color, strokeWidth: 0 }}
              connectNulls
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
        {avg !== null && (
          <div className="mt-1 text-[10px] text-stone-400 text-right">
            6-Wochen-Ø: <span className="font-bold text-stone-600">{cfg.format(avg)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
