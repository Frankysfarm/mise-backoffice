'use client';

import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StorefrontPhase2262EffizienzSiegel({
  locationId,
  className,
}: {
  locationId: string;
  className?: string;
}) {
  const [show, setShow] = useState(false);
  const [avgKm, setAvgKm] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    function load() {
      fetch(`/api/delivery/admin/fahrer-kilometerstand?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d) return;
          const avg: number = d.team_avg_km_tour ?? 99;
          setAvgKm(avg);
          setShow(avg < 5);
        })
        .catch(() => {});
    }

    load();
    const id = setInterval(load, 4 * 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [mounted, locationId]);

  if (!mounted || !show || avgKm === null) return null;

  return (
    <div className={cn('inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700 border border-green-200', className)}>
      <Zap className="h-3.5 w-3.5 shrink-0" />
      Kurze Wege, schnelle Lieferung
    </div>
  );
}
