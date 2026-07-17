'use client';

import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiData {
  team_durchschnitt?: number;
  fahrer?: { anzahl_bewertungen: number }[];
}

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase2146BewertungsSiegel({ locationId, className }: Props) {
  const [mounted, setMounted]   = useState(false);
  const [avg, setAvg]           = useState<number | null>(null);
  const [count, setCount]       = useState<number>(0);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    let active = true;

    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/admin/fahrer-feedback-score?location_id=${locationId}`, { cache: 'no-store' });
        if (r.ok && active) {
          const d: ApiData = await r.json();
          if (typeof d.team_durchschnitt === 'number') setAvg(d.team_durchschnitt);
          const total = (d.fahrer ?? []).reduce((s, f) => s + f.anzahl_bewertungen, 0);
          setCount(total);
        }
      } catch { /* ignore */ }
    };

    load();
    const id = setInterval(load, 2 * 60 * 60 * 1000);
    return () => { active = false; clearInterval(id); };
  }, [mounted, locationId]);

  if (!mounted || avg === null || avg < 4.0) return null;

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1',
      'bg-amber-50 border-amber-200 text-amber-800',
      className,
    )}>
      <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />
      <span className="text-[11px] font-semibold">★ {avg.toFixed(1)} von Kunden bewertet</span>
      {count > 0 && (
        <span className="text-[10px] text-amber-600">({count})</span>
      )}
    </div>
  );
}
