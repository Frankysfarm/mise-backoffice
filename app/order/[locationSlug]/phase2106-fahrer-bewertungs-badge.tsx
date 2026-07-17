'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string;
  className?: string;
}

const MIN_SCORE = 4.5;

export function StorefrontPhase2106FahrerBewertungsBadge({ locationId, className }: Props) {
  const [mounted, setMounted]     = useState(false);
  const [score, setScore]         = useState<number | null>(null);
  const [topFahrer, setTopFahrer] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;

    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/admin/kunden-feedback-score?location_id=${locationId}`, { cache: 'no-store' });
        if (r.ok) {
          const d = await r.json();
          setScore(d.team_avg_score ?? null);
          setTopFahrer(d.top_fahrer ?? null);
        }
      } catch { /* hide badge on error */ }
    };

    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [mounted, locationId]);

  if (!mounted || score === null || score < MIN_SCORE) return null;

  return (
    <div className={cn('flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700', className)}>
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shrink-0" />
      <span>Unsere Fahrer: ★ {score.toFixed(1)}</span>
      {topFahrer && <span className="text-amber-500 font-normal">· Bester: {topFahrer}</span>}
    </div>
  );
}
