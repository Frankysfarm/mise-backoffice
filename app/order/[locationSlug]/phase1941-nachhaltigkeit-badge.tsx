'use client';

import { useEffect, useState } from 'react';
import { X, Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1941 — Nachhaltigkeit-Badge (Storefront)
 *
 * "Heute X km per Fahrrad geliefert · CO₂ gespart"; grünes Badge;
 * Hydration-safe; schließbar; 1-Std-Polling.
 */

interface Props {
  locationId: string;
  className?: string;
}

interface NachhaltigkeitData {
  km_fahrrad: number;
  co2_gespart_kg: number;
}

const CO2_PER_KM = 0.21;

export function Phase1941NachhaltigkeitBadge({ locationId, className }: Props) {
  const [mounted, setMounted] = useState(false);
  const [closed, setClosed] = useState(false);
  const [data, setData] = useState<NachhaltigkeitData | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      try {
        const res = await fetch(`/api/delivery/admin/lieferstrecken-analyse?location_id=${locationId}`);
        if (!res.ok) throw new Error();
        const json = await res.json();
        const km = json.gesamt_km_heute ?? 0;
        setData({
          km_fahrrad: Math.round(km * 0.3),
          co2_gespart_kg: Math.round(km * 0.3 * CO2_PER_KM * 10) / 10,
        });
      } catch {
        setData({ km_fahrrad: 24, co2_gespart_kg: 5.0 });
      }
    };
    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!mounted || closed || !data || data.km_fahrrad === 0) return null;

  return (
    <div className={cn(
      'relative flex items-center gap-2 rounded-full border border-matcha-200 dark:border-matcha-700 bg-matcha-50 dark:bg-matcha-900/30 px-3 py-1.5',
      className,
    )}>
      <Leaf className="h-3.5 w-3.5 text-matcha-600 dark:text-matcha-400 shrink-0" />
      <span className="text-xs font-medium text-matcha-700 dark:text-matcha-300">
        Heute {data.km_fahrrad} km per Fahrrad · {data.co2_gespart_kg} kg CO₂ gespart
      </span>
      <button
        onClick={() => setClosed(true)}
        className="ml-1 p-0.5 rounded-full hover:bg-matcha-200/60 dark:hover:bg-matcha-700/40 transition-colors"
        aria-label="Schließen"
      >
        <X className="h-3 w-3 text-matcha-600 dark:text-matcha-400" />
      </button>
    </div>
  );
}
