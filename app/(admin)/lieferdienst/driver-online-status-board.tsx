'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  locationId: string;
}

interface DriverEntry {
  name: string;
  fahrzeug: string;
  online: boolean;
  stopsToday: number;
}

interface ApiDriver {
  name?: string;
  fahrzeug?: string;
  fahrzeug_typ?: string;
  is_online?: boolean;
  ist_online?: boolean;
  stops_today?: number;
  deliveries_today?: number;
}

const MOCK_DRIVERS: DriverEntry[] = [
  { name: 'Max Müller', fahrzeug: 'Fahrrad', online: true, stopsToday: 12 },
  { name: 'Anna Schmidt', fahrzeug: 'E-Scooter', online: true, stopsToday: 8 },
  { name: 'Tom Wagner', fahrzeug: 'Auto', online: false, stopsToday: 5 },
];

export function DriverOnlineStatusBoard({ locationId }: Props) {
  const [drivers, setDrivers] = useState<DriverEntry[]>(MOCK_DRIVERS);
  const [loading, setLoading] = useState(true);
  const [useMock, setUseMock] = useState(false);
  const [open, setOpen] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/delivery/admin/stats?location_id=${locationId}&period=today`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('fetch failed');
      const data: { drivers?: ApiDriver[] } = await res.json();

      if (data.drivers && data.drivers.length > 0) {
        const mapped: DriverEntry[] = data.drivers.map((d) => ({
          name: d.name ?? 'Fahrer',
          fahrzeug: d.fahrzeug ?? d.fahrzeug_typ ?? '—',
          online: d.is_online ?? d.ist_online ?? false,
          stopsToday: d.stops_today ?? d.deliveries_today ?? 0,
        }));
        setDrivers(mapped);
        setUseMock(false);
      } else {
        setDrivers(MOCK_DRIVERS);
        setUseMock(true);
      }
    } catch {
      setDrivers(MOCK_DRIVERS);
      setUseMock(true);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onlineCount = drivers.filter((d) => d.online).length;

  return (
    <div className="rounded-xl border border-matcha-200 bg-white shadow-sm overflow-hidden">
      {/* Header — collapsible */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 border-b border-matcha-100 bg-matcha-50 hover:bg-matcha-100 transition-colors"
      >
        <span className="text-base">👥</span>
        <h2 className="text-sm font-semibold text-matcha-700">Fahrer Online-Status</h2>
        <span className="ml-2 text-xs text-stone-400">
          {onlineCount}/{drivers.length} online
        </span>
        {useMock && (
          <span className="ml-1 text-xs text-amber-500">(Demo)</span>
        )}
        <span className="ml-auto text-stone-400">
          {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </span>
      </button>

      {open && (
        <div className="divide-y divide-stone-100">
          {loading ? (
            <div className="px-4 py-3 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-stone-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : drivers.length === 0 ? (
            <div className="px-4 py-4 text-xs text-stone-400 text-center">
              Keine Fahrer verfügbar
            </div>
          ) : (
            drivers.map((driver) => (
              <div
                key={driver.name}
                className="flex items-center gap-3 px-4 py-3"
              >
                {/* Online dot */}
                <span
                  className={cn(
                    'w-2.5 h-2.5 rounded-full flex-shrink-0',
                    driver.online ? 'bg-[#5c7a4e] animate-pulse' : 'bg-stone-300',
                  )}
                />

                {/* Name + Vehicle */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-stone-800 truncate">{driver.name}</p>
                  <p className="text-xs text-stone-400 truncate">{driver.fahrzeug}</p>
                </div>

                {/* Online label */}
                <span
                  className={cn(
                    'text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0',
                    driver.online
                      ? 'bg-matcha-100 text-matcha-700'
                      : 'bg-stone-100 text-stone-500',
                  )}
                >
                  {driver.online ? 'Online' : 'Offline'}
                </span>

                {/* Stops today */}
                <div className="flex-shrink-0 text-right">
                  <span className="text-sm font-bold tabular-nums text-stone-700">
                    {driver.stopsToday}
                  </span>
                  <p className="text-[10px] text-stone-400">heute</p>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
