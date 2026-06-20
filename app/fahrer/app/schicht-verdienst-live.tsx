'use client';

import { useEffect, useState, useCallback } from 'react';
import { Euro, TrendingUp, Clock, Bike } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShiftStatus {
  stopsDone: number;
  stopsRemaining: number;
  avgStopMin: number;
  shiftElapsedMin: number;
}

interface Props {
  earningsEur: number;
  locationId?: string | null;
}

export function FahrerSchichtVerdienstLive({ earningsEur, locationId }: Props) {
  const [status, setStatus] = useState<ShiftStatus | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch('/api/delivery/driver/shift-status');
      if (res.ok) setStatus(await res.json() as ShiftStatus);
    } catch { /* ignore */ }
  }, [locationId]);

  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 30_000);
    return () => clearInterval(iv);
  }, [load]);

  const totalStops = (status?.stopsDone ?? 0) + (status?.stopsRemaining ?? 0);
  const eurPerStop = totalStops > 0 && status ? earningsEur / Math.max(status.stopsDone, 1) : null;
  const elapsedH = status ? status.shiftElapsedMin / 60 : null;
  const eurPerH = elapsedH && elapsedH > 0 ? earningsEur / elapsedH : null;

  const progPct = totalStops > 0 && status
    ? Math.round((status.stopsDone / totalStops) * 100)
    : null;

  const fmtEur = (v: number) =>
    v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <section className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Euro className="h-4 w-4 text-emerald-300" />
          <span className="text-xs font-bold uppercase tracking-wide text-white/80">
            Schicht-Verdienst Live
          </span>
        </div>
        <span className="text-xl font-black tabular-nums text-emerald-300">
          {fmtEur(earningsEur)} €
        </span>
      </div>

      {/* Progress bar */}
      {progPct !== null && (
        <div>
          <div className="flex justify-between text-[10px] text-white/60 mb-1">
            <span>{status?.stopsDone ?? 0} Stopps erledigt</span>
            <span>{status?.stopsRemaining ?? 0} verbleibend</span>
          </div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-emerald-400 rounded-full transition-all duration-700"
              style={{ width: `${progPct}%` }}
            />
          </div>
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-3 gap-2">
        {eurPerStop !== null && (
          <div className="bg-white/10 rounded-xl p-2.5 text-center">
            <div className="text-base font-black tabular-nums text-white">
              {fmtEur(eurPerStop)}
            </div>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <Bike className="h-2.5 w-2.5 text-white/60" />
              <span className="text-[9px] text-white/60">€ / Stopp</span>
            </div>
          </div>
        )}
        {eurPerH !== null && (
          <div className="bg-white/10 rounded-xl p-2.5 text-center">
            <div className="text-base font-black tabular-nums text-white">
              {fmtEur(eurPerH)}
            </div>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <TrendingUp className="h-2.5 w-2.5 text-white/60" />
              <span className="text-[9px] text-white/60">€ / Std</span>
            </div>
          </div>
        )}
        {status && (
          <div className="bg-white/10 rounded-xl p-2.5 text-center">
            <div className="text-base font-black tabular-nums text-white">
              {Math.round(status.shiftElapsedMin)}
            </div>
            <div className="flex items-center justify-center gap-1 mt-0.5">
              <Clock className="h-2.5 w-2.5 text-white/60" />
              <span className="text-[9px] text-white/60">Min Schicht</span>
            </div>
          </div>
        )}
      </div>

      {/* Avg stop time */}
      {status && status.avgStopMin > 0 && (
        <div className="text-[10px] text-white/50 text-center">
          Ø {status.avgStopMin.toFixed(1)} Min pro Stopp
          {eurPerStop !== null && status.avgStopMin > 0
            ? ` · ${(earningsEur / Math.max(status.stopsDone, 1) / status.avgStopMin * 60).toFixed(2)} €/h Pace`
            : ''}
        </div>
      )}
    </section>
  );
}
