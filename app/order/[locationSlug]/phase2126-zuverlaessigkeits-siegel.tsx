'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface PuenktlichkeitData {
  team_durchschnitt: number;
}

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase2126ZuverlaessigkeitsSiegel({ locationId, className }: Props) {
  const [mounted, setMounted]        = useState(false);
  const [puenktlich, setPuenktlich]  = useState<PuenktlichkeitData | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/admin/fahrer-puenktlichkeit?location_id=${locationId}`, { cache: 'no-store' });
        if (r.ok) setPuenktlich(await r.json());
      } catch { /* silent */ }
    };
    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [mounted, locationId]);

  if (!mounted || !puenktlich) return null;
  if (puenktlich.team_durchschnitt < 90) return null;

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 text-[11px] font-semibold rounded-full px-2.5 py-0.5 border bg-emerald-50 text-emerald-700 border-emerald-200',
      className
    )}>
      <span className="text-[10px]">✓</span>
      Lieferung garantiert — {puenktlich.team_durchschnitt.toFixed(0)}% Zuverlässigkeit
    </span>
  );
}
