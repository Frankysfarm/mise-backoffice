'use client';

import { useEffect, useState } from 'react';
import { Leaf } from 'lucide-react';

type ApiResponse = {
  team_avg_wartezeit: number;
  mock?: boolean;
};

export function StorefrontPhase2171FrischeSiegel({
  locationId,
  className,
}: {
  locationId: string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    setMounted(true);
    const load = () =>
      fetch(`/api/delivery/admin/fahrer-wartezeit?location_id=${locationId}`)
        .then((r) => r.json())
        .then(setData)
        .catch(() => null);
    load();
    const id = setInterval(load, 2 * 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!mounted || !data || data.team_avg_wartezeit > 2) return null;

  return (
    <div className={className}>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">
        <Leaf className="h-3.5 w-3.5" />
        Frisch zubereitet &amp; sofort geliefert
      </span>
    </div>
  );
}
