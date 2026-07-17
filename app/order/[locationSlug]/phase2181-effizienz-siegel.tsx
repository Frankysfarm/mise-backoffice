'use client';

import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiData {
  ok?: boolean;
  avgOrdersPerHour?: number;
}

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase2181EffizienzSiegel({ locationId, className }: Props) {
  const [mounted, setMounted]         = useState(false);
  const [avgOph, setAvgOph]           = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    let active = true;

    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/admin/fahrer-einsatz-effizienz?location_id=${locationId}`, { cache: 'no-store' });
        if (r.ok && active) {
          const d: ApiData = await r.json();
          if (typeof d.avgOrdersPerHour === 'number') setAvgOph(d.avgOrdersPerHour);
        }
      } catch { /* ignore */ }
    };

    load();
    const id = setInterval(load, 2 * 60 * 60 * 1000);
    return () => { active = false; clearInterval(id); };
  }, [mounted, locationId]);

  if (!mounted || avgOph === null || avgOph < 3.0) return null;

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1',
      'bg-green-50 border-green-200 text-green-800',
      className,
    )}>
      <Zap className="h-3 w-3 fill-green-400 text-green-400 shrink-0" />
      <span className="text-[11px] font-semibold">Schnell &amp; zuverlässig</span>
    </div>
  );
}
