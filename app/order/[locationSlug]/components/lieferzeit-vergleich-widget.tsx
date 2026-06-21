'use client';

import { useEffect, useState } from 'react';
import { BarChart2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  etaMinutes: number;
  locationSlug?: string;
}

export function LieferzeitVergleichWidget({ etaMinutes, locationSlug }: Props) {
  const [avgMin, setAvgMin] = useState<number | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ period: 'today' });
    if (locationSlug) params.set('slug', locationSlug);
    fetch(`/api/delivery/admin/stats?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        const avg = d?.avg_delivery_min ?? d?.today_stats?.avg_delivery_min ?? null;
        if (typeof avg === 'number' && avg > 0) setAvgMin(avg);
      })
      .catch(() => {});
  }, [locationSlug]);

  if (avgMin === null) return null;

  const diffMin = Math.round(avgMin - etaMinutes);
  const isFaster = diffMin > 2;
  const isSlower = diffMin < -2;
  const pct = avgMin > 0 ? Math.round(Math.abs(diffMin) / avgMin * 100) : 0;

  if (!isFaster && !isSlower) return null;

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm',
      isFaster
        ? 'border-matcha-200 bg-matcha-50 text-matcha-800'
        : 'border-amber-200 bg-amber-50 text-amber-800',
    )}>
      <BarChart2 className="h-4 w-4 shrink-0" />
      <div className="flex-1 min-w-0">
        {isFaster ? (
          <span className="font-semibold">
            {pct}% schneller als heute üblich ({avgMin} Min Ø)
          </span>
        ) : (
          <span className="font-semibold">
            Heute etwas länger — Ø liegt bei {avgMin} Min
          </span>
        )}
      </div>
    </div>
  );
}
