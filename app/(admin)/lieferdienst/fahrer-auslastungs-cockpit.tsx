'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Users, Bike, Package, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  locationId: string | null | undefined;
}

interface DriverLoad {
  driverId: string;
  name: string;
  vehicle: string;
  activeStops: number;
  delivered: number;
  isOnline: boolean;
}

interface Stats {
  drivers: DriverLoad[];
  totalOnline: number;
  totalActiveStops: number;
  avgStopsPerDriver: number;
  utilizationPct: number;
}

export function FahrerAuslastungsCockpit({ locationId }: Props) {
  const supabase = createClient();
  const [stats, setStats] = useState<Stats | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!locationId) return;

    async function load() {
      const { data: drivers } = await supabase
        .from('delivery_drivers')
        .select('id,ist_online,fahrzeug,aktueller_batch_id,employee:employees(vorname,nachname)')
        .eq('location_id', locationId);

      if (!mountedRef.current || !drivers) return;

      const online = drivers.filter((d) => d.ist_online);

      // Get active stops for each driver with active batch
      const driverLoads: DriverLoad[] = await Promise.all(
        online.map(async (d) => {
          let activeStops = 0;
          let delivered = 0;
          if (d.aktueller_batch_id) {
            const { data: batch } = await supabase
              .from('mise_delivery_batches')
              .select('stops:mise_delivery_stops(geliefert_am)')
              .eq('id', d.aktueller_batch_id)
              .single();
            const stops = (batch?.stops ?? []) as { geliefert_am: string | null }[];
            activeStops = stops.filter((s) => !s.geliefert_am).length;
            delivered = stops.filter((s) => s.geliefert_am).length;
          }
          const emp = Array.isArray(d.employee) ? d.employee[0] : d.employee;
          return {
            driverId: d.id,
            name: emp ? `${emp.vorname} ${emp.nachname[0]}.` : 'Fahrer',
            vehicle: d.fahrzeug ?? 'unbekannt',
            activeStops,
            delivered,
            isOnline: d.ist_online,
          };
        }),
      );

      const totalActive = driverLoads.reduce((s, d) => s + d.activeStops, 0);
      const utilizationPct =
        online.length > 0
          ? Math.round(
              (driverLoads.filter((d) => d.activeStops > 0 || d.delivered > 0).length / online.length) * 100,
            )
          : 0;

      setStats({
        drivers: driverLoads,
        totalOnline: online.length,
        totalActiveStops: totalActive,
        avgStopsPerDriver: online.length > 0 ? Math.round((totalActive / online.length) * 10) / 10 : 0,
        utilizationPct,
      });
    }

    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!locationId || !stats) return null;

  const utilizationColor =
    stats.utilizationPct >= 80 ? 'text-matcha-700' :
    stats.utilizationPct >= 50 ? 'text-amber-600' : 'text-red-600';

  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b">
        <Users className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Fahrer-Auslastungs-Cockpit</span>
        <span className="ml-auto rounded-full bg-matcha-50 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
          {stats.totalOnline} online
        </span>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 divide-x border-b">
        <div className="px-3 py-2.5 text-center">
          <div className={cn('text-xl font-black tabular-nums', utilizationColor)}>
            {stats.utilizationPct}%
          </div>
          <div className="text-[9px] text-muted-foreground mt-0.5">Auslastung</div>
        </div>
        <div className="px-3 py-2.5 text-center">
          <div className="text-xl font-black tabular-nums text-foreground">{stats.totalActiveStops}</div>
          <div className="text-[9px] text-muted-foreground mt-0.5">Offene Stopps</div>
        </div>
        <div className="px-3 py-2.5 text-center">
          <div className="text-xl font-black tabular-nums text-foreground">{stats.avgStopsPerDriver}</div>
          <div className="text-[9px] text-muted-foreground mt-0.5">Stopps/Fahrer</div>
        </div>
      </div>

      {/* Driver list */}
      {stats.drivers.length > 0 && (
        <div className="divide-y">
          {stats.drivers.map((d) => (
            <div key={d.driverId} className="flex items-center gap-3 px-4 py-2">
              <div className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
                d.activeStops > 0 ? 'bg-matcha-100 text-matcha-700' : 'bg-muted text-muted-foreground',
              )}>
                <Bike className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold truncate">{d.name}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  {d.activeStops > 0 && (
                    <span className="text-[10px] text-matcha-600 font-bold">
                      {d.activeStops} Stopp{d.activeStops !== 1 ? 's' : ''} aktiv
                    </span>
                  )}
                  {d.delivered > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      · {d.delivered} geliefert
                    </span>
                  )}
                  {d.activeStops === 0 && d.delivered === 0 && (
                    <span className="text-[10px] text-amber-600">frei</span>
                  )}
                </div>
              </div>
              <div className="shrink-0">
                <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full',
                      d.activeStops > 0 ? 'bg-matcha-500' : 'bg-muted-foreground/30',
                    )}
                    style={{
                      width: `${Math.min(100, (d.activeStops / Math.max(1, stats.avgStopsPerDriver * 2)) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
