'use client';

import { useEffect, useState } from 'react';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiData {
  team_avg_quote: number;
}

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase2131ErfolgsquotenBadge({ locationId, className }: Props) {
  const [mounted, setMounted]   = useState(false);
  const [quote, setQuote]       = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    let active = true;

    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/admin/tour-abschlussquote?location_id=${locationId}`, { cache: 'no-store' });
        if (r.ok && active) {
          const d: ApiData = await r.json();
          setQuote(d.team_avg_quote);
        }
      } catch { /* ignore */ }
    };

    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => { active = false; clearInterval(id); };
  }, [mounted, locationId]);

  if (!mounted || quote === null || quote < 90) return null;

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1',
      'bg-yellow-50 border-yellow-200 text-yellow-800',
      className,
    )}>
      <Trophy className="h-3 w-3 text-yellow-500 shrink-0" />
      <span className="text-[11px] font-semibold">{quote}% Aufträge erfolgreich abgeschlossen</span>
    </div>
  );
}
