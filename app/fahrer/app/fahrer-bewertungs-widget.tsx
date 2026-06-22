'use client';

/**
 * FahrerBewertungsWidget — Phase 418
 *
 * Mini-Widget für Fahrer-App: zeigt eigene Kundenbewertung.
 * - Ø Sternebewertung (letzte 30 Tage)
 * - Anzahl Bewertungen
 * - Trend (vs. Vorwoche)
 * - 10-Min-Polling
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Bewertung {
  avgRating:     number;
  totalRatings:  number;
  positiveCount: number;
  negativeCount: number;
  fiveStarCount: number;
  trend:         'up' | 'stable' | 'down';
  trendDelta:    number;
  lastRatingAt:  string | null;
}

interface Props {
  driverId:   string;
  locationId: string;
}

export function FahrerBewertungsWidget({ driverId, locationId }: Props) {
  const [data, setData] = useState<Bewertung | null>(null);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!driverId || !locationId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/kunden-feedback-engine?location_id=${encodeURIComponent(locationId)}&driver_id=${encodeURIComponent(driverId)}&days=30`,
      );
      if (!res.ok) return;
      const d = await res.json() as { bewertung?: Bewertung };
      if (d.bewertung) setData(d.bewertung);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [driverId, locationId]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 10 * 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  if (!data && !loading) return null;
  if (!data) {
    return <div className="h-16 rounded-2xl bg-white/10 animate-pulse" />;
  }

  const TrendIcon = data.trend === 'up' ? TrendingUp : data.trend === 'down' ? TrendingDown : Minus;
  const trendColor = data.trend === 'up' ? 'text-green-400' : data.trend === 'down' ? 'text-red-400' : 'text-gray-400';
  const ratingColor = data.avgRating >= 4.5 ? 'text-green-400' : data.avgRating >= 4.0 ? 'text-emerald-400' : data.avgRating >= 3.5 ? 'text-yellow-400' : data.avgRating >= 3.0 ? 'text-orange-400' : 'text-red-400';

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 flex items-center gap-3">
      {/* Rating-Block */}
      <div className="flex flex-col items-center shrink-0">
        <div className={cn('text-3xl font-black tabular-nums leading-none', ratingColor)}>
          {data.avgRating.toFixed(1)}
        </div>
        <div className="flex gap-0.5 mt-1">
          {[1, 2, 3, 4, 5].map((s) => (
            <Star
              key={s}
              className={cn(
                'h-2.5 w-2.5',
                s <= Math.round(data.avgRating) ? 'fill-yellow-400 text-yellow-400' : 'text-gray-600',
              )}
            />
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="h-10 w-px bg-white/10 shrink-0" />

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-bold text-white">Kundenbewertung</div>
        <div className="text-[11px] text-gray-400">{data.totalRatings} Bewertung{data.totalRatings !== 1 ? 'en' : ''} (30 Tage)</div>
        <div className="flex gap-2 mt-1">
          <span className="text-[10px] font-semibold text-green-400">+{data.positiveCount} gut</span>
          {data.negativeCount > 0 && (
            <span className="text-[10px] font-semibold text-red-400">-{data.negativeCount} schlecht</span>
          )}
        </div>
      </div>

      {/* Trend */}
      <div className={cn('flex flex-col items-center shrink-0', trendColor)}>
        <TrendIcon className="h-4 w-4" />
        <span className="text-[10px] font-bold tabular-nums mt-0.5">
          {data.trendDelta > 0 ? '+' : ''}{data.trendDelta}
        </span>
      </div>
    </div>
  );
}
