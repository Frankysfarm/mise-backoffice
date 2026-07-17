'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiData {
  team_index?: number;
  fahrer?: { quote_pct: number }[];
}

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase2136LieferverlässlichkeitsPill({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [index, setIndex]     = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    let active = true;

    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/admin/fahrer-touren-vollstaendigkeit?location_id=${locationId}`, { cache: 'no-store' });
        if (r.ok && active) {
          const d: ApiData = await r.json();
          const idx = d.team_index
            ?? (d.fahrer && d.fahrer.length > 0
              ? Math.round(d.fahrer.reduce((s, f) => s + f.quote_pct, 0) / d.fahrer.length)
              : null);
          setIndex(idx);
        }
      } catch { /* ignore */ }
    };

    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => { active = false; clearInterval(id); };
  }, [mounted, locationId]);

  if (!mounted || index === null || index < 85) return null;

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1',
      'bg-blue-50 border-blue-200 text-blue-800',
      className,
    )}>
      <ShieldCheck className="h-3 w-3 text-blue-500 shrink-0" />
      <span className="text-[11px] font-semibold">{index} von 100 Bestellungen pünktlich & vollständig</span>
    </div>
  );
}
