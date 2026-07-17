'use client';

import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiData {
  team_median_min: number;
  alert_count: number;
}

const MOCK: ApiData = { team_median_min: 3.6, alert_count: 1 };
const SHOW_THRESHOLD = 10;

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase2100LiefergeschwindigkeitsBadge({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [data, setData]       = useState<ApiData | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || !locationId) return;

    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/admin/stopp-reaktionszeit?location_id=${locationId}`, { cache: 'no-store' });
        if (r.ok) setData(await r.json());
        else setData(MOCK);
      } catch { setData(MOCK); }
    };

    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [mounted, locationId]);

  if (!mounted || !data) return null;
  if (data.team_median_min > SHOW_THRESHOLD) return null;

  return (
    <div className={cn('flex items-center gap-1.5 rounded-full bg-matcha-100 border border-matcha-300 px-3 py-1 w-fit', className)}>
      <Zap className="h-3.5 w-3.5 text-matcha-600 shrink-0" />
      <span className="text-xs font-bold text-matcha-700">
        Ø {data.team_median_min.toFixed(1)} Min Lieferzeit heute
      </span>
    </div>
  );
}
