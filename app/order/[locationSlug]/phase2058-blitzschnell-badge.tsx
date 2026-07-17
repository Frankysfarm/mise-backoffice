'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Zap } from 'lucide-react';

interface Props {
  locationId: string;
  className?: string;
}

const POLL_MS = 60 * 60 * 1000;
const SHOW_THRESHOLD = 5;

export function StorefrontPhase2058BlitzschnellBadge({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const [avgMin, setAvgMin] = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/fahrer-reaktionszeit?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        const avg: number = json.team_avg_min ?? 99;
        if (!cancelled) {
          setAvgMin(avg);
          setShow(avg <= SHOW_THRESHOLD);
        }
      } catch {
        if (!cancelled) setShow(false);
      }
    };

    load();
    const iv = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!mounted || !show || avgMin === null) return null;

  return (
    <div className={cn(
      'flex items-center gap-1.5 rounded-full bg-yellow-950 border border-yellow-700 px-3 py-1 text-xs font-medium text-yellow-300',
      className,
    )}>
      <Zap className="w-3.5 h-3.5 text-yellow-400" />
      Blitzschnelle Abholung · Ø {avgMin} Min Reaktion
    </div>
  );
}
