'use client';

// Phase 344: ZonenLieferzeitInfo — Aktuelle Lieferzeit für diese Zone

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Props {
  locationId: string;
  orderType: string;
}

type EtaData = {
  etaMin?: number | null;
  etaMax?: number | null;
  load?: string | null;
  activeDrivers?: number | null;
};

export function ZonenLieferzeitInfo({ locationId, orderType }: Props) {
  const [data, setData] = useState<EtaData | null>(null);

  useEffect(() => {
    if (orderType !== 'lieferung') return;

    const load = () => {
      fetch(`/api/delivery/eta/live?type=lieferung&location_id=${locationId}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) setData(d);
        })
        .catch(() => {});
    };

    load();
    const iv = setInterval(load, 90_000);
    return () => clearInterval(iv);
  }, [locationId, orderType]);

  if (orderType !== 'lieferung') return null;
  if (!data) return null;

  const loadColor =
    data.load === 'hoch'
      ? 'bg-red-100 text-red-700 border-red-200'
      : data.load === 'mittel'
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-green-100 text-green-700 border-green-200';

  const loadLabel =
    data.load === 'hoch' ? 'Hohe Auslastung' : data.load === 'mittel' ? 'Mittlere Auslastung' : 'Niedrige Auslastung';

  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
      <div className="flex items-center gap-3 flex-wrap">
        {data.etaMin !== null && data.etaMin !== undefined && data.etaMax !== null && data.etaMax !== undefined ? (
          <span className="text-gray-700">
            Lieferzeit:{' '}
            <span className="font-semibold text-gray-900">
              {data.etaMin}–{data.etaMax} min
            </span>
          </span>
        ) : null}
        {data.load ? (
          <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', loadColor)}>
            {loadLabel}
          </span>
        ) : null}
        {data.activeDrivers !== null && data.activeDrivers !== undefined && data.activeDrivers > 0 ? (
          <span className="text-gray-500 text-xs">{data.activeDrivers} Fahrer aktiv</span>
        ) : null}
      </div>
    </div>
  );
}
