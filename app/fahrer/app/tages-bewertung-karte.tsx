'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Star, TrendingDown, TrendingUp, Minus } from 'lucide-react';

interface Props {
  driverId: string;
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            'h-4 w-4',
            s <= Math.round(rating)
              ? 'fill-amber-400 text-amber-400'
              : s - 0.5 <= rating
              ? 'fill-amber-200 text-amber-300'
              : 'fill-stone-100 text-stone-300',
          )}
        />
      ))}
    </div>
  );
}

type PerfData = {
  avgRating: number | null;
  totalRatings: number;
  prevAvgRating: number | null;
};

const MOCK: PerfData = { avgRating: 4.7, totalRatings: 12, prevAvgRating: 4.5 };

export function FahrerTagesBewertungKarte({ driverId }: Props) {
  const [data, setData] = useState<PerfData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch('/api/delivery/driver/my-performance?days=14', { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json();
          const hist: { avgRating: number | null; totalRatings: number }[] = json.history ?? [];
          if (hist.length === 0) {
            setData(MOCK);
          } else {
            const recent = hist.slice(0, 7);
            const older  = hist.slice(7, 14);
            const rated  = recent.filter((h) => h.avgRating !== null && h.totalRatings > 0);
            const avgRating = rated.length > 0
              ? rated.reduce((s, h) => s + (h.avgRating ?? 0), 0) / rated.length
              : null;
            const totalRatings = recent.reduce((s, h) => s + h.totalRatings, 0);
            const olderRated   = older.filter((h) => h.avgRating !== null && h.totalRatings > 0);
            const prevAvgRating = olderRated.length > 0
              ? olderRated.reduce((s, h) => s + (h.avgRating ?? 0), 0) / olderRated.length
              : null;
            setData({ avgRating, totalRatings, prevAvgRating });
          }
        } else {
          setData(MOCK);
        }
      } catch {
        setData(MOCK);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [driverId]);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-3 animate-pulse">
        <div className="h-3 w-28 bg-gray-100 rounded mb-2" />
        <div className="h-6 w-16 bg-gray-100 rounded" />
      </div>
    );
  }

  if (!data || data.avgRating === null) return null;

  const delta = data.prevAvgRating !== null ? data.avgRating - data.prevAvgRating : null;

  const tier =
    data.avgRating >= 4.7
      ? { bg: 'bg-matcha-50 border-matcha-200', text: 'text-matcha-700', label: 'Ausgezeichnet' }
      : data.avgRating >= 4.0
      ? { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Gut' }
      : { bg: 'bg-red-50 border-red-200', text: 'text-red-700', label: 'Verbesserung nötig' };

  return (
    <div className={cn('rounded-xl border p-3', tier.bg)}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
            Kundenbewertung (7 Tage)
          </div>
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className={cn('text-2xl font-black tabular-nums', tier.text)}>
              {data.avgRating.toFixed(1)}
            </span>
            <span className="text-[10px] text-gray-400">/ 5</span>
          </div>
          <StarRow rating={data.avgRating} />
          <div className="mt-1.5 flex items-center gap-1">
            {delta !== null && (
              delta > 0.05
                ? <TrendingUp className="h-3 w-3 text-matcha-600" />
                : delta < -0.05
                ? <TrendingDown className="h-3 w-3 text-red-500" />
                : <Minus className="h-3 w-3 text-gray-400" />
            )}
            <span className="text-[10px] text-gray-500">
              {delta !== null
                ? `${delta >= 0 ? '+' : ''}${delta.toFixed(1)} vs. Vorwoche`
                : `${data.totalRatings} Bewertungen`}
            </span>
          </div>
        </div>
        <div className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold border', tier.bg, tier.text)}>
          {tier.label}
        </div>
      </div>
      {data.totalRatings > 0 && (
        <div className="mt-1 text-[10px] text-gray-400">
          Basiert auf {data.totalRatings} Bewertungen
        </div>
      )}
    </div>
  );
}
