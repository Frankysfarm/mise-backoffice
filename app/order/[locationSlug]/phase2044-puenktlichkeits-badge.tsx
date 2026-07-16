'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Clock } from 'lucide-react';

interface Props {
  locationId: string;
  className?: string;
}

const POLL_MS = 60 * 60 * 1000;
const SHOW_THRESHOLD = 90;

export function StorefrontPhase2044PuenktlichkeitsBadge({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/schicht-puenktlichkeits-score?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        const avg: number = json.team_avg ?? 0;
        if (!cancelled) {
          setRate(avg);
          setShow(avg >= SHOW_THRESHOLD);
        }
      } catch {
        if (!cancelled) setShow(false);
      }
    };

    load();
    const iv = setInterval(load, POLL_MS);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!mounted || !show || rate === null) return null;

  return (
    <div className={cn(
      'flex items-center gap-1.5 rounded-full bg-blue-950 border border-blue-700 px-3 py-1 text-xs font-medium text-blue-300',
      className,
    )}>
      <Clock className="w-3.5 h-3.5 text-blue-400" />
      {rate}% pünktliche Lieferungen
    </div>
  );
}
