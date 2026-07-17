'use client';

import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiData {
  gesamt_avg_min?: number;
}

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase2141SchnellLieferungsSiegel({ locationId, className }: Props) {
  const [mounted, setMounted]     = useState(false);
  const [avgMin, setAvgMin]       = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    let active = true;

    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/admin/durchschnittsliefer-zeit?location_id=${locationId}`, { cache: 'no-store' });
        if (r.ok && active) {
          const d: ApiData = await r.json();
          if (typeof d.gesamt_avg_min === 'number') setAvgMin(d.gesamt_avg_min);
        }
      } catch { /* ignore */ }
    };

    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => { active = false; clearInterval(id); };
  }, [mounted, locationId]);

  if (!mounted || avgMin === null || avgMin > 30) return null;

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1',
      'bg-amber-50 border-amber-200 text-amber-800',
      className,
    )}>
      <Zap className="h-3 w-3 text-amber-500 shrink-0" />
      <span className="text-[11px] font-semibold">Ø {Math.round(avgMin)} Min. Lieferzeit heute</span>
    </div>
  );
}
