'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiData {
  team_durchschnitt: number;
}

export function StorefrontPhase2191TopFahrerSiegel({
  locationId,
  className,
}: {
  locationId: string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    setMounted(true);
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(
          `/api/delivery/admin/fahrer-feedback-score?location_id=${locationId}`
        );
        if (res.ok && !cancelled) setData(await res.json());
      } catch {
        // ignore
      }
    }

    load();
    const id = setInterval(load, 2 * 60 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [locationId]);

  if (!mounted || !data) return null;
  if (data.team_durchschnitt < 4.5) return null;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-full px-3 py-1 text-xs font-medium text-yellow-700 dark:text-yellow-400',
        className
      )}
    >
      <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
      <span>Top-bewertetes Lieferteam · {data.team_durchschnitt.toFixed(1)} ⭐</span>
    </div>
  );
}
