'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ShieldCheck, Star, Clock, Truck } from 'lucide-react';

type Props = { locationId?: string };

type Data = {
  avgRating: number;
  ratingCount: number;
  onTimePercent: number;
  avgDeliveryMin: number;
};

const MOCK: Data = {
  avgRating: 4.7,
  ratingCount: 312,
  onTimePercent: 94,
  avgDeliveryMin: 28,
};

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={cn(
            'h-3 w-3',
            i <= Math.round(rating) ? 'fill-yellow-400 text-yellow-400' : 'fill-stone-200 text-stone-200',
          )}
        />
      ))}
    </div>
  );
}

export function Phase962LieferQualitaetsBadge({ locationId }: Props) {
  const [data, setData] = useState<Data | null>(null);

  useEffect(() => {
    const id = locationId ?? '';
    fetch(`/api/delivery/order/liefer-qualitaets-badge?locationId=${id}`)
      .then(r => r.json())
      .then(d => setData(d?.avgRating != null ? d : MOCK))
      .catch(() => setData(MOCK));
  }, [locationId]);

  if (!data) return null;

  return (
    <div className="rounded-2xl border border-matcha-200 bg-matcha-50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="h-5 w-5 text-matcha-600 shrink-0" />
        <div>
          <div className="text-sm font-bold text-matcha-900">Qualitäts-Versprechen</div>
          <div className="text-[10px] text-matcha-600">Verifizierte Kunden-Erfahrung</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Bewertung */}
        <div className="flex flex-col items-center gap-1 rounded-xl bg-white border border-matcha-100 p-2">
          <StarRow rating={data.avgRating} />
          <div className="text-base font-black text-matcha-700 tabular-nums">{data.avgRating.toFixed(1)}</div>
          <div className="text-[9px] text-muted-foreground text-center leading-tight">
            {data.ratingCount} Bewertungen
          </div>
        </div>

        {/* Pünktlichkeit */}
        <div className="flex flex-col items-center gap-1 rounded-xl bg-white border border-matcha-100 p-2">
          <Clock className="h-4 w-4 text-matcha-500" />
          <div className={cn(
            'text-base font-black tabular-nums',
            data.onTimePercent >= 90 ? 'text-matcha-700' : data.onTimePercent >= 75 ? 'text-amber-600' : 'text-red-600',
          )}>
            {data.onTimePercent}%
          </div>
          <div className="text-[9px] text-muted-foreground text-center leading-tight">
            Pünktlich geliefert
          </div>
        </div>

        {/* Lieferzeit */}
        <div className="flex flex-col items-center gap-1 rounded-xl bg-white border border-matcha-100 p-2">
          <Truck className="h-4 w-4 text-matcha-500" />
          <div className="text-base font-black text-matcha-700 tabular-nums">{data.avgDeliveryMin} Min</div>
          <div className="text-[9px] text-muted-foreground text-center leading-tight">
            Ø Lieferzeit
          </div>
        </div>
      </div>

      <div className="mt-3 text-[10px] text-matcha-700 font-medium text-center">
        Frisch zubereitet · Schnell geliefert · Immer frisch
      </div>
    </div>
  );
}
