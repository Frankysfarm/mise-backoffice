'use client';

import React, { useEffect, useState } from 'react';
import { AlertTriangle, TrendingDown, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DriverSummary {
  driverId: string;
  driverName: string | null;
  compositeScore: number;
  grade: string;
  stopsToday: number;
  isOnline: boolean;
}

interface Props {
  locationId: string | null;
}

const GRADE_COLOR: Record<string, string> = {
  'A+': 'bg-emerald-100 text-emerald-800 border-emerald-300',
  'A':  'bg-green-100 text-green-800 border-green-300',
  'B':  'bg-blue-100 text-blue-800 border-blue-300',
  'C':  'bg-amber-100 text-amber-800 border-amber-300',
  'D':  'bg-red-100 text-red-800 border-red-300',
};

/* Küchen-Risikoboard: Fahrer mit Note C/D sichtbar für das Küchenteam.
   Warnt bei niedrigem Score — Küche kann Timing und Übergabe anpassen. */
export function KitchenFahrerScoreRisikoBoard({ locationId }: Props) {
  const [drivers, setDrivers] = useState<DriverSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!locationId) { setLoading(false); return; }

    let cancelled = false;
    const load = async () => {
      try {
        const r = await fetch(
          `/api/delivery/admin/driver-score-daily?action=summary&location_id=${encodeURIComponent(locationId)}`,
        );
        if (!r.ok || cancelled) return;
        const data = await r.json();
        const all: DriverSummary[] = (data.summary ?? []).map((s: Record<string, unknown>) => ({
          driverId:       String(s.driverId ?? ''),
          driverName:     (s.driverName as string | null) ?? null,
          compositeScore: Number(s.compositeScore ?? 0),
          grade:          String(s.grade ?? 'D'),
          stopsToday:     Number(s.stopsToday ?? 0),
          isOnline:       Boolean(s.isOnline),
        }));
        if (!cancelled) setDrivers(all);
      } catch { /* silent */ }
      finally { if (!cancelled) setLoading(false); }
    };

    load();
    const t = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(t); };
  }, [locationId]);

  if (!locationId || loading) return null;

  const riskDrivers = drivers.filter((d) => d.isOnline && ['C', 'D'].includes(d.grade));
  if (riskDrivers.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-700">
        <Shield className="h-4 w-4" />
        <span>Alle aktiven Fahrer: Note B oder besser</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-3 space-y-2">
      <div className="flex items-center gap-2 text-red-700 font-semibold text-sm">
        <AlertTriangle className="h-4 w-4" />
        <span>Score-Risiko: {riskDrivers.length} aktive{riskDrivers.length === 1 ? 'r' : ''} Fahrer</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {riskDrivers.map((d) => (
          <div
            key={d.driverId}
            className={cn(
              'flex items-center gap-1.5 rounded-lg border px-2 py-1 text-xs font-medium',
              GRADE_COLOR[d.grade] ?? GRADE_COLOR['D'],
            )}
          >
            <TrendingDown className="h-3 w-3" />
            <span>{d.driverName ?? 'Fahrer'}</span>
            <span className="font-bold">Note {d.grade}</span>
            <span className="opacity-75">({Math.round(d.compositeScore)} Pkt)</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-red-600">
        Übergabe sorgfältig koordinieren — diese Fahrer haben eine niedrigere Lieferqualität.
      </p>
    </div>
  );
}
