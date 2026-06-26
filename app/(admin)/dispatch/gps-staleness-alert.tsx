'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GpsDriver {
  id: string;
  name: string;
  lastGpsAt: string | null;
  ageMin: number | null;
  status: 'fresh' | 'stale' | 'critical' | 'unknown';
}

interface ApiResponse {
  ok: boolean;
  drivers: GpsDriver[];
  staleCount: number;
  criticalCount: number;
  totalOnlineCount: number;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

export function DispatchGpsStalenessAlert({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);

  const load = () => {
    if (!locationId) return;
    fetch(`/api/delivery/admin/gps-staleness?location_id=${encodeURIComponent(locationId)}`)
      .then((r) => r.json())
      .then((d: ApiResponse) => setData(d))
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;
  if (!data) return null;

  // Return null if no stale/critical drivers
  if (data.criticalCount === 0 && data.staleCount === 0) return null;

  const isCritical = data.criticalCount > 0;
  const affectedDrivers = data.drivers.filter(
    (d) => d.status === 'critical' || d.status === 'stale' || d.status === 'unknown',
  );

  return (
    <div
      className={cn(
        'rounded-2xl border overflow-hidden',
        isCritical ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50',
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 border-b',
          isCritical ? 'border-red-200' : 'border-amber-200',
        )}
      >
        <AlertTriangle
          className={cn('h-4 w-4 shrink-0', isCritical ? 'text-red-600' : 'text-amber-600')}
        />
        <span
          className={cn(
            'text-xs font-bold uppercase tracking-wider',
            isCritical ? 'text-red-900' : 'text-amber-900',
          )}
        >
          GPS-Signal veraltet
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {data.criticalCount > 0 && (
            <span className="rounded-full bg-red-500 text-white text-[9px] font-black px-2 py-0.5">
              {data.criticalCount} kritisch
            </span>
          )}
          {data.staleCount > 0 && (
            <span className="rounded-full bg-amber-400 text-white text-[9px] font-black px-2 py-0.5">
              {data.staleCount} veraltet
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-black/5">
        {affectedDrivers.map((d) => (
          <div key={d.id} className="flex items-center gap-3 px-4 py-2.5">
            <div
              className={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                d.status === 'critical' || d.status === 'unknown'
                  ? 'bg-red-100 text-red-600'
                  : 'bg-amber-100 text-amber-600',
              )}
            >
              <WifiOff className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold truncate">{d.name}</div>
              <div
                className={cn(
                  'text-[10px]',
                  d.status === 'critical' || d.status === 'unknown'
                    ? 'text-red-600'
                    : 'text-amber-600',
                )}
              >
                {d.ageMin !== null
                  ? `Letztes GPS-Signal vor ${d.ageMin} Min`
                  : 'Kein GPS-Signal'}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
