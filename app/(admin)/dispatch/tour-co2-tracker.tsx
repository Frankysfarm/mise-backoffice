'use client';

import React, { useMemo } from 'react';
import { Leaf } from 'lucide-react';
import { cn } from '@/lib/utils';

// kg CO₂ per km by vehicle type
const CO2_PER_KM: Record<string, number> = {
  fahrrad:  0.0,
  lastenrad: 0.005,
  ebike:    0.012,
  moped:    0.065,
  motorrad: 0.103,
  auto:     0.168,
  default:  0.168,
};
const CAR_BASELINE = 0.168;

function co2ForVehicle(vehicle: string | null, km: number): number {
  const key = (vehicle ?? 'default').toLowerCase();
  const rate = CO2_PER_KM[key] ?? CO2_PER_KM.default;
  return rate * km;
}

export interface Co2TourInput {
  id: string;
  driverName: string;
  vehicle: string | null;
  distanceKm: number;
  completedStops: number;
  totalStops: number;
}

interface Props {
  tours: Co2TourInput[];
}

export function TourCo2Tracker({ tours }: Props) {
  const rows = useMemo(() =>
    tours
      .filter((t) => t.distanceKm > 0)
      .map((t) => {
        const co2 = co2ForVehicle(t.vehicle, t.distanceKm);
        const co2Saved = Math.max(0, CAR_BASELINE * t.distanceKm - co2);
        const isEco = (t.vehicle ?? '').toLowerCase().includes('rad') ||
                      (t.vehicle ?? '').toLowerCase() === 'ebike';
        return { ...t, co2, co2Saved, isEco };
      }),
    [tours],
  );

  const totalSavedKg = useMemo(() => rows.reduce((s, r) => s + r.co2Saved, 0), [rows]);
  const totalKm      = useMemo(() => rows.reduce((s, r) => s + r.distanceKm, 0), [rows]);

  if (rows.length === 0) return null;

  return (
    <div className="rounded-xl border border-matcha-200 bg-matcha-50/60 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-matcha-200">
        <Leaf className="h-4 w-4 text-matcha-600 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-matcha-800">
          CO₂-Tracker · Aktive Touren
        </span>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-[10px] text-matcha-600 font-semibold">
            {totalKm.toFixed(1)} km
          </span>
          <span className="rounded-full bg-matcha-600 px-2 py-0.5 text-[10px] font-black text-white">
            −{(totalSavedKg * 1000).toFixed(0)} g CO₂
          </span>
        </div>
      </div>

      <div className="divide-y divide-matcha-100">
        {rows.map((row) => {
          const pct = row.totalStops > 0
            ? Math.round((row.completedStops / row.totalStops) * 100)
            : 0;
          return (
            <div key={row.id} className="px-4 py-2.5 flex items-center gap-3">
              <div className={cn(
                'shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs',
                row.isEco ? 'bg-matcha-200 text-matcha-700' : 'bg-stone-100 text-stone-400',
              )}>
                {row.isEco ? '🚲' : '🚗'}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-bold truncate">{row.driverName}</span>
                  {row.vehicle && (
                    <span className="text-[10px] text-muted-foreground capitalize">{row.vehicle}</span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-1 rounded-full bg-black/10 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-matcha-500 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground tabular-nums shrink-0">
                    {row.completedStops}/{row.totalStops}
                  </span>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-[11px] font-bold tabular-nums text-matcha-700">
                  −{(row.co2Saved * 1000).toFixed(0)} g
                </div>
                <div className="text-[9px] text-muted-foreground">{row.distanceKm.toFixed(1)} km</div>
              </div>
            </div>
          );
        })}
      </div>

      {totalSavedKg > 0 && (
        <div className="px-4 py-2 bg-matcha-100/60 border-t border-matcha-200">
          <p className="text-[10px] text-matcha-700 font-medium">
            🌱 {(totalSavedKg * 1000).toFixed(0)} g CO₂ gespart vs. Pkw-Referenz
          </p>
        </div>
      )}
    </div>
  );
}
