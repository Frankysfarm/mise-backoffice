'use client';

import { useEffect, useState } from 'react';
import { Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  locationId: string;
}

interface BewertungsData {
  avg_rating: number;
  total_count: number;
  positive_pct: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  trend_delta: number;
}

function StarRow({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i < Math.round(rating)
              ? 'fill-amber-400 text-amber-400'
              : 'fill-muted text-muted-foreground/30'
          }`}
        />
      ))}
    </div>
  );
}

export function Phase650KundenbewertungsWidget({ locationId }: Props) {
  const [data, setData] = useState<BewertungsData | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const r = await fetch(
          `/api/delivery/admin/kundenbewertungs-aggregation?location_id=${locationId}`,
        );
        if (r.ok && !cancelled) {
          const json = await r.json();
          if (json.total_count > 0) setData(json);
        }
      } catch {
        // silent fail — widget hides if no data
      }
    }
    load();
    return () => { cancelled = true; };
  }, [locationId]);

  if (!data || data.total_count === 0) return null;

  const TrendIcon =
    data.trend === 'steigend' ? TrendingUp :
    data.trend === 'fallend' ? TrendingDown : Minus;

  const trendColor =
    data.trend === 'steigend' ? 'text-emerald-600 dark:text-emerald-400' :
    data.trend === 'fallend'  ? 'text-red-500 dark:text-red-400' :
    'text-muted-foreground';

  return (
    <div className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/10 px-4 py-3">
      <div className="flex flex-col items-center">
        <span className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums leading-none">
          {data.avg_rating.toFixed(1)}
        </span>
        <span className="text-[10px] text-muted-foreground mt-0.5">von 5</span>
      </div>

      <div className="flex flex-col gap-1">
        <StarRow rating={data.avg_rating} />
        <span className="text-[11px] text-muted-foreground">
          {data.total_count.toLocaleString('de-DE')} Bewertungen · {data.positive_pct}% positiv
        </span>
      </div>

      <div className={`ml-auto flex items-center gap-1 text-xs font-medium ${trendColor}`}>
        <TrendIcon className="h-3.5 w-3.5" />
        {data.trend === 'steigend' && `+${data.trend_delta}`}
        {data.trend === 'fallend' && data.trend_delta.toFixed(1)}
        {data.trend === 'stabil' && 'stabil'}
      </div>
    </div>
  );
}
