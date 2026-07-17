'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string;
  className?: string;
}

const MIN_RATE = 90;

export function StorefrontPhase2111TourZuverlaessigkeitsBadge({ locationId, className }: Props) {
  const [mounted, setMounted]   = useState(false);
  const [rate, setRate]         = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;

    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/admin/fahrer-touren-vollstaendigkeit?location_id=${locationId}`, { cache: 'no-store' });
        if (r.ok) {
          const d = await r.json();
          const fahrer: { quote_pct: number }[] = d.fahrer ?? [];
          if (fahrer.length === 0) return;
          const avg = fahrer.reduce((s: number, f: { quote_pct: number }) => s + f.quote_pct, 0) / fahrer.length;
          setRate(Math.round(avg));
        }
      } catch { /* hide badge on error */ }
    };

    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [mounted, locationId]);

  if (!mounted || rate === null || rate < MIN_RATE) return null;

  return (
    <div className={cn('flex items-center gap-1.5 rounded-full border border-matcha-200 bg-matcha-50 px-3 py-1 text-xs font-semibold text-matcha-700', className)}>
      <CheckCircle2 className="h-3.5 w-3.5 text-matcha-500 shrink-0" />
      <span>{rate}% Lieferungen heute pünktlich</span>
    </div>
  );
}
