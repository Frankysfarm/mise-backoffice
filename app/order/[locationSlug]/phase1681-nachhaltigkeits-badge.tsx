'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Leaf } from 'lucide-react';

/**
 * Phase 1681 — Nachhaltigkeits-Badge (Storefront)
 *
 * Grüne Lieferung: CO2-Ersparnis durch Bündelung + Bäume-Äquivalent.
 * locationId-Prop; 10-Min-Polling; Hydration-safe.
 */

interface ApiResponse {
  co2_gespart_kg: number;
  batching_faktor: number;
  baeume_aequivalent: number;
  eingesparte_fahrten: number;
}

interface Props {
  locationId: string;
}

const MOCK: ApiResponse = {
  co2_gespart_kg: 4.2,
  batching_faktor: 2.4,
  baeume_aequivalent: 0.2,
  eingesparte_fahrten: 8,
};

export function StorefrontPhase1681NachhaltigkeitsBadge({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    let active = true;

    async function load() {
      try {
        const res = await fetch(`/api/delivery/admin/nachhaltigkeits-badge?location_id=${locationId}`);
        if (!res.ok) throw new Error('fetch failed');
        const json = await res.json();
        if (active) setData(json);
      } catch {
        if (active) setData(MOCK);
      }
    }

    load();
    const id = setInterval(load, 10 * 60 * 1000);
    return () => { active = false; clearInterval(id); };
  }, [locationId]);

  if (!mounted || !data) return null;

  const isGreen = data.batching_faktor >= 2.0 && data.co2_gespart_kg >= 1.0;

  if (!isGreen) return null;

  return (
    <div className={cn(
      'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold',
      'bg-emerald-50 border-emerald-200 text-emerald-700',
      'dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300',
    )}>
      <Leaf className="h-3.5 w-3.5 shrink-0" />
      <span>
        Grüne Lieferung · {data.co2_gespart_kg} kg CO₂ gespart
        {data.eingesparte_fahrten > 0 && ` · ${data.eingesparte_fahrten} Fahrten gebündelt`}
      </span>
    </div>
  );
}
