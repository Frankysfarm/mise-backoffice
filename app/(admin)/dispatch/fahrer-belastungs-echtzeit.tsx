'use client';

/**
 * DispatchFahrerBelastungsEchtzeit — Phase 362
 *
 * Fahrer-Belastungs-Balken: aktive Stops je Fahrer in Echtzeit.
 * Pollt /api/delivery/admin/drivers alle 15 Sekunden.
 * Zeigt: Fahrername, aktuelle Stops, Gesamtkapazität, Status-Badge.
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Users, Loader2, Bike, Car, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/card';

type DriverLoad = {
  id:          string;
  name:        string;
  vehicle:     'bike' | 'car';
  activeStops: number;
  maxCap:      number;
  status:      'idle' | 'active' | 'overloaded';
  batchId:     string | null;
  isOnline:    boolean;
};

type ApiDriver = {
  employee_id:        string;
  ist_online:         boolean;
  current_capacity:   number | null;
  max_capacity:       number | null;
  aktueller_batch_id: string | null;
  vehicle:            string | null;
  employee?: { vorname?: string; nachname?: string } | null;
};

type Props = { locationId?: string | null };

function mapDriver(d: ApiDriver): DriverLoad {
  const active = d.current_capacity ?? 0;
  const max    = d.max_capacity ?? 4;
  const status: DriverLoad['status'] =
    active === 0              ? 'idle'
    : active >= max           ? 'overloaded'
    : 'active';
  const name = d.employee
    ? `${d.employee.vorname ?? ''} ${(d.employee.nachname ?? '').charAt(0)}.`.trim()
    : d.employee_id.slice(0, 8);

  return {
    id:          d.employee_id,
    name,
    vehicle:     (d.vehicle as 'bike' | 'car') ?? 'bike',
    activeStops: active,
    maxCap:      max,
    status,
    batchId:     d.aktueller_batch_id,
    isOnline:    d.ist_online,
  };
}

export function DispatchFahrerBelastungsEchtzeit({ locationId }: Props) {
  const [drivers, setDrivers]  = useState<DriverLoad[]>([]);
  const [loading, setLoading]  = useState(true);
  const [tick, setTick]        = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/drivers${params}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('non-ok');
        const json = await res.json() as { drivers?: ApiDriver[] } | ApiDriver[];
        const raw = Array.isArray(json) ? json : (json.drivers ?? []);
        if (!cancelled) {
          setDrivers(raw.filter((d) => d.ist_online).map(mapDriver));
          setLoading(false);
          setTick((t) => t + 1);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    intervalRef.current = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [locationId]);

  const overloaded = drivers.filter((d) => d.status === 'overloaded').length;
  const active     = drivers.filter((d) => d.status === 'active').length;
  const idle       = drivers.filter((d) => d.status === 'idle').length;

  return (
    <Card className="p-3 rounded-2xl shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-matcha-600" />
          <span className="text-sm font-bold text-stone-700">Fahrer-Belastung (Echtzeit)</span>
        </div>
        <div className="flex items-center gap-2">
          {overloaded > 0 && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 rounded-full px-2 py-0.5">
              <AlertTriangle className="h-3 w-3" />{overloaded} überlastet
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-stone-400" />}
        </div>
      </div>

      {!loading && drivers.length === 0 && (
        <div className="text-xs text-stone-400 text-center py-3">
          Keine Fahrer online
        </div>
      )}

      {!loading && drivers.length > 0 && (
        <>
          <div className="flex gap-2 mb-3 text-[10px] font-semibold">
            <span className="text-red-600">{overloaded} voll</span>
            <span className="text-amber-600">{active} aktiv</span>
            <span className="text-stone-400">{idle} frei</span>
            <span className="ml-auto text-stone-400">{drivers.length} online</span>
          </div>

          <div className="space-y-2">
            {drivers
              .sort((a, b) => b.activeStops - a.activeStops)
              .map((d) => {
                const pct = d.maxCap > 0 ? (d.activeStops / d.maxCap) * 100 : 0;
                const barColor =
                  d.status === 'overloaded' ? 'bg-red-500'
                  : d.status === 'active'   ? 'bg-matcha-500'
                  : 'bg-stone-300';

                return (
                  <div key={d.id} className="flex items-center gap-2">
                    {d.vehicle === 'car'
                      ? <Car className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                      : <Bike className="h-3.5 w-3.5 shrink-0 text-stone-400" />
                    }
                    <span className="w-20 shrink-0 text-[11px] font-semibold text-stone-700 truncate">
                      {d.name}
                    </span>
                    <div className="flex-1 h-2.5 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-500', barColor)}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <span className={cn(
                      'w-12 shrink-0 text-right text-[11px] font-bold tabular-nums',
                      d.status === 'overloaded' ? 'text-red-600'
                      : d.status === 'active'   ? 'text-matcha-700'
                      : 'text-stone-400',
                    )}>
                      {d.activeStops}/{d.maxCap}
                    </span>
                    {d.status === 'idle' && (
                      <CheckCircle2 className="h-3 w-3 shrink-0 text-stone-300" />
                    )}
                    {d.status === 'overloaded' && (
                      <AlertTriangle className="h-3 w-3 shrink-0 text-red-500" />
                    )}
                  </div>
                );
              })}
          </div>

          <div className="mt-2 text-[9px] text-stone-400 text-right">
            15s-Polling · Tick {tick}
          </div>
        </>
      )}
    </Card>
  );
}
