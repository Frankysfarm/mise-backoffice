'use client';

/**
 * FahrerSchichtPuls — Phase 337
 *
 * Schicht-Herzschlag für Fahrer: zeigt aktuellen Schichtstatus.
 * Pollt /api/delivery/driver/shift-status alle 30s (Fallback auf Mockdaten bei 404).
 * Zeigt: erledigte Stopps, verbleibende Stopps, Ø Stopp-Dauer, vergangene Schichtdauer.
 * Animierter Puls-Indikator wenn aktiv. Mobile-first.
 */

import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, MapPin, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShiftStatus {
  stopsDone: number;
  stopsRemaining: number;
  avgStopMin: number;
  shiftElapsedMin: number;
}

const MOCK: ShiftStatus = {
  stopsDone: 4,
  stopsRemaining: 3,
  avgStopMin: 8,
  shiftElapsedMin: 95,
};

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function FahrerSchichtPuls() {
  const [data, setData] = useState<ShiftStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function fetchData() {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    try {
      const res = await fetch('/api/delivery/driver/shift-status', {
        signal: abortRef.current.signal,
        cache: 'no-store',
      });
      if (res.status === 404) {
        if (!data) setData(MOCK);
        setActive(false);
        return;
      }
      if (!res.ok) throw new Error('not ok');
      const json = (await res.json()) as ShiftStatus;
      setData(json);
      setActive(json.shiftElapsedMin > 0);
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        if (!data) setData(MOCK);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30_000);
    return () => {
      clearInterval(iv);
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const d = data ?? MOCK;
  const totalStops = d.stopsDone + d.stopsRemaining;
  const progressPct = totalStops > 0 ? Math.round((d.stopsDone / totalStops) * 100) : 0;
  const etaRemainingMin = d.stopsRemaining * d.avgStopMin;

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-matcha-900 to-matcha-800 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        {/* Animated pulse dot */}
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          {active && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          )}
          <span className={cn(
            'relative inline-flex h-2.5 w-2.5 rounded-full',
            active ? 'bg-emerald-400' : 'bg-white/30',
          )} />
        </span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-matcha-300">
          Schicht-Puls
        </span>
        {loading && <Loader2 className="h-3 w-3 animate-spin text-matcha-400 ml-auto" />}
        {!loading && (
          <span className="ml-auto text-[10px] text-matcha-400 tabular-nums">
            {fmtDuration(d.shiftElapsedMin)} aktiv
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-matcha-400">
          <span>{d.stopsDone} erledigt</span>
          <span>{d.stopsRemaining} verbleibend</span>
        </div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="text-right text-[9px] text-matcha-500">{progressPct}% abgeschlossen</div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-3 gap-2">
        {/* Stopps erledigt */}
        <div className="flex flex-col items-center rounded-xl bg-white/5 px-2 py-2.5">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 mb-1 shrink-0" />
          <span className="font-mono text-lg font-black tabular-nums text-emerald-400 leading-none">
            {d.stopsDone}
          </span>
          <span className="text-[9px] text-matcha-500 mt-0.5 text-center">Erledigt</span>
        </div>

        {/* Verbleibende Stopps */}
        <div className="flex flex-col items-center rounded-xl bg-white/5 px-2 py-2.5">
          <MapPin className="h-4 w-4 text-amber-400 mb-1 shrink-0" />
          <span className="font-mono text-lg font-black tabular-nums text-amber-400 leading-none">
            {d.stopsRemaining}
          </span>
          <span className="text-[9px] text-matcha-500 mt-0.5 text-center">Verbleibend</span>
        </div>

        {/* Ø Stopp-Zeit */}
        <div className="flex flex-col items-center rounded-xl bg-white/5 px-2 py-2.5">
          <Clock className="h-4 w-4 text-matcha-400 mb-1 shrink-0" />
          <span className="font-mono text-lg font-black tabular-nums text-matcha-200 leading-none">
            {d.avgStopMin}
          </span>
          <span className="text-[9px] text-matcha-500 mt-0.5 text-center">Min/Stopp Ø</span>
        </div>
      </div>

      {/* ETA remaining */}
      {d.stopsRemaining > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
          <span className="text-[11px] text-matcha-400">Schätzung bis Tourende</span>
          <span className="font-mono text-sm font-black text-emerald-300 tabular-nums">
            ~{fmtDuration(etaRemainingMin)}
          </span>
        </div>
      )}
      {d.stopsRemaining === 0 && (
        <div className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-900/40 border border-emerald-700/50 px-3 py-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="text-sm font-black text-emerald-300">Tour abgeschlossen!</span>
        </div>
      )}
    </div>
  );
}
