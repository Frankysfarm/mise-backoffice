'use client';

/**
 * KitchenDriverReturnKochstart — Phase 275
 *
 * Zeigt der Küche, wann Fahrer zurückkehren und wann sie mit dem Kochen
 * für die nächste Tour starten sollten.
 *
 * Logik: Kochstart = Rückkehr - Ø Zubereitungszeit (Standard 15 Min)
 * Nutzt die Phase-274-API (/api/delivery/admin/return-prediction).
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Car, ChefHat, Clock, Play, Loader2 } from 'lucide-react';

interface Prediction {
  driverId:           string;
  driverName:         string | null;
  driverVehicle:      'bike' | 'car';
  minutesUntilReturn: number;
  remainingStops:     number;
  totalStops:         number;
  estimatedReturnUtc: string;
  confidence:         number;
}

const AVG_PREP_MIN = 15; // Standard-Zubereitungszeit

function fmtTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function cookStartFromReturn(returnUtc: string): string {
  const cookStart = new Date(new Date(returnUtc).getTime() - AVG_PREP_MIN * 60_000);
  return cookStart.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function cookStartMinutes(minutesUntilReturn: number): number {
  return minutesUntilReturn - AVG_PREP_MIN;
}

export function KitchenDriverReturnKochstart({ locationId }: { locationId: string }) {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading]         = useState(false);

  const load = () => {
    setLoading(true);
    fetch(`/api/delivery/admin/return-prediction?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.ok && Array.isArray(d.predictions)) {
          setPredictions(
            (d.predictions as Prediction[]).filter(p => p.minutesUntilReturn > 0 && p.remainingStops > 0)
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!loading && predictions.length === 0) return null;

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 bg-orange-100 border-b border-orange-200 px-4 py-2.5">
        <ChefHat className="h-4 w-4 text-orange-700" />
        <span className="text-xs font-black uppercase tracking-wider text-orange-800">
          Kochstart-Planung
        </span>
        <span className="ml-1 text-[9px] text-orange-500">
          Ø Zubereitung {AVG_PREP_MIN} Min
        </span>
        {loading && <Loader2 className="ml-auto h-3 w-3 animate-spin text-orange-500" />}
      </div>

      {/* Driver list */}
      {loading && predictions.length === 0 ? (
        <div className="px-4 py-4 text-center text-[11px] text-orange-400">Lade Fahrer-Prognosen…</div>
      ) : (
        <div className="divide-y divide-orange-100">
          {[...predictions]
            .sort((a, b) => a.minutesUntilReturn - b.minutesUntilReturn)
            .map(p => {
              const cookStartMin  = cookStartMinutes(p.minutesUntilReturn);
              const cookStartTime = cookStartFromReturn(p.estimatedReturnUtc);
              const returnTime    = fmtTime(p.estimatedReturnUtc);
              const donePct       = p.totalStops > 0 ? (p.totalStops - p.remainingStops) / p.totalStops : 0;

              const urgency =
                cookStartMin <= 0 ? 'now'
                : cookStartMin <= 5 ? 'soon'
                : 'later';

              return (
                <div key={p.driverId} className="flex items-center gap-3 px-4 py-2.5">
                  {/* Vehicle icon */}
                  <div className={cn(
                    'h-9 w-9 rounded-xl flex items-center justify-center shrink-0',
                    urgency === 'now'  ? 'bg-red-500 text-white animate-pulse' :
                    urgency === 'soon' ? 'bg-amber-500 text-white' :
                    'bg-orange-200 text-orange-700',
                  )}>
                    {p.driverVehicle === 'car'
                      ? <Car className="h-4 w-4" />
                      : <Bike className="h-4 w-4" />
                    }
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] font-black text-orange-900 truncate">
                        {p.driverName ?? 'Fahrer'}
                      </span>
                      <span className="text-[9px] text-orange-500 font-bold">
                        {p.totalStops - p.remainingStops}/{p.totalStops} Stops
                      </span>
                    </div>
                    {/* Progress */}
                    <div className="h-1.5 rounded-full bg-orange-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-orange-400 transition-all duration-500"
                        style={{ width: `${donePct * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Timing */}
                  <div className="text-right shrink-0 min-w-[96px]">
                    <div className="flex items-center justify-end gap-1 mb-0.5">
                      <Clock className="h-3 w-3 text-orange-400 shrink-0" />
                      <span className="text-[10px] text-orange-600 font-bold">
                        Rückkehr ~{returnTime}
                      </span>
                    </div>
                    <div className={cn(
                      'flex items-center justify-end gap-1 rounded-lg px-2 py-0.5',
                      urgency === 'now'
                        ? 'bg-red-100 border border-red-300'
                        : urgency === 'soon'
                        ? 'bg-amber-100 border border-amber-300'
                        : 'bg-emerald-50 border border-emerald-200',
                    )}>
                      <Play className={cn(
                        'h-2.5 w-2.5 shrink-0',
                        urgency === 'now' ? 'text-red-600' :
                        urgency === 'soon' ? 'text-amber-700' : 'text-emerald-600',
                      )} />
                      <span className={cn(
                        'text-[10px] font-black tabular-nums',
                        urgency === 'now' ? 'text-red-700' :
                        urgency === 'soon' ? 'text-amber-700' : 'text-emerald-700',
                      )}>
                        {urgency === 'now'
                          ? 'JETZT KOCHEN!'
                          : `Kochstart ${cookStartTime}`}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
