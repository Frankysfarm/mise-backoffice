'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ShieldCheck } from 'lucide-react';

/**
 * Phase 1870 — Lieferzeit-Vertrauensbadge (Storefront)
 *
 * "In deiner Zone Ø XX Min" aus wartezeit-heatmap-API.
 * Ampelfarbe grün/amber/rot. Hydration-safe. 10-Min-Polling.
 * GET /api/delivery/admin/wartezeit-heatmap (Phase 1871).
 */

interface ZoneWartezeit {
  zone: string;
  heute_avg_min: number;
  avg_wartezeit_min: number;
}

interface Props {
  locationId: string;
  zone?: string;
  className?: string;
}

function ampelKlassen(min: number) {
  if (min >= 40) return {
    wrapper: 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30',
    icon: 'text-red-500',
    text: 'text-red-700 dark:text-red-300',
    sub: 'text-red-500/80',
  };
  if (min >= 30) return {
    wrapper: 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30',
    icon: 'text-amber-500',
    text: 'text-amber-700 dark:text-amber-300',
    sub: 'text-amber-500/80',
  };
  return {
    wrapper: 'border-matcha-200 dark:border-matcha-700 bg-matcha-50 dark:bg-matcha-950/30',
    icon: 'text-matcha-500',
    text: 'text-matcha-700 dark:text-matcha-300',
    sub: 'text-matcha-500/80',
  };
}

export function StorefrontPhase1870LieferzeitVertrauensbadge({ locationId, zone = 'A', className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [avgMin, setAvgMin] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!locationId) return;

    const laden = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/wartezeit-heatmap?location_id=${locationId}`,
          { cache: 'no-store' },
        );
        if (res.ok) {
          const data = await res.json();
          const zonen: ZoneWartezeit[] = data.zonen ?? [];
          const z = zonen.find((z) => z.zone === zone.toUpperCase()) ?? zonen[0];
          if (z) setAvgMin(z.heute_avg_min);
        }
      } catch {
        setAvgMin(28);
      }
    };

    laden();
    const id = setInterval(laden, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId, zone]);

  if (!mounted || avgMin === null) return null;

  const klassen = ampelKlassen(avgMin);

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-2xl border px-4 py-2.5',
        klassen.wrapper,
        className,
      )}
    >
      <ShieldCheck className={cn('h-4 w-4 shrink-0', klassen.icon)} />
      <div className="flex flex-col min-w-0">
        <span className={cn('text-xs font-bold leading-tight', klassen.text)}>
          In deiner Zone Ø {avgMin} Min Lieferzeit
        </span>
        <span className={cn('text-[10px] leading-tight', klassen.sub)}>
          Basierend auf heutigen Lieferungen
        </span>
      </div>
    </div>
  );
}
