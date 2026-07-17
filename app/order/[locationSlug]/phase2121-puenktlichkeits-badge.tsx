'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface ApiData {
  team_durchschnitt: number;
}

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase2121PuenktlichkeitsBadge({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [data, setData]       = useState<ApiData | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/admin/fahrer-puenktlichkeit?location_id=${locationId}`, { cache: 'no-store' });
        if (r.ok) setData(await r.json());
      } catch { /* silent */ }
    };
    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [mounted, locationId]);

  if (!mounted || !data || data.team_durchschnitt < 90) return null;

  const pct = Math.round(data.team_durchschnitt);

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-0.5 border bg-green-50 text-green-700 border-green-200',
      className
    )}>
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
      {pct}% der Lieferungen pünktlich heute
    </span>
  );
}
