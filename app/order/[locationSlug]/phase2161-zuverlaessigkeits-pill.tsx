'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiData {
  team_avg_sigma?: number;
}

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase2161ZuverlaessigkeitsPill({ locationId, className }: Props) {
  const [mounted, setMounted]     = useState(false);
  const [teamSigma, setTeamSigma] = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    let active = true;

    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/admin/fahrer-lieferzeit-varianz?location_id=${locationId}`, { cache: 'no-store' });
        if (r.ok && active) {
          const d: ApiData = await r.json();
          if (typeof d.team_avg_sigma === 'number') setTeamSigma(d.team_avg_sigma);
        }
      } catch { /* ignore */ }
    };

    load();
    const id = setInterval(load, 2 * 60 * 60 * 1000);
    return () => { active = false; clearInterval(id); };
  }, [mounted, locationId]);

  if (!mounted || teamSigma === null || teamSigma > 5) return null;

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1',
      'bg-green-50 border-green-200 text-green-800',
      className,
    )}>
      <Clock className="h-3 w-3 shrink-0 text-green-600" />
      <span className="text-[11px] font-semibold">Pünktlich wie ein Uhrwerk</span>
    </div>
  );
}
