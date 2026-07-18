'use client';

import { useEffect, useState } from 'react';
import { Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StorefrontPhase2267AbholwartezeitSiegel({
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
  }, []);

  useEffect(() => {
    if (!mounted) return;

    function load() {
      fetch(`/api/delivery/admin/fahrer-abholwartezeit?location_id=${locationId}`)
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (!d) return;
          setShow((d.team_avg_min ?? 99) <= 3);
        })
        .catch(() => {});
    }

    load();
    const id = setInterval(load, 4 * 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [mounted, locationId]);

  if (!mounted || !show) return null;

  return (
    <div className={cn('inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200', className)}>
      <Zap className="h-3.5 w-3.5 shrink-0" />
      Blitzschnelle Abholung
    </div>
  );
}
