'use client';

/**
 * ZoneDifficultyTrendChart — Phase 357
 *
 * Recharts LineChart: Zone-Schwierigkeit (A/B/C/D) über die letzten 14 Tage.
 * Zeigt dem Dispatcher, ob Zonen sich verbessern oder verschlechtern.
 * Pollt alle 10 Minuten.
 */

import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, ChevronDown, ChevronUp, BarChart2 } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface HistoryRow {
  zone: string;
  snapshot_date: string;
  avg_difficulty: number;
}

interface ChartPoint {
  date: string;
  A?: number;
  B?: number;
  C?: number;
  D?: number;
}

const ZONE_COLORS: Record<string, string> = {
  A: '#22c55e',
  B: '#3b82f6',
  C: '#f59e0b',
  D: '#ef4444',
};

function buildChartData(rows: HistoryRow[]): ChartPoint[] {
  const byDate = new Map<string, ChartPoint>();
  for (const r of rows) {
    const label = r.snapshot_date.slice(5); // MM-DD
    if (!byDate.has(label)) byDate.set(label, { date: label });
    const pt = byDate.get(label)!;
    (pt as Record<string, unknown>)[r.zone] = Math.round(Number(r.avg_difficulty) * 10) / 10;
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export function ZoneDifficultyTrendChart() {
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/zone-difficulty?action=history&days=14', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json() as { history?: HistoryRow[] };
      const rows = json.history ?? [];
      setChartData(buildChartData(rows));
      setLastRefresh(new Date());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetchData]);

  if (!loading && chartData.length === 0) return null;

  const activeZones = Object.keys(ZONE_COLORS).filter((z) =>
    chartData.some((d) => (d as Record<string, unknown>)[z] !== undefined),
  );

  return (
    <div className="w-full rounded-xl border border-gray-100 bg-white shadow-sm px-4 py-3">
      <button
        className="w-full flex items-center justify-between"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
            Zonen-Schwierigkeit 14 Tage
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400">
            {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {collapsed
            ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
            : <ChevronUp className="w-3.5 h-3.5 text-gray-400" />}
        </div>
      </button>

      {!collapsed && (
        <div className="mt-3">
          {loading ? (
            <div className="h-36 flex items-center justify-center">
              <BarChart2 className="w-6 h-6 text-gray-200 animate-pulse" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 9, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  domain={[0, 5]}
                  ticks={[1, 2, 3, 4, 5]}
                  tick={{ fontSize: 9, fill: '#9ca3af' }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 10, padding: '4px 8px' }}
                  formatter={(v: number) => [`${v.toFixed(1)}/5`, '']}
                />
                <Legend
                  iconType="circle"
                  iconSize={6}
                  wrapperStyle={{ fontSize: 9, paddingTop: 4 }}
                  formatter={(v) => `Zone ${v}`}
                />
                {activeZones.map((z) => (
                  <Line
                    key={z}
                    type="monotone"
                    dataKey={z}
                    stroke={ZONE_COLORS[z]}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      )}
    </div>
  );
}

export default ZoneDifficultyTrendChart;
