'use client';

import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiData {
  stopps: {
    delta_gestern_pct: number;
  };
}

export function StorefrontPhase2209PerformanceSiegel({
  locationId,
  className,
}: {
  locationId: string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [delta, setDelta] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/schicht-vergleich?location_id=${locationId}`);
        if (!res.ok) return;
        const d: ApiData = await res.json();
        setDelta(d.stopps.delta_gestern_pct);
      } catch { /* ignore */ }
    };
    load();
    const id = setInterval(load, 2 * 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!mounted || delta === null || delta <= 10) return null;

  return (
    <div className={cn('inline-flex items-center gap-1.5 rounded-full bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 px-3 py-1', className)}>
      <TrendingUp className="w-3.5 h-3.5 text-green-600" />
      <span className="text-xs font-semibold text-green-700 dark:text-green-300">
        Heute +{delta.toFixed(0)}% mehr Lieferungen als gestern
      </span>
    </div>
  );
}
