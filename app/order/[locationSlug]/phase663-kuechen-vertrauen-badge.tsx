'use client';

import { useEffect, useState } from 'react';
import { Star, Clock, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RatingData {
  avg_rating: number;
  total_count: number;
  positive_pct: number;
}

interface KapazitaetData {
  signal: 'grün' | 'gelb' | 'rot';
  prognoseWarteMin: number;
}

interface Props {
  locationId: string;
}

export function Phase663KuechenVertrauenBadge({ locationId }: Props) {
  const [rating, setRating] = useState<RatingData | null>(null);
  const [kapazitaet, setKapazitaet] = useState<KapazitaetData | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let active = true;

    async function load() {
      try {
        const [ratingRes, kapRes] = await Promise.all([
          fetch(`/api/delivery/admin/kundenbewertungs-aggregation?location_id=${locationId}&days=30`),
          fetch(`/api/delivery/admin/kuechen-kapazitaets-warnsignal?location_id=${locationId}`),
        ]);
        const ratingJson = await ratingRes.json() as { avg_rating?: number; total_count?: number; positive_pct?: number; ok?: boolean };
        const kapJson = await kapRes.json() as KapazitaetData & { ok?: boolean };

        if (!active) return;
        if (ratingJson.avg_rating !== undefined) {
          setRating({
            avg_rating: ratingJson.avg_rating,
            total_count: ratingJson.total_count ?? 0,
            positive_pct: ratingJson.positive_pct ?? 0,
          });
        }
        if (kapJson.signal) setKapazitaet(kapJson);
      } catch {
        // noop
      }
    }

    load();
    const timer = setInterval(load, 180_000);
    return () => { active = false; clearInterval(timer); };
  }, [locationId]);

  if (!rating && !kapazitaet) return null;

  const avgRating = rating?.avg_rating ?? 0;
  const isGoodRating = avgRating >= 4.0;
  const isFastKitchen = kapazitaet?.signal !== 'rot';
  const showBadge = isGoodRating || isFastKitchen;
  if (!showBadge) return null;

  const signalLabel: Record<string, string> = {
    grün: 'Küche frei',
    gelb: 'Küche mittel ausgelastet',
    rot: 'Küche stark ausgelastet',
  };
  const signalColor: Record<string, string> = {
    grün: 'text-emerald-600',
    gelb: 'text-amber-600',
    rot: 'text-red-600',
  };

  return (
    <div className="flex flex-wrap gap-2 items-center my-2">
      {isGoodRating && rating && (
        <div className="flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          <span className="text-xs font-bold text-amber-700">
            {avgRating.toFixed(1)} / 5
          </span>
          <span className="text-[10px] text-amber-500">
            ({rating.total_count} Bewertungen)
          </span>
        </div>
      )}

      {kapazitaet && isFastKitchen && (
        <div className={cn(
          'flex items-center gap-1.5 rounded-full border px-3 py-1.5',
          kapazitaet.signal === 'grün'
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-amber-50 border-amber-200'
        )}>
          <Clock className={cn('h-3.5 w-3.5', signalColor[kapazitaet.signal] ?? 'text-stone-500')} />
          <span className={cn('text-xs font-bold', signalColor[kapazitaet.signal] ?? 'text-stone-700')}>
            {signalLabel[kapazitaet.signal] ?? 'Küche aktiv'}
          </span>
          {kapazitaet.prognoseWarteMin > 0 && (
            <span className="text-[10px] text-stone-500">
              ca. {kapazitaet.prognoseWarteMin} Min
            </span>
          )}
        </div>
      )}

      {isGoodRating && rating && rating.positive_pct >= 85 && (
        <div className="flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1.5">
          <Shield className="h-3.5 w-3.5 text-blue-600" />
          <span className="text-xs font-bold text-blue-700">
            {Math.round(rating.positive_pct)}% Zufriedenheit
          </span>
        </div>
      )}
    </div>
  );
}
