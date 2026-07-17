'use client';

import { useEffect, useState } from 'react';
import { Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiData {
  team_avg_km?: number;
}

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase2156KlimafreundlichkeitsPill({ locationId, className }: Props) {
  const [mounted, setMounted]   = useState(false);
  const [avgKm, setAvgKm]       = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    let active = true;

    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/admin/fahrer-km-effizienz?location_id=${locationId}`, { cache: 'no-store' });
        if (r.ok && active) {
          const d: ApiData = await r.json();
          if (typeof d.team_avg_km === 'number') setAvgKm(d.team_avg_km);
        }
      } catch { /* ignore */ }
    };

    load();
    const id = setInterval(load, 2 * 60 * 60 * 1000);
    return () => { active = false; clearInterval(id); };
  }, [mounted, locationId]);

  if (!mounted || avgKm === null || avgKm > 5) return null;

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1',
      'bg-green-50 border-green-200 text-green-800',
      className,
    )}>
      <Leaf className="h-3 w-3 fill-green-500 text-green-500 shrink-0" />
      <span className="text-[11px] font-semibold">Ø {avgKm.toFixed(1)} km je Lieferung</span>
    </div>
  );
}
