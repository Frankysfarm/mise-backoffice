'use client';

import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StorefrontPhase2156LiefergebietSiegel({
  locationId,
  className,
}: {
  locationId: string;
  className?: string;
}) {
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let active = true;

    const computeRadius = (d: { fahrer?: { km_heute: number }[] }) => {
      const fahrer = d.fahrer ?? [];
      if (!fahrer.length) return;
      const avg = fahrer.reduce((s, f) => s + f.km_heute, 0) / fahrer.length;
      const radius = Math.round(avg / 10);
      if (active) setRadiusKm(radius > 0 ? radius : null);
    };

    const load = () =>
      fetch(`/api/delivery/admin/fahrer-tageskilometer?location_id=${locationId}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then(computeRadius)
        .catch(() => {});

    load();
    const t = setInterval(load, 4 * 60 * 60 * 1000);
    return () => { active = false; clearInterval(t); };
  }, [locationId]);

  if (!mounted || !radiusKm) return null;

  return (
    <div className={cn('inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-400', className)}>
      <MapPin className="h-3 w-3" />
      Liefert in deiner Nähe · bis {radiusKm} km
    </div>
  );
}
