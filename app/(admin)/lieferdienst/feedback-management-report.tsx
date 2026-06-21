'use client';
import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Star, TrendingUp, TrendingDown, Users, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonthEntry {
  month: string;
  avgCustomerRating: number;
  avgDifficulty: number;
  avgOverallScore: number;
  totalFeedbacks: number;
  activeDrivers: number;
}

interface Props {
  locationId: string;
}

export function LieferdienstFeedbackManagementReport({ locationId }: Props) {
  const [trend, setTrend] = useState<MonthEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch('/api/delivery/admin/tour-feedback-analytics?action=report&months=3');
      if (!res.ok) return;
      const json = await res.json() as { trend?: MonthEntry[] };
      setTrend(json.trend ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (loading) return <div className="rounded-xl border bg-white p-4 animate-pulse h-48" />;
  if (trend.length === 0) return null;

  const latest = trend[trend.length - 1];
  const prev = trend.length > 1 ? trend[trend.length - 2] : null;
  const delta = prev ? Math.round((latest.avgCustomerRating - prev.avgCustomerRating) * 10) / 10 : 0;

  const ratingColor = (r: number) =>
    r >= 4.5 ? 'text-emerald-600' : r >= 3.5 ? 'text-amber-600' : 'text-red-500';

  const chartData = trend.map((e) => ({
    name: e.month.slice(5), // MM
    Zufriedenheit: e.avgCustomerRating,
    Schwierigkeit: e.avgDifficulty,
    Feedbacks: e.totalFeedbacks,
  }));

  return (
    <div className="rounded-xl border bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-semibold text-slate-800">Feedback Management Report (3 Monate)</span>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="rounded-lg border px-2 py-1 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition"
        >
          <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-50 p-3 text-center">
          <p className="text-xs text-slate-500">Ø Zufriedenheit</p>
          <p className={cn('mt-0.5 text-xl font-bold', ratingColor(latest.avgCustomerRating))}>
            {latest.avgCustomerRating.toFixed(1)}★
          </p>
          {delta !== 0 && (
            <p className={cn('text-xs', delta > 0 ? 'text-emerald-600' : 'text-red-500')}>
              {delta > 0 ? '+' : ''}{delta} vs. Vormonat
            </p>
          )}
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-center">
          <p className="text-xs text-slate-500">Bewertungen</p>
          <p className="mt-0.5 text-xl font-bold text-slate-800">{latest.totalFeedbacks}</p>
          <p className="text-xs text-slate-400">diesen Monat</p>
        </div>
        <div className="rounded-lg bg-slate-50 p-3 text-center">
          <p className="text-xs text-slate-500">Aktive Fahrer</p>
          <p className="mt-0.5 text-xl font-bold text-slate-800 flex items-center justify-center gap-1">
            <Users className="h-3.5 w-3.5 text-slate-400" />{latest.activeDrivers}
          </p>
          <p className="text-xs text-slate-400">mit Feedback</p>
        </div>
      </div>

      {/* Trend chart */}
      {chartData.length > 1 && (
        <div>
          <p className="text-xs font-semibold text-slate-600 mb-2">Zufriedenheits-Trend (Ø pro Monat)</p>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="gradRating" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
              <Tooltip
                formatter={(value: unknown) => {
                  const n = typeof value === 'number' ? value : undefined;
                  return [n != null ? n.toFixed(2) : '—', 'Zufriedenheit'];
                }}
              />
              <Area
                type="monotone"
                dataKey="Zufriedenheit"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#gradRating)"
                dot={{ r: 3, fill: '#f59e0b' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {delta > 0.1 && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
          <p className="text-xs text-emerald-700">
            Kundenzufriedenheit steigt — Team leistet gute Arbeit.
          </p>
        </div>
      )}
      {delta < -0.1 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
          <TrendingDown className="h-3.5 w-3.5 text-amber-600" />
          <p className="text-xs text-amber-700">
            Zufriedenheit sank um {Math.abs(delta).toFixed(1)} Punkte — Tour-Qualität prüfen.
          </p>
        </div>
      )}
    </div>
  );
}
