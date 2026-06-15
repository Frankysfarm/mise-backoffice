'use client';

/**
 * DemandForecastChart — Phase 201
 * Kompaktes 6h-Balkendiagramm der Bestellprognose für die Küche.
 * Zeigt erwartete Bestellungen + empfohlene Fahrerzahl pro Stunde.
 * Polling alle 30 Min da Forecast-Daten sich selten ändern.
 */

import { useCallback, useEffect, useState } from 'react';
import { Brain, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ForecastSlot {
  hourLocal: string;
  expectedOrders: number;
  confidenceOrders: number;
  recommendedTargetDrivers: number;
  dataPoints: number;
}

interface Props {
  locationId: string | null;
}

export function DemandForecastChart({ locationId }: Props) {
  const [slots, setSlots] = useState<ForecastSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalExpected, setTotalExpected] = useState(0);
  const [peakHour, setPeakHour] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(
        `/api/delivery/admin/forecast?location_id=${locationId}&hours=6`,
      );
      const json = await res.json();
      const s: ForecastSlot[] = json.slots ?? [];
      setSlots(s);
      setTotalExpected(json.summary?.totalExpectedOrders ?? 0);
      const peakSlot = s.reduce<ForecastSlot | null>(
        (best, cur) => (!best || cur.expectedOrders > best.expectedOrders ? cur : best),
        null,
      );
      setPeakHour(peakSlot?.hourLocal ?? null);
    } catch {
      // keep stale data
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const id = setInterval(load, 30 * 60_000);
    return () => clearInterval(id);
  }, [load]);

  if (!locationId || (!loading && slots.length === 0)) return null;

  const maxOrders = Math.max(...slots.map((s) => s.confidenceOrders), 1);

  return (
    <div className="rounded-2xl border border-blue-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-blue-500" />
          <span className="text-xs font-bold text-zinc-700">Prognose nächste 6h</span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-zinc-400">
          {peakHour && (
            <span className="flex items-center gap-0.5 text-orange-500 font-semibold">
              <TrendingUp size={9} />
              Peak: {peakHour}
            </span>
          )}
          <span className="font-semibold text-zinc-500">{totalExpected} erwartet</span>
        </div>
      </div>

      {loading && slots.length === 0 ? (
        <div className="flex gap-1 h-16 items-end">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex-1 h-8 animate-pulse rounded-t bg-zinc-100" />
          ))}
        </div>
      ) : (
        <div className="flex items-end gap-1 h-16">
          {slots.map((slot) => {
            const pctExp = Math.max(4, Math.round((slot.expectedOrders / maxOrders) * 100));
            const pctConf = Math.round((slot.confidenceOrders / maxOrders) * 100);
            const isPeak = slot.expectedOrders >= maxOrders * 0.7;
            const isLow = slot.dataPoints < 3;
            return (
              <div
                key={slot.hourLocal}
                className="group relative flex flex-1 flex-col-reverse items-center"
                title={`${slot.hourLocal} Uhr — ${slot.expectedOrders} Bestellungen · ${slot.recommendedTargetDrivers} Fahrer`}
              >
                <div className="relative w-full flex flex-col-reverse overflow-hidden rounded-t bg-zinc-100 h-12">
                  <div
                    className={cn(
                      'w-full transition-all duration-500',
                      isPeak ? 'bg-orange-400' : 'bg-blue-400',
                      isLow && 'opacity-50',
                    )}
                    style={{ height: `${pctExp}%` }}
                  />
                  {pctConf > pctExp && (
                    <div
                      className="absolute w-full border-t border-dashed border-zinc-300/80"
                      style={{ bottom: `${pctConf}%` }}
                    />
                  )}
                </div>
                <div className="mt-0.5 flex items-center gap-0.5 text-[8px] text-zinc-400">
                  <Users size={7} />
                  {slot.recommendedTargetDrivers}
                </div>
                <span className="text-[8px] text-zinc-400">{slot.hourLocal}</span>

                {/* Hover tooltip */}
                <div className="pointer-events-none absolute bottom-full mb-1 left-1/2 -translate-x-1/2 z-10 w-28 rounded-lg border border-zinc-100 bg-white p-1.5 text-[9px] shadow opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="font-bold text-zinc-700">{slot.hourLocal} Uhr</p>
                  <p className="text-zinc-500">Erwartet: <span className="font-bold text-zinc-700">{slot.expectedOrders}</span></p>
                  <p className="text-zinc-500">Fahrer: <span className="font-bold text-zinc-700">{slot.recommendedTargetDrivers}</span></p>
                  {isLow && <p className="text-amber-600 mt-0.5">⚠ Wenig Daten</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
