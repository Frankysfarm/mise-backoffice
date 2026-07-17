'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

function isRushHourNow(): boolean {
  const h = new Date().getHours();
  return (h >= 12 && h < 14) || (h >= 18 && h < 21);
}

export function StorefrontPhase2166RushHourWarnung({
  locationId,
  className,
}: {
  locationId: string;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const check = async () => {
      if (!isRushHourNow()) {
        setShow(false);
        return;
      }
      try {
        // Use lieferzeit-varianz API to check avg delivery time
        const res = await fetch(
          `/api/delivery/admin/fahrer-lieferzeit-varianz?location_id=${locationId}`,
        );
        const d = await res.json();
        const drivers: { varianz_min?: number }[] = d.drivers ?? [];
        if (!drivers.length) return;
        // If team has high variability (>15 min sigma), show rush-hour warning
        const avgSigma =
          drivers.reduce((s, dr) => s + (dr.varianz_min ?? 0), 0) / drivers.length;
        setShow(avgSigma > 15);
      } catch {
        // Show based on time alone if API fails
        setShow(isRushHourNow());
      }
    };

    check();
    const t = setInterval(check, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!mounted || !show) return null;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-700 dark:text-amber-400',
        className,
      )}
    >
      <Clock className="h-3 w-3" />
      Viele bestellen jetzt · Ggf. etwas längere Wartezeit
    </div>
  );
}
