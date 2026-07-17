'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiData {
  ok: boolean;
  teamAvgCancelRate: number;
}

export function StorefrontPhase2186ZuverlaessigkeitsSiegel({
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
        const res = await fetch(`/api/delivery/admin/fahrer-storno-analyse?location_id=${locationId}`);
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
  if (data.teamAvgCancelRate >= 5) return null;

  return (
    <div className={cn('inline-flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-full px-3 py-1 text-xs font-medium text-green-700 dark:text-green-400', className)}>
      <ShieldCheck className="w-3.5 h-3.5" />
      <span>{Math.round(100 - data.teamAvgCancelRate)}% Aufträge ohne Storno</span>
    </div>
  );
}
