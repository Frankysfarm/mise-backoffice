'use client';

import { useCallback, useEffect, useState } from 'react';
import { Heart } from 'lucide-react';

type ApiData = {
  alert_count: number;
};

export function StorefrontPhase2299QualitaetsSiegel({
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
      const res = await fetch(
        `/api/delivery/admin/fahrer-schicht-kpi?location_id=${locationId}`
      );
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 6 * 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!mounted || !data || data.alert_count > 0) return null;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-300 ${className ?? ''}`}
    >
      <Heart className="w-3.5 h-3.5 fill-current" />
      Faire Arbeitsbedingungen — zufriedene Fahrer
    </div>
  );
}
