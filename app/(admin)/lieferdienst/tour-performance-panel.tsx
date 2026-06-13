'use client';

import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { cn } from '@/lib/utils';
import { BarChart2, CheckCircle2, Clock, Lightbulb, Route, Target, TrendingUp, Zap } from 'lucide-react';

interface TrendDay {
  dayBerlin: string;
  totalTours: number;
  avgEfficiencyScore: number | null;
  avgDeliveryMin: number | null;
  onTimePct: number | null;
  avgBundleSize: number | null;
}

interface ZoneEff {
  zone: string;
  totalStops: number;
  avgEfficiencyScore: number | null;
  avgDeliveryMin: number | null;
  onTimePct: number | null;
}

interface Summary {
  totalTours30d: number;
  avgBundleSize: number | null;
  avgEfficiencyScore: number | null;
  avgDeliveryMin: number | null;
  onTimePct: number | null;
  bundleRatePct: number | null;
}

interface Recommendations {
  optimalBundleSize: number;
  worstZone: string | null;
  bestZone: string | null;
  insight: string;
}

interface DashboardData {
  summary: Summary | null;
  trend: TrendDay[];
  zoneEfficiency: ZoneEff[];
  recommendations: Recommendations;
}

const ZONE_COLORS: Record<string, string> = {
  A: '#22c55e',
  B: '#3b82f6',
  C: '#f59e0b',
  D: '#ef4444',
};

const ZONE_BG: Record<string, string> = {
  A: 'bg-green-500/20 text-green-300',
  B: 'bg-blue-500/20 text-blue-300',
  C: 'bg-amber-500/20 text-amber-300',
  D: 'bg-red-500/20 text-red-300',
};

function ScoreBadge({ score }: { score: number | null }) {
  if (score == null) return <span className="text-stone-400 text-xs">–</span>;
  const cls = score >= 75 ? 'text-green-600 bg-green-50 border-green-200'
    : score >= 55 ? 'text-amber-600 bg-amber-50 border-amber-200'
    : 'text-red-600 bg-red-50 border-red-200';
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-black tabular-nums', cls)}>
      <Zap className="h-2.5 w-2.5" />
      {score}
    </span>
  );
}

export function TourPerformancePanel() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/delivery/admin/tour-analytics')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 animate-pulse space-y-3">
        <div className="h-3 w-48 rounded bg-stone-100" />
        <div className="flex gap-2">
          {[...Array(4)].map((_, i) => <div key={i} className="flex-1 h-16 rounded-xl bg-stone-100" />)}
        </div>
        <div className="h-28 rounded-xl bg-stone-100" />
      </div>
    );
  }

  if (!data?.summary && (!data?.trend || data.trend.length === 0)) {
    return null;
  }

  const s = data.summary;
  const trend = data.trend.slice(-7).map(d => ({
    tag: d.dayBerlin.slice(5),
    score: d.avgEfficiencyScore != null ? Math.round(d.avgEfficiencyScore) : null,
    lieferzeit: d.avgDeliveryMin != null ? Math.round(d.avgDeliveryMin) : null,
    touren: d.totalTours,
  }));

  return (
    <div className="rounded-xl border border-stone-200 bg-white px-4 py-3 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="h-6 w-6 rounded-lg bg-violet-100 flex items-center justify-center">
          <BarChart2 className="h-3.5 w-3.5 text-violet-600" />
        </div>
        <span className="text-xs font-black uppercase tracking-wider text-stone-600">
          Tour-Performance · 30 Tage
        </span>
      </div>

      {/* KPI-Karten */}
      {s && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2.5">
            <div className="flex items-center gap-1 mb-1">
              <Route className="h-3 w-3 text-stone-400" />
              <span className="text-[9px] font-black uppercase tracking-wider text-stone-400">Touren (30T)</span>
            </div>
            <div className="text-xl font-black text-stone-800 tabular-nums">{s.totalTours30d}</div>
            {s.bundleRatePct != null && (
              <div className="text-[10px] text-stone-400 mt-0.5">{Math.round(s.bundleRatePct)}% Multi-Stop</div>
            )}
          </div>

          <div className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2.5">
            <div className="flex items-center gap-1 mb-1">
              <Zap className="h-3 w-3 text-violet-400" />
              <span className="text-[9px] font-black uppercase tracking-wider text-stone-400">Effizienz-Score</span>
            </div>
            <ScoreBadge score={s.avgEfficiencyScore != null ? Math.round(s.avgEfficiencyScore) : null} />
            {s.avgBundleSize != null && (
              <div className="text-[10px] text-stone-400 mt-1">Ø {s.avgBundleSize.toFixed(1)} Stopps/Tour</div>
            )}
          </div>

          <div className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2.5">
            <div className="flex items-center gap-1 mb-1">
              <Clock className="h-3 w-3 text-stone-400" />
              <span className="text-[9px] font-black uppercase tracking-wider text-stone-400">Ø Lieferzeit</span>
            </div>
            <div className={cn(
              'text-xl font-black tabular-nums',
              s.avgDeliveryMin != null && s.avgDeliveryMin <= 30 ? 'text-green-700'
                : s.avgDeliveryMin != null && s.avgDeliveryMin <= 45 ? 'text-amber-700' : 'text-red-700',
            )}>
              {s.avgDeliveryMin != null ? `${Math.round(s.avgDeliveryMin)} Min` : '–'}
            </div>
          </div>

          <div className="rounded-xl border border-stone-100 bg-stone-50 px-3 py-2.5">
            <div className="flex items-center gap-1 mb-1">
              <Target className="h-3 w-3 text-stone-400" />
              <span className="text-[9px] font-black uppercase tracking-wider text-stone-400">On-Time Rate</span>
            </div>
            <div className={cn(
              'text-xl font-black tabular-nums',
              s.onTimePct != null && s.onTimePct >= 0.8 ? 'text-green-700'
                : s.onTimePct != null && s.onTimePct >= 0.6 ? 'text-amber-700' : 'text-red-700',
            )}>
              {s.onTimePct != null ? `${Math.round(s.onTimePct * 100)}%` : '–'}
            </div>
            <div className="text-[10px] text-stone-400 mt-0.5">pünktliche Stopps</div>
          </div>
        </div>
      )}

      {/* 7-Tage Trend Chart */}
      {trend.length > 1 && (
        <div>
          <div className="text-[9px] font-black uppercase tracking-wider text-stone-400 mb-2 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            Effizienz-Score (letzte 7 Tage)
          </div>
          <ResponsiveContainer width="100%" height={90}>
            <AreaChart data={trend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="tag" tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8, fontSize: 11 }}
                labelStyle={{ color: '#94a3b8' }}
                itemStyle={{ color: '#c4b5fd' }}
                formatter={(v: number) => [`${v}`, 'Score']}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#7c3aed"
                strokeWidth={2}
                fill="url(#scoreGrad)"
                dot={{ r: 2, fill: '#7c3aed' }}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Zonen-Effizienz */}
      {data.zoneEfficiency.length > 0 && (
        <div className="space-y-2">
          <div className="text-[9px] font-black uppercase tracking-wider text-stone-400">Zonen-Effizienz</div>
          <div className="space-y-1.5">
            {data.zoneEfficiency
              .sort((a, b) => (b.avgEfficiencyScore ?? 0) - (a.avgEfficiencyScore ?? 0))
              .map((z) => {
                const onTimePct = z.onTimePct != null ? Math.round(z.onTimePct * 100) : null;
                const avgMin = z.avgDeliveryMin != null ? Math.round(z.avgDeliveryMin) : null;
                const scorePct = z.avgEfficiencyScore != null ? Math.min(100, z.avgEfficiencyScore) : 0;
                const barColor = scorePct >= 75 ? 'bg-green-400'
                  : scorePct >= 55 ? 'bg-amber-400' : 'bg-red-400';
                return (
                  <div key={z.zone} className="flex items-center gap-2">
                    <span className={cn(
                      'shrink-0 inline-flex items-center justify-center h-5 w-5 rounded-md text-[10px] font-black',
                      ZONE_BG[z.zone] ?? 'bg-stone-100 text-stone-500',
                    )}>
                      {z.zone}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', barColor)}
                        style={{ width: `${scorePct}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-2 text-[10px] tabular-nums text-stone-500 shrink-0">
                      {avgMin != null && <span>{avgMin} Min</span>}
                      {onTimePct != null && (
                        <span className={cn(
                          'font-bold',
                          onTimePct >= 80 ? 'text-green-600' : onTimePct >= 60 ? 'text-amber-600' : 'text-red-600',
                        )}>
                          {onTimePct}%
                        </span>
                      )}
                      <span className="text-stone-300">({z.totalStops} Stopps)</span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* KI-Empfehlung */}
      {data.recommendations?.insight && (
        <div className="rounded-xl bg-violet-50 border border-violet-200 px-3 py-2 flex items-start gap-2">
          <Lightbulb className="h-3.5 w-3.5 text-violet-500 shrink-0 mt-0.5" />
          <div>
            <div className="text-[9px] font-black uppercase tracking-wider text-violet-500 mb-0.5">KI-Empfehlung</div>
            <div className="text-[11px] text-violet-800 leading-snug">{data.recommendations.insight}</div>
            <div className="flex flex-wrap gap-2 mt-1.5">
              {data.recommendations.optimalBundleSize > 0 && (
                <span className="text-[9px] font-bold text-violet-600 bg-violet-100 rounded-full px-2 py-0.5">
                  Optimal: {data.recommendations.optimalBundleSize} Stopps/Tour
                </span>
              )}
              {data.recommendations.bestZone && (
                <span className="text-[9px] font-bold rounded-full px-2 py-0.5 bg-green-100 text-green-700">
                  Beste Zone: {data.recommendations.bestZone}
                </span>
              )}
              {data.recommendations.worstZone && (
                <span className="text-[9px] font-bold rounded-full px-2 py-0.5 bg-red-100 text-red-700">
                  Optimierungsbedarf: Zone {data.recommendations.worstZone}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-1 justify-end">
        <CheckCircle2 className="h-3 w-3 text-stone-300" />
        <span className="text-[9px] text-stone-300">aus abgeschlossenen Touren berechnet</span>
      </div>
    </div>
  );
}
