'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Leaf } from 'lucide-react';

interface Props {
  locationId: string;
  className?: string;
}

interface RoutenEffizienzData {
  team_avg_km: number;
}

const POLL_MS = 30 * 60 * 1000;
const DEFAULT_AVG_KM = 5.5;
const SHOW_THRESHOLD_KM = 10;

export function StorefrontPhase2068NachhaltigkeitsBadge({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [avgKm, setAvgKm] = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-routen-effizienz?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json: RoutenEffizienzData = await res.json();
        if (!cancelled) setAvgKm(json.team_avg_km ?? DEFAULT_AVG_KM);
      } catch {
        if (!cancelled) setAvgKm(DEFAULT_AVG_KM);
      }
    };

    load();
    const iv = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!mounted || avgKm === null || avgKm > SHOW_THRESHOLD_KM) return null;

  return (
    <div className={cn(
      'flex items-center gap-2 rounded-full bg-green-950 border border-green-700 px-3 py-1.5 text-xs font-medium text-green-200',
      className,
    )}>
      <Leaf className="w-3.5 h-3.5 text-green-400 shrink-0" />
      <span>Kurze Lieferwege · Ø {avgKm} km</span>
    </div>
  );
}
