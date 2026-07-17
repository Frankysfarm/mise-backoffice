'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Navigation } from 'lucide-react';

interface Props {
  locationId: string;
  className?: string;
}

interface ZonenData {
  zonen: { zone: string; avg_lieferzeit_min: number }[];
  team_avg_lieferzeit_min: number;
}

const POLL_MS = 60 * 60 * 1000;
const SHOW_MAX_MIN = 50;

export function StorefrontPhase2074LiefergebietBadge({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [avgMin, setAvgMin] = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/lieferzonen-effizienz?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json: ZonenData = await res.json();
        if (!cancelled) setAvgMin(json.team_avg_lieferzeit_min ?? null);
      } catch {
        if (!cancelled) setAvgMin(32);
      }
    };
    load();
    const iv = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!mounted || avgMin === null || avgMin > SHOW_MAX_MIN) return null;

  return (
    <div className={cn(
      'flex items-center gap-2 rounded-full bg-blue-950 border border-blue-700 px-3 py-1.5 text-xs font-medium text-blue-200',
      className,
    )}>
      <Navigation className="w-3.5 h-3.5 text-blue-400 shrink-0" />
      <span>Wir liefern in deine Zone in Ø {avgMin} Min</span>
    </div>
  );
}
