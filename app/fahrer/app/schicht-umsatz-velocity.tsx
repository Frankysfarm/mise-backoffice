'use client';

/**
 * SchichtUmsatzVelocity — Phase 313
 *
 * Zeigt dem Fahrer die aktuelle Schicht-Einnahmen-Geschwindigkeit (€/Stunde)
 * im Vergleich zum Schicht-Ziel und gestern.
 * Polling 90 s auf /api/delivery/admin/revenue-velocity
 */

import { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Zap, Euro } from 'lucide-react';

interface VelocityData {
  todayRevenue: number;
  currentVelocity: number | null;
  peakVelocity: number | null;
  revenueDeltaPct: number | null;
  shiftProjection: number | null;
  paceLabel: 'ahead' | 'on_track' | 'behind' | 'no_data';
}

const PACE = {
  ahead:    { label: 'Über Plan',   ring: 'border-matcha-400', text: 'text-matcha-700', bar: 'bg-matcha-500' },
  on_track: { label: 'Im Plan',     ring: 'border-amber-400',  text: 'text-amber-700',  bar: 'bg-amber-400' },
  behind:   { label: 'Unter Plan',  ring: 'border-red-400',    text: 'text-red-700',    bar: 'bg-red-500' },
  no_data:  { label: 'Kein Signal', ring: 'border-gray-300',   text: 'text-gray-500',   bar: 'bg-gray-300' },
};

export function SchichtUmsatzVelocity({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<VelocityData | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/revenue-velocity?location_id=${locationId}`, { cache: 'no-store' });
      if (res.ok) setData(await res.json());
    } catch { /* ignore */ }
  };

  useEffect(() => {
    load();
    timer.current = setInterval(load, 90_000);
    return () => { if (timer.current) clearInterval(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId || !data) return null;

  const pace = PACE[data.paceLabel];
  const delta = data.revenueDeltaPct;
  const vel = data.currentVelocity;
  const peak = data.peakVelocity;
  const pct = vel && peak ? Math.min(100, Math.round((vel / peak) * 100)) : 0;

  return (
    <div className={`rounded-2xl border-2 ${pace.ring} bg-white px-4 py-3 w-full`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Zap className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold text-gray-700">Umsatz-Tempo</span>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 ${pace.text}`}>
          {pace.label}
        </span>
      </div>

      {/* Main velocity number */}
      <div className="flex items-end gap-1 mb-2">
        <Euro className="w-4 h-4 text-gray-400 mb-0.5 shrink-0" />
        <span className="text-3xl font-black text-gray-900 tabular-nums leading-none">
          {vel !== null ? Math.round(vel).toLocaleString('de-DE') : '—'}
        </span>
        <span className="text-sm text-gray-400 mb-0.5">/Std.</span>
        {delta !== null && (
          <span className={`flex items-center text-[11px] font-bold ml-2 mb-0.5 ${delta >= 0 ? 'text-matcha-600' : 'text-red-600'}`}>
            {delta >= 0 ? <TrendingUp className="w-3 h-3 mr-0.5" /> : <TrendingDown className="w-3 h-3 mr-0.5" />}
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Progress bar vs peak */}
      {peak !== null && peak > 0 && (
        <div className="mb-2">
          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
            <span>vs. Spitzenwert</span>
            <span>{pct}%</span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${pace.bar}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Sub row */}
      <div className="flex items-center justify-between text-[10px] text-gray-400">
        <span>Heute gesamt: <strong className="text-gray-700">
          {data.todayRevenue.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
        </strong></span>
        {data.shiftProjection !== null && (
          <span>Prognose: <strong className="text-gray-700">
            {data.shiftProjection.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })}
          </strong></span>
        )}
      </div>
    </div>
  );
}
