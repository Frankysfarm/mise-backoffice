'use client';
import { useEffect, useState } from 'react';
import { Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonthEntry {
  month: string;
  avgCustomerRating: number;
  totalFeedbacks: number;
}

export function KitchenFeedbackTrendMini() {
  const [trend, setTrend] = useState<MonthEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const res = await fetch('/api/delivery/admin/tour-feedback-analytics?action=report&months=2');
      if (!res.ok) return;
      const json = await res.json() as { trend?: MonthEntry[] };
      setTrend(json.trend ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (loading) return null;
  if (trend.length === 0) return null;

  const latest = trend[trend.length - 1];
  const prev = trend.length > 1 ? trend[trend.length - 2] : null;
  const rating = latest?.avgCustomerRating ?? 0;
  const delta = prev ? rating - prev.avgCustomerRating : 0;

  if (rating === 0) return null;

  const color = rating >= 4.5 ? 'emerald' : rating >= 3.5 ? 'amber' : 'red';
  const TrendIcon = delta > 0.05 ? TrendingUp : delta < -0.05 ? TrendingDown : Minus;
  const trendColor = delta > 0.05 ? 'text-emerald-600' : delta < -0.05 ? 'text-red-500' : 'text-slate-400';

  const barWidth = (r: number) => Math.round((r / 5) * 100);

  return (
    <div className={cn(
      'rounded-xl border px-4 py-3 flex items-center gap-4',
      color === 'emerald' ? 'bg-emerald-50 border-emerald-200' :
      color === 'amber' ? 'bg-amber-50 border-amber-200' :
      'bg-red-50 border-red-200',
    )}>
      <Star className={cn('h-4 w-4 shrink-0', color === 'emerald' ? 'text-emerald-500' : color === 'amber' ? 'text-amber-500' : 'text-red-500')} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-700">Ø Kundenzufriedenheit (Tour-Feedback)</p>
        <div className="mt-1 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-white/60">
            <div
              className={cn('h-full rounded-full transition-all', color === 'emerald' ? 'bg-emerald-500' : color === 'amber' ? 'bg-amber-500' : 'bg-red-500')}
              style={{ width: `${barWidth(rating)}%` }}
            />
          </div>
          <span className={cn('text-sm font-bold', color === 'emerald' ? 'text-emerald-700' : color === 'amber' ? 'text-amber-700' : 'text-red-700')}>
            {rating.toFixed(1)}★
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1 text-xs font-medium shrink-0">
        <TrendIcon className={cn('h-3.5 w-3.5', trendColor)} />
        {delta !== 0 && (
          <span className={trendColor}>{delta > 0 ? '+' : ''}{delta.toFixed(1)}</span>
        )}
      </div>
      <span className="text-xs text-slate-400 shrink-0">{latest.totalFeedbacks} Bewertungen</span>
    </div>
  );
}
