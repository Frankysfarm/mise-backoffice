'use client';

/**
 * LieferdienstKundenzufriedenheitsPanel
 *
 * Zeigt die aktuelle Kundenzufriedenheit in Echtzeit:
 * Ø Rating, Anzahl Bewertungen, Trend, Verteilung nach Sternzahl,
 * sowie Freitext-Kategorien der letzten Rückmeldungen.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Star, TrendingUp, TrendingDown, Minus, MessageSquare, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RatingBucket {
  stars: number;
  count: number;
  pct: number;
}

interface RecentReview {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
}

interface Stats {
  avgRating: number;
  totalCount: number;
  trend: 'up' | 'down' | 'neutral';
  trendDelta: number;
  buckets: RatingBucket[];
  recentReviews: RecentReview[];
  npsScore: number | null;
}

const MOCK_STATS: Stats = {
  avgRating: 0,
  totalCount: 0,
  trend: 'neutral',
  trendDelta: 0,
  buckets: [5, 4, 3, 2, 1].map((s) => ({ stars: s, count: 0, pct: 0 })),
  recentReviews: [],
  npsScore: null,
};

function StarBar({ bucket, maxCount }: { bucket: RatingBucket; maxCount: number }) {
  const COLORS: Record<number, string> = {
    5: 'bg-green-500', 4: 'bg-matcha-500', 3: 'bg-yellow-400', 2: 'bg-orange-400', 1: 'bg-red-500',
  };
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5 w-14 shrink-0">
        <span className="text-[11px] font-bold text-gray-700">{bucket.stars}</span>
        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
      </div>
      <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all', COLORS[bucket.stars] ?? 'bg-gray-300')}
          style={{ width: `${maxCount > 0 ? (bucket.count / maxCount) * 100 : 0}%` }}
        />
      </div>
      <div className="w-10 text-right text-[11px] font-bold tabular-nums text-gray-600 shrink-0">
        {bucket.count}
      </div>
    </div>
  );
}

function StarRating({ value }: { value: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            'h-3 w-3',
            s <= Math.round(value) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200',
          )}
        />
      ))}
    </div>
  );
}

export function LieferdienstKundenzufriedenheitsPanel({ locationId }: { locationId: string }) {
  const [stats, setStats] = useState<Stats>(MOCK_STATS);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const supabase = useRef(createClient()).current;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const since7d = new Date(now.getTime() - 7 * 24 * 60 * 60_000).toISOString();
      const since14d = new Date(now.getTime() - 14 * 24 * 60 * 60_000).toISOString();

      const [currentRes, prevRes, recentRes] = await Promise.all([
        supabase
          .from('customer_delivery_ratings')
          .select('rating, comment, created_at')
          .eq('location_id', locationId)
          .gte('created_at', since7d),
        supabase
          .from('customer_delivery_ratings')
          .select('rating')
          .eq('location_id', locationId)
          .gte('created_at', since14d)
          .lt('created_at', since7d),
        supabase
          .from('customer_delivery_ratings')
          .select('id, rating, comment, created_at')
          .eq('location_id', locationId)
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const current = (currentRes.data ?? []) as Array<{ rating: number; comment: string | null; created_at: string }>;
      const prev = (prevRes.data ?? []) as Array<{ rating: number }>;
      const recent = (recentRes.data ?? []) as RecentReview[];

      const avgCurrent = current.length
        ? current.reduce((s: number, r) => s + (r.rating ?? 0), 0) / current.length
        : 0;
      const avgPrev = prev.length
        ? prev.reduce((s: number, r) => s + (r.rating ?? 0), 0) / prev.length
        : 0;
      const delta = avgCurrent - avgPrev;

      const buckets = [5, 4, 3, 2, 1].map((stars) => {
        const count = current.filter((r) => r.rating === stars).length;
        return { stars, count, pct: current.length ? (count / current.length) * 100 : 0 };
      });

      const promoters = current.filter((r) => r.rating >= 5).length;
      const detractors = current.filter((r) => r.rating <= 2).length;
      const npsScore = current.length
        ? Math.round(((promoters - detractors) / current.length) * 100)
        : null;

      setStats({
        avgRating: Math.round(avgCurrent * 10) / 10,
        totalCount: current.length,
        trend: Math.abs(delta) < 0.05 ? 'neutral' : delta > 0 ? 'up' : 'down',
        trendDelta: Math.round(delta * 10) / 10,
        buckets,
        recentReviews: (recent as RecentReview[]),
        npsScore,
      });
      setLastUpdate(now);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [supabase]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  }, [load]);

  const maxBucketCount = Math.max(...stats.buckets.map((b) => b.count), 1);
  const TrendIcon = stats.trend === 'up' ? TrendingUp : stats.trend === 'down' ? TrendingDown : Minus;
  const trendColor = stats.trend === 'up' ? 'text-green-600' : stats.trend === 'down' ? 'text-red-500' : 'text-gray-400';

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-gray-50">
        <Star className="h-4 w-4 text-yellow-400 fill-yellow-400 shrink-0" />
        <span className="text-sm font-bold text-gray-800 uppercase tracking-wide">Kundenzufriedenheit</span>
        <span className="text-[10px] text-gray-400 ml-1">letzte 7 Tage</span>
        <button
          onClick={load}
          disabled={loading}
          className="ml-auto text-gray-400 hover:text-gray-600 transition"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Score Row */}
        <div className="flex items-center gap-4">
          <div className="flex flex-col items-center">
            <div className="text-4xl font-black text-gray-900 tabular-nums leading-none">
              {stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—'}
            </div>
            <StarRating value={stats.avgRating} />
            <div className="text-[10px] text-gray-400 mt-0.5">{stats.totalCount} Bewertungen</div>
          </div>

          <div className="flex-1 space-y-1">
            {stats.buckets.map((b) => (
              <StarBar key={b.stars} bucket={b} maxCount={maxBucketCount} />
            ))}
          </div>
        </div>

        {/* Trend + NPS */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-lg bg-gray-50 border px-3 py-1.5">
            <TrendIcon className={cn('h-4 w-4', trendColor)} />
            <span className={cn('text-sm font-bold tabular-nums', trendColor)}>
              {stats.trendDelta > 0 ? '+' : ''}{stats.trendDelta} vs. Vorwoche
            </span>
          </div>
          {stats.npsScore !== null && (
            <div className="flex items-center gap-1.5 rounded-lg bg-gray-50 border px-3 py-1.5">
              <span className="text-[11px] text-gray-500">NPS</span>
              <span className={cn(
                'text-sm font-black tabular-nums',
                stats.npsScore >= 50 ? 'text-green-600' : stats.npsScore >= 0 ? 'text-amber-600' : 'text-red-600',
              )}>
                {stats.npsScore > 0 ? '+' : ''}{stats.npsScore}
              </span>
            </div>
          )}
        </div>

        {/* Recent Reviews */}
        {stats.recentReviews.length > 0 && (
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Letzte Rückmeldungen
            </div>
            <div className="space-y-1.5">
              {stats.recentReviews.map((r) => (
                <div key={r.id} className="flex items-start gap-2 rounded-lg bg-gray-50 px-3 py-2">
                  <div className="flex gap-0.5 shrink-0 mt-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={cn(
                          'h-2.5 w-2.5',
                          s <= r.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200',
                        )}
                      />
                    ))}
                  </div>
                  {r.comment ? (
                    <p className="text-[11px] text-gray-600 line-clamp-2 flex-1">{r.comment}</p>
                  ) : (
                    <span className="text-[11px] text-gray-400 italic">Kein Kommentar</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {stats.totalCount === 0 && !loading && (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
            <MessageSquare className="h-4 w-4" />
            Keine Bewertungen in den letzten 7 Tagen.
          </div>
        )}
      </div>
    </div>
  );
}
