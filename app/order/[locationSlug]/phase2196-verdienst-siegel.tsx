'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiData {
  fahrer: { verdienst_eur: number }[];
  team_durchschnitt_eur: number;
}

export function StorefrontPhase2196VerdienstSiegel({
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
          `/api/delivery/admin/fahrer-einnahmen-performance?location_id=${locationId}`
        );
        if (res.ok && !cancelled) setData(await res.json());
      } catch {
        // ignore
      }
    }

    load();
    const id = setInterval(load, 4 * 60 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [locationId]);

  if (!mounted || !data) return null;
  // Show only when active drivers are earning well (team avg ≥ 50 EUR today)
  if (data.team_durchschnitt_eur < 50) return null;

  const aktiveFahrer = data.fahrer.filter((f) => f.verdienst_eur > 0).length;
  if (aktiveFahrer === 0) return null;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400',
        className
      )}
    >
      <Star className="w-3.5 h-3.5 fill-green-500 text-green-500" />
      <span>Top-Lieferteam aktiv · {aktiveFahrer} Fahrer im Einsatz</span>
    </div>
  );
}
