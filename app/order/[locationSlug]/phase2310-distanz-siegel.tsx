'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';

type ApiData = {
  team_avg_km_tour: number;
};

const MAX_KM_FUER_SIEGEL = 5;

export function StorefrontPhase2310DistanzSiegel({
  locationId,
  className,
}: {
  locationId: string;
  className?: string;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-distanz?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 4 * 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!mounted || !data || data.team_avg_km_tour > MAX_KM_FUER_SIEGEL) return null;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 px-3 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 ${className ?? ''}`}
    >
      <MapPin className="w-3.5 h-3.5" />
      Wir liefern in Ihrer Nähe — Ø {data.team_avg_km_tour} km
    </div>
  );
}
