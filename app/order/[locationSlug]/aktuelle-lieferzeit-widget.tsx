'use client';

import React, { useEffect, useState } from 'react';
import { Clock, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface HealthData {
  etaMin?: number;
  etaMax?: number;
  activeDrivers?: number;
  pendingOrders?: number;
  isOpen?: boolean;
}

interface Props {
  locationId: string;
}

// Zeigt Kunden die aktuelle Lieferzeit und Fahreranzahl direkt auf der Storefront.
export function AktuelleLieferzeitWidget({ locationId }: Props) {
  const [data, setData] = useState<HealthData | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetch(`/api/delivery/health?location_id=${encodeURIComponent(locationId)}`)
        .then((r) => r.json())
        .then((d: HealthData) => { if (!cancelled) setData(d); })
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 90_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [locationId]);

  if (!data) return null;
  if (data.isOpen === false) return null;
  // Kein etaMin verfügbar → kein Widget zeigen
  if (!data.etaMin) return null;

  const hasDriverInfo = typeof data.activeDrivers === 'number' && data.activeDrivers > 0;
  const etaText =
    data.etaMax && data.etaMax !== data.etaMin
      ? `${data.etaMin}–${data.etaMax} Min`
      : `~${data.etaMin} Min`;

  const speedLabel =
    (data.etaMin ?? 999) <= 25 ? 'Schnell' :
    (data.etaMin ?? 999) <= 35 ? 'Normal' : 'Erhöhte Wartezeit';
  const speedColor =
    (data.etaMin ?? 999) <= 25 ? 'text-matcha-700 bg-matcha-50 border-matcha-200' :
    (data.etaMin ?? 999) <= 35 ? 'text-blue-700 bg-blue-50 border-blue-200' :
                                  'text-amber-700 bg-amber-50 border-amber-200';

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm',
      speedColor,
    )}>
      <Clock className="h-4 w-4 shrink-0" />
      <span className="font-bold">{etaText}</span>
      <span className="text-[11px] font-medium">{speedLabel}</span>
      {hasDriverInfo && (
        <span className="ml-auto flex items-center gap-1 text-[10px] font-medium opacity-75">
          <Users className="h-3 w-3" />
          {data.activeDrivers} Fahrer
        </span>
      )}
    </div>
  );
}
