'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Flag, MapPin, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';

type Stop = {
  id: string;
  reihenfolge: number;
  kunde_name?: string;
  kunde_adresse?: string | null;
  angekommen_am: string | null;
  geliefert_am: string | null;
  geschaetzte_lieferung_min?: number | null;
};

interface Props {
  stops: Stop[];
  startedAt: string | null;
  totalEtaMin?: number | null;
}

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(iv);
  }, [intervalMs]);
  return now;
}

function fmtTime(ms: number): string {
  const totalMin = Math.round(ms / 60_000);
  if (totalMin <= 0) return '0 Min';
  if (totalMin < 60) return `${totalMin} Min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h} Std` : `${h}:${String(m).padStart(2, '0')} Std`;
}

function fmtClock(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function FahrzeitPrognose({ stops, startedAt, totalEtaMin }: Props) {
  const now = useNow(15_000);

  const delivered = useMemo(() => stops.filter((s) => s.geliefert_am !== null), [stops]);
  const remaining = useMemo(
    () => stops.filter((s) => s.geliefert_am === null).sort((a, b) => a.reihenfolge - b.reihenfolge),
    [stops],
  );

  const elapsedMs = startedAt ? now - new Date(startedAt).getTime() : 0;
  const completionPct = stops.length > 0 ? Math.round((delivered.length / stops.length) * 100) : 0;

  const avgMinPerStop = useMemo(() => {
    if (delivered.length === 0 || elapsedMs <= 0) return null;
    return (elapsedMs / 60_000) / delivered.length;
  }, [delivered.length, elapsedMs]);

  const estimatedRemainingMs = useMemo(() => {
    if (remaining.length === 0) return 0;
    if (totalEtaMin !== null && totalEtaMin !== undefined && startedAt) {
      const totalMs = totalEtaMin * 60_000;
      const used = elapsedMs;
      return Math.max(0, totalMs - used);
    }
    if (avgMinPerStop !== null) {
      return remaining.length * avgMinPerStop * 60_000;
    }
    return remaining.length * 8 * 60_000;
  }, [remaining.length, totalEtaMin, startedAt, elapsedMs, avgMinPerStop]);

  const estimatedFinishMs = now + estimatedRemainingMs;

  if (stops.length === 0) return null;

  const isFinished = remaining.length === 0;

  return (
    <div className="rounded-2xl bg-white/10 border border-white/20 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-matcha-300 shrink-0" />
          <span className="text-xs font-bold text-matcha-200 uppercase tracking-wide">
            Tour-Prognose
          </span>
        </div>
        {!isFinished && (
          <div className="text-xs text-white/70 tabular-nums font-mono">
            ~{fmtTime(estimatedRemainingMs)} verbleibend
          </div>
        )}
        {isFinished && (
          <div className="rounded-full bg-matcha-500 px-2 py-0.5 text-[10px] font-black text-white">
            Tour abgeschlossen
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div>
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-matcha-400 transition-all duration-700"
            style={{ width: `${completionPct}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-white/50">
          <span>{delivered.length} geliefert</span>
          <span>{stops.length} gesamt</span>
        </div>
      </div>

      {/* ETA summary */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/8 border border-white/15 px-3 py-2">
          <div className="text-[10px] text-white/50 font-medium uppercase tracking-wide mb-0.5">Vergangen</div>
          <div className="text-sm font-black text-white tabular-nums">
            {fmtTime(elapsedMs)}
          </div>
        </div>
        <div className="rounded-xl bg-white/8 border border-white/15 px-3 py-2">
          <div className="text-[10px] text-white/50 font-medium uppercase tracking-wide mb-0.5">
            {isFinished ? 'Fertig um' : 'Prognose Ende'}
          </div>
          <div className={cn('text-sm font-black tabular-nums', isFinished ? 'text-matcha-300' : 'text-white')}>
            {fmtClock(isFinished ? now : estimatedFinishMs)}
          </div>
        </div>
      </div>

      {/* Next stops */}
      {remaining.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-semibold text-white/40 uppercase tracking-wide">
            Nächste Stopps ({remaining.length})
          </div>
          {remaining.slice(0, 3).map((stop, idx) => {
            const etaMs = now + (idx + 1) * (avgMinPerStop ?? 8) * 60_000;
            return (
              <div key={stop.id} className="flex items-center gap-2 text-xs">
                <div className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0',
                  idx === 0 ? 'bg-matcha-500 text-white' : 'bg-white/15 text-white/60',
                )}>
                  {stop.reihenfolge}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white/80 truncate text-[11px] font-medium">
                    {stop.kunde_adresse ?? stop.kunde_name ?? `Stop ${stop.reihenfolge}`}
                  </div>
                </div>
                <div className="shrink-0 text-[10px] text-white/50 font-mono tabular-nums">
                  ~{fmtClock(etaMs)}
                </div>
              </div>
            );
          })}
          {remaining.length > 3 && (
            <div className="text-[10px] text-white/40 pl-7">
              + {remaining.length - 3} weitere Stopps
            </div>
          )}
        </div>
      )}

      {/* Finish flag */}
      {isFinished && (
        <div className="flex items-center gap-2 rounded-xl bg-matcha-900/40 border border-matcha-500/40 px-3 py-2">
          <Flag className="h-4 w-4 text-matcha-400 shrink-0" />
          <span className="text-xs text-matcha-300 font-semibold">
            Alle {stops.length} Stopps abgeschlossen — Tour beendet!
          </span>
        </div>
      )}
    </div>
  );
}
