'use client';

import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Award, Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

type TrendRow = {
  scoreDate: string;
  overallScore: number;
  grade: string;
  scoreOntime: number;
  scoreSatisfaction: number;
  scoreAccuracy: number;
  scoreSla: number;
  scoreCancel: number;
  totalOrders: number;
};

type QualityDashboard = {
  today: { overallScore: number; grade: string; weakestDimension: string; totalOrders: number } | null;
  yesterday: { overallScore: number } | null;
  weeklyAvg: number;
  trend: TrendRow[];
};

const GRADE_BADGE: Record<string, string> = {
  A: 'bg-matcha-100 text-matcha-700 border-matcha-300',
  B: 'bg-lime-100 text-lime-700 border-lime-300',
  C: 'bg-amber-100 text-amber-700 border-amber-300',
  D: 'bg-orange-100 text-orange-700 border-orange-300',
  F: 'bg-red-100 text-red-700 border-red-300',
};

const DIM_LABELS: Record<string, string> = {
  scoreOntime: 'Pünktlichkeit',
  scoreSatisfaction: 'Zufriedenheit',
  scoreAccuracy: 'Genauigkeit',
  scoreSla: 'SLA-Einhaltung',
  scoreCancel: 'Storno-Rate',
};

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit' });
  } catch {
    return iso.slice(5);
  }
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const score = payload[0]?.value ?? 0;
  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-lg text-xs">
      <div className="font-bold text-stone-700">{label}</div>
      <div className="font-black text-matcha-700 text-base tabular-nums">{Math.round(score)}</div>
      <div className="text-stone-400">Note {grade}</div>
    </div>
  );
}

export function LieferdienstQualitaetsWochenTrend({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<QualityDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }
    let cancelled = false;
    function load() {
      const url = `/api/delivery/admin/quality-score?action=dashboard&location_id=${encodeURIComponent(locationId!)}`;
      fetch(url)
        .then((r) => r.json())
        .then((d) => { if (!cancelled && d.dashboard) setData(d.dashboard); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setLoading(false); });
    }
    load();
    const iv = setInterval(load, 10 * 60_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <div className="flex items-center gap-3 mb-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Qualitätstrend wird geladen…</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const trend = (data.trend ?? []).slice(-7);
  if (trend.length === 0 && !data.today) return null;

  const chartData = trend.map((r) => ({
    date: fmtDate(r.scoreDate),
    score: Math.round(r.overallScore),
  }));

  const today = data.today;
  const delta = data.today && data.yesterday
    ? data.today.overallScore - data.yesterday.overallScore
    : null;

  const gradeClass = today ? (GRADE_BADGE[today.grade] ?? GRADE_BADGE['F']) : '';
  const weakLabel = today ? (DIM_LABELS[today.weakestDimension] ?? today.weakestDimension) : null;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-matcha-100">
            <Award className="h-4 w-4 text-matcha-700" />
          </div>
          <span className="text-sm font-bold text-stone-800">Qualitätstrend (7 Tage)</span>
        </div>
        {today && (
          <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-black', gradeClass)}>
            Heute: Note {today.grade}
          </span>
        )}
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-xl bg-stone-50 border border-stone-100 p-3 text-center">
          <div className="text-xs text-stone-400 mb-0.5">Heute</div>
          <div className={cn(
            'text-2xl font-black tabular-nums',
            today ? (today.overallScore >= 80 ? 'text-matcha-700' : today.overallScore >= 60 ? 'text-amber-600' : 'text-red-600') : 'text-stone-300',
          )}>
            {today ? Math.round(today.overallScore) : '—'}
          </div>
        </div>
        <div className="rounded-xl bg-stone-50 border border-stone-100 p-3 text-center">
          <div className="text-xs text-stone-400 mb-0.5">Ø Woche</div>
          <div className="text-2xl font-black tabular-nums text-stone-700">
            {data.weeklyAvg ? Math.round(data.weeklyAvg) : '—'}
          </div>
        </div>
        <div className="rounded-xl bg-stone-50 border border-stone-100 p-3 text-center">
          <div className="text-xs text-stone-400 mb-0.5">Trend</div>
          <div className={cn(
            'flex items-center justify-center gap-0.5 text-sm font-black',
            delta === null ? 'text-stone-300' : delta > 0 ? 'text-matcha-600' : delta < 0 ? 'text-red-500' : 'text-stone-400',
          )}>
            {delta === null ? (
              <Minus className="h-4 w-4" />
            ) : delta > 0 ? (
              <><TrendingUp className="h-4 w-4" />{delta > 0 ? '+' : ''}{delta.toFixed(1)}</>
            ) : delta < 0 ? (
              <><TrendingDown className="h-4 w-4" />{delta.toFixed(1)}</>
            ) : (
              <><Minus className="h-4 w-4" />0</>
            )}
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="h-28 mb-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="qGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4d7c0f" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#4d7c0f" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: '#a3a3a3' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#4d7c0f"
                strokeWidth={2}
                fill="url(#qGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#4d7c0f' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Weakness hint */}
      {weakLabel && today && today.overallScore < 85 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
          <span className="font-bold">Verbesserungspotenzial:</span> {weakLabel} ist aktuell die schwächste Dimension.
        </div>
      )}

      {today && (
        <div className="mt-2 text-[9px] text-stone-300 text-right">
          {today.totalOrders} Bestellungen heute
        </div>
      )}
    </div>
  );
}
