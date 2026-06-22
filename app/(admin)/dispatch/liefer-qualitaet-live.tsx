'use client';

/**
 * DispatchLieferQualitaetLive
 *
 * Zeigt den aktuellen Liefer-Qualitäts-Index (LQI) der aktiven Schicht
 * im Dispatch-Dashboard. Aggregiert alle Fahrerbewertungen des heutigen Tags
 * zu einem Gesamt-Score mit Note und Trend-Vergleich zum Vortag.
 * Polling alle 5 Minuten auf /api/delivery/admin/liefer-qualitaet
 */

import { useEffect, useRef, useState } from 'react';
import { Star, TrendingUp, TrendingDown, Minus, RefreshCw, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AggregateEntry {
  driverId: string;
  driverName: string | null;
  datum: string;
  avgScore: number;
  count: number;
}

interface LqiData {
  todayScore: number;
  todayCount: number;
  yesterdayScore: number | null;
  puenktlichkeit: number | null;
  vollstaendigkeit: number | null;
  zufriedenheit: number | null;
}

function scoreGrade(s: number): { label: string; color: string; bg: string; border: string } {
  if (s >= 90) return { label: 'A+', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  if (s >= 80) return { label: 'A',  color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' };
  if (s >= 70) return { label: 'B',  color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' };
  if (s >= 55) return { label: 'C',  color: 'text-orange-700',  bg: 'bg-orange-50',  border: 'border-orange-200' };
  return               { label: 'D',  color: 'text-red-700',     bg: 'bg-red-50',     border: 'border-red-200' };
}

function scoreTextColor(s: number): string {
  if (s >= 90) return 'text-emerald-600';
  if (s >= 80) return 'text-emerald-600';
  if (s >= 70) return 'text-amber-600';
  if (s >= 50) return 'text-orange-500';
  return 'text-red-600';
}

function barFillColor(s: number): string {
  if (s >= 90) return 'bg-emerald-500';
  if (s >= 80) return 'bg-emerald-400';
  if (s >= 70) return 'bg-amber-400';
  if (s >= 50) return 'bg-orange-400';
  return 'bg-red-500';
}

function parseAggregat(raw: AggregateEntry[]): LqiData | null {
  if (!raw.length) return null;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

  const todayRows = raw.filter((e) => e.datum.slice(0, 10) === today);
  const yesterdayRows = raw.filter((e) => e.datum.slice(0, 10) === yesterday);

  if (!todayRows.length) return null;

  const totalCount = todayRows.reduce((s, e) => s + e.count, 0);
  const todayScore =
    todayRows.reduce((s, e) => s + e.avgScore * e.count, 0) / (totalCount || 1);

  const ystCount = yesterdayRows.reduce((s, e) => s + e.count, 0);
  const yesterdayScore =
    ystCount > 0
      ? yesterdayRows.reduce((s, e) => s + e.avgScore * e.count, 0) / ystCount
      : null;

  return {
    todayScore: Math.round(todayScore * 10) / 10,
    todayCount: totalCount,
    yesterdayScore: yesterdayScore !== null ? Math.round(yesterdayScore * 10) / 10 : null,
    puenktlichkeit: null,
    vollstaendigkeit: null,
    zufriedenheit: null,
  };
}

export function DispatchLieferQualitaetLive({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<LqiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async (isManual = false) => {
    if (!locationId) {
      setLoading(false);
      return;
    }
    if (isManual) setRefreshing(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/liefer-qualitaet?location_id=${encodeURIComponent(locationId)}&action=aggregat&days=1`,
        { cache: 'no-store' },
      );
      if (!res.ok) return;
      const json: { aggregat?: AggregateEntry[] } = await res.json();
      if (mounted.current && json.aggregat) {
        const parsed = parseAggregat(json.aggregat);
        setData(parsed);
      }
    } catch {
      // ignore network errors
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    setData(null);
    load();
    timer.current = setInterval(() => load(), 5 * 60_000);
    return () => {
      mounted.current = false;
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm px-4 py-3 space-y-3">
        <div className="h-4 w-40 rounded bg-gray-100 animate-pulse" />
        <div className="h-10 w-full rounded bg-gray-100 animate-pulse" />
        <div className="h-6 w-full rounded bg-gray-100 animate-pulse" />
      </div>
    );
  }

  if (!data) return null;

  const grade = scoreGrade(data.todayScore);
  const diff = data.yesterdayScore !== null ? data.todayScore - data.yesterdayScore : null;
  const trend = diff === null ? 'none' : diff > 2 ? 'up' : diff < -2 ? 'down' : 'stable';

  const components: { label: string; value: number | null; weight: string }[] = [
    { label: 'Pünktlichkeit',   value: data.puenktlichkeit,   weight: '40%' },
    { label: 'Vollständigkeit', value: data.vollstaendigkeit, weight: '30%' },
    { label: 'Zufriedenheit',   value: data.zufriedenheit,   weight: '30%' },
  ];

  const hasComponents = components.some((c) => c.value !== null);

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm px-4 py-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="text-[11px] font-black uppercase tracking-wider text-gray-500">
            Liefer-Qualität Heute
          </span>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="text-gray-400 hover:text-matcha-500 transition-colors disabled:opacity-40"
          aria-label="Aktualisieren"
        >
          <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
        </button>
      </div>

      {/* Score badge + trend */}
      <div className="flex items-center gap-3">
        {/* Large score */}
        <div className={cn(
          'flex items-baseline gap-1.5 rounded-xl border px-3 py-2',
          grade.bg,
          grade.border,
        )}>
          <span className={cn('text-3xl font-black tabular-nums leading-none', grade.color)}>
            {data.todayScore.toFixed(1)}
          </span>
          <div className="flex flex-col items-start">
            <span className={cn('text-sm font-black leading-none', grade.color)}>
              {grade.label}
            </span>
            <span className="text-[9px] text-gray-400 leading-none mt-0.5">LQI</span>
          </div>
        </div>

        {/* Right: trend + count */}
        <div className="flex flex-col gap-1.5 min-w-0">
          {trend !== 'none' && (
            <div className={cn(
              'flex items-center gap-1 text-[11px] font-bold',
              trend === 'up'   ? 'text-emerald-600' :
              trend === 'down' ? 'text-red-600' :
              'text-gray-400',
            )}>
              {trend === 'up'     && <TrendingUp className="h-3.5 w-3.5 shrink-0" />}
              {trend === 'down'   && <TrendingDown className="h-3.5 w-3.5 shrink-0" />}
              {trend === 'stable' && <Minus className="h-3.5 w-3.5 shrink-0" />}
              <span>
                {diff! > 0 ? '+' : ''}{diff!.toFixed(1)} vs. Gestern
              </span>
            </div>
          )}
          <div className="flex items-center gap-1 text-[10px] text-gray-400">
            <Target className="h-3 w-3 shrink-0" />
            <span>{data.todayCount} Lieferung{data.todayCount !== 1 ? 'en' : ''}</span>
          </div>
        </div>
      </div>

      {/* Component bars */}
      {hasComponents && (
        <div className="space-y-1.5">
          {components.map(({ label, value, weight }) => (
            <div key={label} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-gray-500">
                  {label}
                  <span className="font-normal text-gray-300 ml-1">({weight})</span>
                </span>
                <span className={cn(
                  'text-[11px] font-black tabular-nums',
                  value !== null ? scoreTextColor(value) : 'text-gray-300',
                )}>
                  {value !== null ? Math.round(value) : '—'}
                </span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                {value !== null && (
                  <div
                    className={cn('h-full rounded-full transition-all', barFillColor(value))}
                    style={{ width: `${Math.max(2, Math.min(100, value))}%` }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
