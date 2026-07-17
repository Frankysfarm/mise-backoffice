'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiData {
  aktive_fahrer: number;
}

export function StorefrontPhase2204SchichtEndeBanner({
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
          `/api/delivery/admin/fahrer-schicht-bilanz?location_id=${locationId}`
        );
        if (res.ok && !cancelled) setData(await res.json());
      } catch {
        // ignore
      }
    }

    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [locationId]);

  if (!mounted || !data) return null;
  // Show only when no active drivers (shift change in progress)
  if (data.aktive_fahrer > 0) return null;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-full px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-400',
        className
      )}
    >
      <Users className="w-3.5 h-3.5" />
      <span>Neue Fahrer übernehmen jetzt — kurze Übergabe läuft</span>
    </div>
  );
}
