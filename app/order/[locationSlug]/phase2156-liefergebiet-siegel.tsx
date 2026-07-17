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
    fetch(`/api/delivery/admin/fahrer-tageskilometer?location_id=${locationId}`)
      .then((r) => r.json())
      .then((d) => {
        const drivers: any[] = d.drivers ?? [];
        if (!drivers.length) return;
        const avg = drivers.reduce((s, dr) => s + dr.km_heute, 0) / drivers.length;
        // Radius = avg / Touren (grobe Schätzung: 10 Stopps/Tag)
        const radius = Math.round(avg / 10);
        setRadiusKm(radius > 0 ? radius : null);
      })
      .catch(() => {});
    const t = setInterval(
      () =>
        fetch(`/api/delivery/admin/fahrer-tageskilometer?location_id=${locationId}`)
          .then((r) => r.json())
          .then((d) => {
            const drivers: any[] = d.drivers ?? [];
            if (!drivers.length) return;
            const avg = drivers.reduce((s, dr) => s + dr.km_heute, 0) / drivers.length;
            const radius = Math.round(avg / 10);
            setRadiusKm(radius > 0 ? radius : null);
          })
          .catch(() => {}),
      4 * 60 * 60 * 1000
    );
    return () => clearInterval(t);
  }, [locationId]);

  if (!mounted || !radiusKm) return null;

  return (
    <div className={cn('inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-400', className)}>
      <MapPin className="h-3 w-3" />
      Liefert in deiner Nähe · bis {radiusKm} km
    </div>
  );
}
