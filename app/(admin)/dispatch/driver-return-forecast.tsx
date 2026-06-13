'use client';

/**
 * DriverReturnForecast — Phase 113
 *
 * Zeigt eine kompakte "Wann kommt welcher Fahrer frei?"-Timeline.
 * Hilft Dispatcher dabei, die nächste Bestellung dem richtigen Fahrer zuzuweisen.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, Clock, MapPin, AlertTriangle } from 'lucide-react';

type Driver = {
  employee_id: string;
  ist_online: boolean;
  fahrzeug: string | null;
  aktueller_batch_id: string | null;
  employee: { id: string; vorname: string; nachname: string; telefon: string | null } | null;
};

type Batch = {
  id: string;
  status: string;
  startzeit?: string | null;
  total_eta_min: number | null;
  total_distance_km: number | null;
  zone: string | null;
  stops: {
    id: string;
    order_id: string;
    reihenfolge: number;
    geliefert_am: string | null;
  }[];
};

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((n) => n + 1), 15_000);
    return () => clearInterval(iv);
  }, []);
}

function fmtTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtMin(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m <= 0) return 'Jetzt';
  if (m < 60) return `${m} Min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}h ${rem}m` : `${h}h`;
}

export function DriverReturnForecast({
  drivers,
  batches,
}: {
  drivers: Driver[];
  batches: Batch[];
}) {
  useTick();
  const now = Date.now();

  // Active drivers: online with a batch
  const busyDrivers = drivers.filter((d) => d.ist_online && d.aktueller_batch_id != null);

  if (busyDrivers.length === 0) return null;

  type DriverForecast = {
    driver: Driver;
    batch: Batch | null;
    etaReturnMs: number | null;
    stopsLeft: number;
    totalStops: number;
    isOverdue: boolean;
    returnMin: number | null;
  };

  const forecasts: DriverForecast[] = busyDrivers.map((driver) => {
    const batch = batches.find((b) => b.id === driver.aktueller_batch_id) ?? null;

    if (!batch) {
      return { driver, batch: null, etaReturnMs: null, stopsLeft: 0, totalStops: 0, isOverdue: false, returnMin: null };
    }

    const stopsLeft = batch.stops.filter((s) => !s.geliefert_am).length;
    const totalStops = batch.stops.length;

    // Return ETA = batch_start + total_eta + travel_back (estimate 5 min per km remaining)
    const etaMs = batch.startzeit && batch.total_eta_min != null
      ? new Date(batch.startzeit).getTime() + batch.total_eta_min * 60_000
      : null;

    // Add estimated return travel (rough: 5 min)
    const etaReturnMs = etaMs != null ? etaMs + 5 * 60_000 : null;
    const remainMs = etaReturnMs != null ? etaReturnMs - now : null;
    const isOverdue = remainMs != null && remainMs < -5 * 60_000;
    const returnMin = remainMs != null ? Math.round(remainMs / 60_000) : null;

    return { driver, batch, etaReturnMs, stopsLeft, totalStops, isOverdue, returnMin };
  });

  // Sort: soonest return first
  forecasts.sort((a, b) => {
    if (a.returnMin == null) return 1;
    if (b.returnMin == null) return -1;
    return a.returnMin - b.returnMin;
  });

  // Free drivers (online, no batch)
  const freeDrivers = drivers.filter((d) => d.ist_online && !d.aktueller_batch_id);

  return (
    <div className="rounded-xl border border-indigo-200 bg-indigo-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 bg-indigo-100 border-b border-indigo-200 px-4 py-2.5">
        <Clock className="h-4 w-4 text-indigo-700" />
        <span className="text-xs font-black uppercase tracking-wider text-indigo-800">
          Fahrer-Rückkehr Vorschau
        </span>
        <span className="ml-auto text-[10px] font-bold text-indigo-600">
          {busyDrivers.length} unterwegs
          {freeDrivers.length > 0 && ` · ${freeDrivers.length} frei`}
        </span>
      </div>

      {/* Free drivers strip */}
      {freeDrivers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-4 py-2 bg-green-50 border-b border-indigo-100">
          {freeDrivers.map((d) => (
            <div
              key={d.employee_id}
              className="flex items-center gap-1.5 rounded-lg bg-green-100 border border-green-300 px-2.5 py-1"
            >
              <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
              <span className="text-[11px] font-bold text-green-800">
                {d.employee?.vorname ?? 'Fahrer'} {(d.employee?.nachname ?? '').charAt(0)}.
              </span>
              <span className="text-[9px] text-green-600 font-bold">FREI</span>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      <div className="divide-y divide-indigo-100">
        {forecasts.map(({ driver, batch, etaReturnMs, stopsLeft, totalStops, isOverdue, returnMin }) => {
          const name = driver.employee
            ? `${driver.employee.vorname} ${driver.employee.nachname.charAt(0)}.`
            : 'Fahrer';

          const donePct = totalStops > 0 ? ((totalStops - stopsLeft) / totalStops) : 0;

          return (
            <div key={driver.employee_id} className="px-4 py-2.5 flex items-center gap-3">
              {/* Driver icon */}
              <div className={cn(
                'h-8 w-8 rounded-xl flex items-center justify-center shrink-0 text-[10px] font-black',
                isOverdue ? 'bg-red-500 text-white' :
                returnMin != null && returnMin < 10 ? 'bg-amber-500 text-white' :
                'bg-indigo-200 text-indigo-800',
              )}>
                <Bike className="h-3.5 w-3.5" />
              </div>

              {/* Name + stops */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-black text-indigo-900 truncate">{name}</span>
                  {batch?.zone && (
                    <span className="text-[9px] font-bold text-indigo-500">Zone {batch.zone}</span>
                  )}
                </div>
                {/* Progress bar */}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="flex-1 h-1.5 rounded-full bg-indigo-100 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-700',
                        donePct >= 1 ? 'bg-green-500' : donePct >= 0.5 ? 'bg-blue-500' : 'bg-indigo-400',
                      )}
                      style={{ width: `${donePct * 100}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-indigo-500 tabular-nums shrink-0">
                    {totalStops - stopsLeft}/{totalStops}
                  </span>
                </div>
              </div>

              {/* ETA return */}
              <div className="text-right shrink-0">
                {isOverdue ? (
                  <div className="flex items-center gap-1 text-red-600">
                    <AlertTriangle className="h-3 w-3 animate-pulse" />
                    <span className="text-[10px] font-black">Überfällig</span>
                  </div>
                ) : returnMin != null ? (
                  <>
                    <div className={cn(
                      'text-sm font-black tabular-nums',
                      returnMin < 10 ? 'text-amber-700' : returnMin < 20 ? 'text-indigo-700' : 'text-indigo-500',
                    )}>
                      ~{fmtMin(returnMin * 60_000)}
                    </div>
                    {etaReturnMs != null && (
                      <div className="text-[9px] text-indigo-400 tabular-nums">{fmtTime(etaReturnMs)}</div>
                    )}
                  </>
                ) : (
                  <span className="text-[10px] text-indigo-400">Unbekannt</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
