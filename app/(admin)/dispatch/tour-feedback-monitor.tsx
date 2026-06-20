'use client';
/**
 * DispatchTourFeedbackMonitor
 * Shows recent driver tour ratings to help dispatchers understand field conditions.
 * Polls /api/delivery/admin/tour-feedback?action=dashboard&days=7 every 3min.
 */
import { useEffect, useState } from 'react';
import { Star, TrendingUp, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeedbackDashboard {
  avgOverallScore: number;
  avgDifficulty: number;
  avgTraffic: number;
  avgCustomer: number;
  totalFeedbacks: number;
  issueRates: {
    parking: number;
    customer: number;
    navigation: number;
    address: number;
  };
  recentFeedbacks: {
    id: string;
    driver_name?: string;
    submitted_at: string;
    overall_score: number | null;
    difficulty_rating: number | null;
    traffic_rating: number | null;
    customer_rating: number | null;
    had_parking_issue: boolean;
    had_customer_issue: boolean;
    driver_notes: string | null;
  }[];
}

function StarRating({ value }: { value: number | null }) {
  const v = value ?? 0;
  return (
    <span className={cn(
      'font-bold tabular-nums',
      v >= 4 ? 'text-emerald-600' : v >= 3 ? 'text-amber-600' : 'text-red-600'
    )}>
      {v > 0 ? v.toFixed(1) : '—'}★
    </span>
  );
}

export function DispatchTourFeedbackMonitor() {
  const [data, setData]     = useState<FeedbackDashboard | null>(null);
  const [open, setOpen]     = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch('/api/delivery/admin/tour-feedback?action=dashboard&days=7');
      if (!res.ok) return;
      setData(await res.json() as FeedbackDashboard);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 3 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  if (loading || !data || data.totalFeedbacks === 0) return null;

  const topIssue = Object.entries(data.issueRates)
    .sort((a, b) => b[1] - a[1])
    .filter(([, v]) => v > 15)[0];

  const issueLabels: Record<string, string> = {
    parking: 'Parkproblem',
    customer: 'Kundenproblem',
    navigation: 'Navigation',
    address: 'Adresseproblem',
  };

  return (
    <div className="mx-4 mb-3 rounded-xl border border-sky-200 bg-sky-50/60">
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <TrendingUp className="h-4 w-4 text-sky-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold text-sky-800">Tour-Feedback (7 Tage)</span>
          <span className="ml-2 text-xs text-sky-600">
            {data.totalFeedbacks} Bewertungen · Ø {data.avgOverallScore.toFixed(1)}★
          </span>
          {topIssue && (
            <span className="ml-2 text-[11px] text-amber-700 font-semibold">
              ⚠ {issueLabels[topIssue[0]]} {topIssue[1]}%
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-3.5 w-3.5 text-sky-500" /> : <ChevronDown className="h-3.5 w-3.5 text-sky-500" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2 pt-1">
            {[
              { label: 'Schwierigkeit', val: data.avgDifficulty },
              { label: 'Verkehr', val: data.avgTraffic },
              { label: 'Kunden', val: data.avgCustomer },
            ].map((k) => (
              <div key={k.label} className="rounded-lg bg-white border border-sky-100 p-2 text-center">
                <div className="text-xs font-black"><StarRating value={k.val} /></div>
                <div className="text-[10px] text-muted-foreground mt-0.5">{k.label}</div>
              </div>
            ))}
          </div>

          {/* Issue rates */}
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(data.issueRates).map(([key, pct]) => (
              pct > 0 ? (
                <span
                  key={key}
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    pct > 25 ? 'bg-red-100 text-red-700' : pct > 10 ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
                  )}
                >
                  {issueLabels[key]}: {pct}%
                </span>
              ) : null
            ))}
          </div>

          {/* Recent feedbacks */}
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {data.recentFeedbacks.slice(0, 5).map((f) => (
              <div key={f.id} className="flex items-center gap-2 rounded-lg bg-white border border-sky-100 px-3 py-2">
                <Star className="h-3.5 w-3.5 text-sky-500 shrink-0" />
                <span className="text-xs font-semibold text-foreground flex-1 min-w-0 truncate">
                  {f.driver_name ?? 'Fahrer'}
                </span>
                <StarRating value={f.overall_score} />
                {(f.had_parking_issue || f.had_customer_issue) && (
                  <AlertCircle className="h-3 w-3 text-amber-500 shrink-0" />
                )}
                {f.driver_notes && (
                  <span className="text-[10px] text-muted-foreground max-w-[100px] truncate">
                    {f.driver_notes}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
