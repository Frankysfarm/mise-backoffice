'use client';

import { useEffect, useState } from 'react';
import { X, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 2018 — Liefereffizienz-Siegel (Storefront)
 *
 * "Optimierte Lieferrouten — weniger Wartezeit" wenn Effizienz >75;
 * schließbar; Hydration-safe; 1-Std-Polling.
 */

interface Props {
  locationId: string;
  className?: string;
}

export function StorefrontPhase2018LiefereffizienzSiegel({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [closed, setClosed] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/tour-effizienz?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        setShow((json.effizienz_index ?? 0) > 75);
      } catch {
        setShow(true);
      }
    };
    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!mounted || closed || !show) return null;

  return (
    <div className={cn(
      'relative flex items-center gap-2 rounded-full border border-violet-200 dark:border-violet-700 bg-violet-50 dark:bg-violet-900/30 px-3 py-1.5',
      className,
    )}>
      <ShieldCheck className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400 shrink-0" />
      <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
        Optimierte Lieferrouten — weniger Wartezeit
      </span>
      <button
        onClick={() => setClosed(true)}
        className="ml-1 p-0.5 rounded-full hover:bg-violet-200/60 dark:hover:bg-violet-700/40 transition-colors"
        aria-label="Schließen"
      >
        <X className="h-3 w-3 text-violet-600 dark:text-violet-400" />
      </button>
    </div>
  );
}
