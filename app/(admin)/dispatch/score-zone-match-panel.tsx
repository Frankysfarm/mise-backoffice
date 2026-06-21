'use client';
import { useEffect, useState } from 'react';
import { Target, TrendingUp, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopDriver {
  driverId: string;
  driverName: string | null;
  avgRating: number;
  feedbackCount: number;
}

interface DashboardKpis {
  avgCustomerRatingThisWeek: number;
  ratingTrend: number;
  totalFeedbacksThisWeek: number;
  avgDifficultyThisWeek: number;
  activeDriversWithFeedback: number;
  topRatedDriverName: string | null;
  topRatedScore: number | null;
}

interface Dashboard {
  kpis: DashboardKpis;
  topDrivers: TopDriver[];
}

function starColor(rating: number) {
  if (rating >= 4.5) return 'text-emerald-600';
  if (rating >= 3.5) return 'text-amber-600';
  return 'text-red-500';
}

export function DispatchScoreZoneMatchPanel() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch('/api/delivery/admin/tour-feedback-analytics?action=dashboard');
      if (!res.ok) return;
      const json = await res.json() as Dashboard;
      setData(json);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 1000);
    return () => clearInterval(id);
  }, []);

  if (loading || !data) return null;
  const { kpis, topDrivers } = data;
  if (kpis.activeDriversWithFeedback === 0) return null;

  const trendPositive = kpis.ratingTrend > 0.05;
  const trendNegative = kpis.ratingTrend < -0.05;

  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-indigo-500 shrink-0" />
          <span className="text-sm font-semibold text-slate-800">Score-Qualitäts-Panel</span>
          <span className={cn('ml-1 text-xs font-bold', starColor(kpis.avgCustomerRatingThisWeek))}>
            {kpis.avgCustomerRatingThisWeek > 0 ? `${kpis.avgCustomerRatingThisWeek.toFixed(1)}★` : '—'}
          </span>
          {trendPositive && (
            <span className="text-xs font-medium text-emerald-600">↑ +{kpis.ratingTrend.toFixed(1)}</span>
          )}
          {trendNegative && (
            <span className="text-xs font-medium text-red-500">↓ {kpis.ratingTrend.toFixed(1)}</span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-3">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Bewertungen diese Woche', value: kpis.totalFeedbacksThisWeek.toString() },
              { label: 'Ø Schwierigkeit', value: kpis.avgDifficultyThisWeek > 0 ? `${kpis.avgDifficultyThisWeek.toFixed(1)}/5` : '—' },
              { label: 'Fahrer mit Feedback', value: kpis.activeDriversWithFeedback.toString() },
            ].map((k) => (
              <div key={k.label} className="rounded-lg bg-slate-50 p-2 text-center">
                <p className="text-xs text-slate-500 leading-tight">{k.label}</p>
                <p className="mt-0.5 text-base font-bold text-slate-800">{k.value}</p>
              </div>
            ))}
          </div>

          {/* Top drivers by rating */}
          {topDrivers.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-600 mb-1.5">Top Fahrer nach Kundenzufriedenheit</p>
              <div className="space-y-1.5">
                {topDrivers.slice(0, 3).map((d, i) => (
                  <div key={d.driverId} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
                    <span className="text-xs font-bold text-slate-400 w-4">#{i + 1}</span>
                    <span className="flex-1 text-xs font-medium text-slate-700 truncate">
                      {d.driverName ?? d.driverId.slice(0, 8)}
                    </span>
                    <div className="flex items-center gap-1">
                      <Star className={cn('h-3 w-3', starColor(d.avgRating))} />
                      <span className={cn('text-xs font-bold', starColor(d.avgRating))}>{d.avgRating.toFixed(1)}</span>
                    </div>
                    <span className="text-xs text-slate-400">{d.feedbackCount}×</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {kpis.topRatedDriverName && (
            <div className="flex items-center gap-2 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2">
              <TrendingUp className="h-3.5 w-3.5 text-indigo-600" />
              <p className="text-xs text-indigo-700">
                Bester Fahrer: <strong>{kpis.topRatedDriverName}</strong>
                {kpis.topRatedScore ? ` · ${kpis.topRatedScore.toFixed(1)}★ Ø` : ''}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
