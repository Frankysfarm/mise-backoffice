'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

type ApiData = {
  team_quote: number;
};

export function StorefrontPhase2279LieferfensterSiegel({
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
      const res = await fetch(`/api/delivery/admin/fahrer-lieferfenster?location_id=${locationId}`);
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

  if (!mounted || !data || data.team_quote < 95) return null;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 px-3 py-1 text-xs font-medium text-green-700 dark:text-green-300 ${className ?? ''}`}
    >
      <Clock className="w-3.5 h-3.5" />
      Lieferung wie versprochen — {data.team_quote.toFixed(0)}% pünktlich
    </div>
  );
}
