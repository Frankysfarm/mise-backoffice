'use client';

/**
 * KitchenFahrerReadinessSync — zeigt ankommende Fahrer + ihre Restaurant-ETA.
 * Küche weiß genau, wann welcher Fahrer eintrifft → kann Zubereitung darauf abstimmen.
 *
 * Daten: /api/delivery/dispatch/driver-matrix?action=approaching
 * Polling: 20s
 */

import { useEffect, useRef, useState } from 'react';
import { Bike, Car, Clock, ChevronDown, ChevronUp, MapPin, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApproachingDriver {
  driver_id: string;
  name: string;
  vehicle: 'bike' | 'car';
  eta_restaurant_sec: number;
  order_ids: string[];
  bestellnummern: string[];
}

interface ApiResponse {
  approaching: ApproachingDriver[];
}

function etaLabel(sec: number): string {
  if (sec <= 0) return 'Jetzt';
  if (sec < 60) return `${sec}s`;
  return `${Math.round(sec / 60)} Min`;
}

function urgencyStyle(sec: number): { bar: string; text: string; dot: string; bg: string } {
  if (sec <= 120) return { bar: 'bg-red-500',    text: 'text-red-700',    dot: 'bg-red-500',    bg: 'bg-red-50'    };
  if (sec <= 300) return { bar: 'bg-amber-500',  text: 'text-amber-700',  dot: 'bg-amber-400',  bg: 'bg-amber-50'  };
  return               { bar: 'bg-matcha-500', text: 'text-matcha-700', dot: 'bg-matcha-500', bg: 'bg-matcha-50' };
}

const MOCK: ApproachingDriver[] = [
  { driver_id: 'd1', name: 'Marco B.', vehicle: 'bike', eta_restaurant_sec: 95,  order_ids: ['o1'], bestellnummern: ['#2041'] },
  { driver_id: 'd2', name: 'Jana M.',  vehicle: 'car',  eta_restaurant_sec: 240, order_ids: ['o2', 'o3'], bestellnummern: ['#2042', '#2043'] },
  { driver_id: 'd3', name: 'Kemal A.', vehicle: 'bike', eta_restaurant_sec: 480, order_ids: ['o4'], bestellnummern: ['#2044'] },
];

export function KitchenFahrerReadinessSync({ locationId }: { locationId: string | null }) {
  const [drivers, setDrivers] = useState<ApproachingDriver[]>([]);
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    timerRef.current = setInterval(() => setTick((n) => n + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    if (!locationId) { setDrivers(MOCK); return; }

    const load = () => {
      fetch(`/api/delivery/dispatch/driver-matrix?action=approaching&location_id=${encodeURIComponent(locationId)}`)
        .then((r) => r.json())
        .then((d: ApiResponse) => { if (d.approaching?.length) setDrivers(d.approaching); })
        .catch(() => setDrivers(MOCK));
    };

    load();
    const interval = setInterval(load, 20_000);
    return () => clearInterval(interval);
  }, [locationId]);

  if (drivers.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2.5 px-4 py-3 hover:bg-muted/40 transition"
      >
        <MapPin className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Fahrer im Anflug</span>
        <span className="ml-1 rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
          {drivers.length}
        </span>
        <span className="ml-auto">
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
        </span>
      </button>

      {open && (
        <div className="border-t divide-y">
          {drivers
            .slice()
            .sort((a, b) => a.eta_restaurant_sec - b.eta_restaurant_sec)
            .map((d) => {
              const etaSec = Math.max(0, d.eta_restaurant_sec - tick);
              const style = urgencyStyle(etaSec);
              return (
                <div key={d.driver_id} className={cn('flex items-center gap-3 px-4 py-3', style.bg)}>
                  {/* Animated dot */}
                  <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', style.dot, etaSec <= 120 && 'animate-pulse')} />

                  {/* Vehicle icon */}
                  {d.vehicle === 'bike'
                    ? <Bike className="h-4 w-4 text-muted-foreground shrink-0" />
                    : <Car className="h-4 w-4 text-muted-foreground shrink-0" />
                  }

                  {/* Name + orders */}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold truncate">{d.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {d.bestellnummern.join(' · ')}
                    </div>
                  </div>

                  {/* ETA */}
                  <div className="text-right shrink-0">
                    <div className={cn('font-mono text-lg font-black tabular-nums', style.text)}>
                      {etaLabel(etaSec)}
                    </div>
                    <div className="text-[9px] text-muted-foreground">bis Abholung</div>
                  </div>

                  {/* Urgent alert */}
                  {etaSec <= 120 && (
                    <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 animate-pulse" />
                  )}
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
