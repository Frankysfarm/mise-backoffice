'use client';

/**
 * LieferdienstStandortHealthCockpit — Phase 347
 *
 * Vollständiges Cockpit für den Standort-Gesundheits-Score im Lieferdienst-Dashboard.
 * Zeigt alle 4 Dimensionen, den Gesamt-Score, Rang vs. anderen Filialen,
 * Trend-Verlauf (letzte 7 Tage) und die Top-Empfehlungen.
 *
 * API: GET /api/delivery/admin/location-health?location_id=...
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Activity, TrendingUp, TrendingDown, Minus,
  Loader2, RefreshCw, Trophy, AlertTriangle,
} from 'lucide-react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface HealthSnapshot {
  overallScore: number;
  grade: string;
  trend: 'up' | 'stable' | 'down';
  scoreDelta: number;
  weakestDimension: string | null;
  onTimeScore: number;
  driverScore: number;
  cancelScore: number;
  ratingScore: number;
  totalDeliveries: number;
  onTimeRatePct: number | null;
  cancelRatePct: number | null;
  avgRating: number | null;
  driversOnline: number;
}

interface TrendRow {
  scoreDate: string;
  overallScore: number;
  grade: string;
}

interface RankingRow {
  locationName: string;
  overallScore: number;
  grade: string;
  healthRank: number;
  totalLocations: number;
}

interface HealthDashboard {
  latest: HealthSnapshot | null;
  trend: TrendRow[];
  ranking: RankingRow[];
  recommendations: string[];
}

function gradeColor(grade: string): string {
  if (grade === 'A+' || grade === 'A')  return 'text-matcha-700';
  if (grade === 'B+' || grade === 'B')  return 'text-amber-700';
  if (grade === 'C')                    return 'text-orange-700';
  return 'text-red-700';
}

function gradeBg(grade: string): string {
  if (grade === 'A+' || grade === 'A')  return 'bg-matcha-100 border-matcha-300';
  if (grade === 'B+' || grade === 'B')  return 'bg-amber-50 border-amber-200';
  if (grade === 'C')                    return 'bg-orange-50 border-orange-200';
  return 'bg-red-50 border-red-200';
}

function barFill(score: number): string {
  if (score >= 70) return '#22c55e';
  if (score >= 45) return '#f59e0b';
  return '#ef4444';
}

const DIMS = [
  { key: 'onTimeScore'  as const, label: 'Pünktlichkeit',       pct: '40%' },
  { key: 'driverScore'  as const, label: 'Fahrerverfügbarkeit', pct: '25%' },
  { key: 'cancelScore'  as const, label: 'Stornoquote (inv.)',  pct: '20%' },
  { key: 'ratingScore'  as const, label: 'Kundenbewertung',     pct: '15%' },
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
}

export function LieferdienstStandortHealthCockpit({ locationId }: { locationId: string }) {
  const [data, setData] = useState<HealthDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    fetch(`/api/delivery/admin/location-health?location_id=${encodeURIComponent(locationId)}`, { cache: 'no-store' })
      .then((r) => r.ok ? r.json() : null)
      .then((d: HealthDashboard | null) => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  };

  useEffect(() => {
    if (!locationId) return;
    load();
    const iv = setInterval(() => load(), 5 * 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-5 flex items-center gap-2 text-sm text-stone-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Standort-Gesundheit wird geladen…
      </div>
    );
  }

  if (!data?.latest) return null;

  const snap = data.latest;
  const TrendIcon = snap.trend === 'up' ? TrendingUp : snap.trend === 'down' ? TrendingDown : Minus;
  const trendColor = snap.trend === 'up' ? 'text-matcha-600' : snap.trend === 'down' ? 'text-red-500' : 'text-stone-400';
  const myRank = data.ranking.find((r) => r.healthRank === 1); // use first as current location if no better data
  const rankRow = data.ranking[0];

  const trendChartData = data.trend.slice(-7).map((r) => ({
    date: formatDate(r.scoreDate),
    score: Math.round(r.overallScore),
    fill: barFill(r.overallScore),
  }));

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-100">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-matcha-100 text-matcha-700">
          <Activity className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-stone-800">Standort-Gesundheits-Score</div>
          <div className="text-xs text-stone-400">Pünktlichkeit · Fahrer · Stornos · Bewertungen</div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="rounded-lg border border-stone-200 p-1.5 hover:bg-stone-50 transition"
          aria-label="Aktualisieren"
        >
          <RefreshCw className={cn('h-3.5 w-3.5 text-stone-500', refreshing && 'animate-spin')} />
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Overall score + grade */}
        <div className="flex items-center gap-4">
          {/* Big grade badge */}
          <div className={cn('flex h-16 w-16 items-center justify-center rounded-2xl border-2 text-3xl font-black shrink-0', gradeBg(snap.grade), gradeColor(snap.grade))}>
            {snap.grade}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-2xl font-black tabular-nums text-stone-800">
              {Math.round(snap.overallScore)}<span className="text-base font-semibold text-stone-400">/100</span>
            </div>
            <div className={cn('flex items-center gap-1.5 text-sm font-semibold mt-0.5', trendColor)}>
              <TrendIcon className="h-4 w-4" />
              {snap.scoreDelta !== 0
                ? `${snap.scoreDelta > 0 ? '+' : ''}${snap.scoreDelta.toFixed(1)} vs. Vortag`
                : 'Stabil vs. Vortag'}
            </div>
          </div>
          {/* Rank */}
          {rankRow && (
            <div className="shrink-0 text-right">
              <div className="flex items-center gap-1 text-amber-600 justify-end">
                <Trophy className="h-4 w-4" />
                <span className="text-sm font-black tabular-nums">#{rankRow.healthRank}</span>
              </div>
              <div className="text-[10px] text-stone-400">von {rankRow.totalLocations} Filialen</div>
            </div>
          )}
        </div>

        {/* Dimension breakdown */}
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Dimensionen</div>
          {DIMS.map((dim) => {
            const score = snap[dim.key];
            return (
              <div key={dim.key} className="flex items-center gap-2">
                <span className="w-40 shrink-0 text-[11px] text-stone-600 truncate">
                  {dim.label}
                  <span className="ml-1 text-stone-300 text-[9px]">({dim.pct})</span>
                </span>
                <div className="flex-1 h-2.5 rounded-full bg-stone-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${score}%`, backgroundColor: barFill(score) }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-[11px] font-bold tabular-nums" style={{ color: barFill(score) }}>
                  {Math.round(score)}
                </span>
              </div>
            );
          })}
        </div>

        {/* 7-day trend chart */}
        {trendChartData.length > 1 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">
              7-Tage-Trend
            </div>
            <ResponsiveContainer width="100%" height={60}>
              <BarChart data={trendChartData} barSize={16}>
                <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                <Tooltip
                  formatter={(value: unknown) => [`${Number(value)}/100`, 'Score']}
                  contentStyle={{ fontSize: 11, padding: '4px 8px' }}
                />
                <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                  {trendChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recommendations */}
        {data.recommendations.length > 0 && (
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-2">Empfehlungen</div>
            <div className="space-y-1.5">
              {data.recommendations.map((rec, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-stone-600">
                  <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5 text-amber-500" />
                  {rec}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Raw KPIs */}
        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-stone-100">
          {[
            { label: 'Lieferungen', value: snap.totalDeliveries.toString() },
            { label: 'Pünktlich', value: snap.onTimeRatePct !== null ? `${snap.onTimeRatePct.toFixed(0)}%` : '—' },
            { label: 'Ø Bewertung', value: snap.avgRating !== null ? snap.avgRating.toFixed(1) : '—' },
          ].map((kpi) => (
            <div key={kpi.label} className="rounded-lg bg-stone-50 p-2 text-center">
              <div className="text-sm font-black tabular-nums text-stone-800">{kpi.value}</div>
              <div className="text-[9px] font-semibold text-stone-400 mt-0.5">{kpi.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
