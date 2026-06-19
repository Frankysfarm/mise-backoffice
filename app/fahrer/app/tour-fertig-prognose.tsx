'use client';

/**
 * TourFertigPrognose — Phase 257
 *
 * Prognose-Panel für den Fahrer: Wann endet die aktuelle Tour?
 *
 * Berechnung:
 * - Verbleibende Stopps × Ø Zeit pro Stop (basierend auf bereits gelieferten)
 * - Oder Fallback: remaining_stops × 8 Min Standardzeit
 * - Zeigt erwartetes Tour-Ende + Vergleich mit Schicht-Ziel
 *
 * Design: Dark Matcha theme passend zur Fahrer-App.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2, Clock, Target, TrendingUp, Zap } from 'lucide-react';

type Stop = {
  id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
};

interface Props {
  stops: Stop[];
  batchStartedAt: string | null;
  shiftEndAt?: string | null;
}

function useTick() {
  const [, set] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => set(n => n + 1), 30_000);
    return () => clearInterval(iv);
  }, []);
}

function fmtTime(ms: number): string {
  const date = new Date(ms);
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtMin(min: number): string {
  if (min < 60) return `${min} Min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h} h ${m} Min` : `${h} h`;
}

export function TourFertigPrognose({ stops, batchStartedAt, shiftEndAt }: Props) {
  useTick();

  if (stops.length === 0) return null;

  const now = Date.now();
  const completed = stops.filter(s => !!s.geliefert_am);
  const pending = stops.filter(s => !s.geliefert_am);

  if (pending.length === 0) return null;

  // Ø Zeit pro Stop (in Minuten) aus abgeschlossenen Stops berechnen
  let avgMinPerStop = 8; // Fallback
  if (completed.length >= 2 && batchStartedAt) {
    const startMs = new Date(batchStartedAt).getTime();
    const lastDelivery = completed.reduce<string | null>((acc, s) => {
      if (!s.geliefert_am) return acc;
      if (!acc) return s.geliefert_am;
      return s.geliefert_am > acc ? s.geliefert_am : acc;
    }, null);
    if (lastDelivery) {
      const elapsedMin = Math.max(1, (new Date(lastDelivery).getTime() - startMs) / 60_000);
      avgMinPerStop = Math.round(elapsedMin / completed.length);
    }
  }

  avgMinPerStop = Math.min(30, Math.max(4, avgMinPerStop));

  const estimatedRemainingMin = pending.length * avgMinPerStop;
  const estimatedEndMs = now + estimatedRemainingMin * 60_000;
  const elapsedMin = batchStartedAt
    ? Math.floor((now - new Date(batchStartedAt).getTime()) / 60_000)
    : 0;

  // Schicht-Kompatibilität
  const shiftOk = shiftEndAt
    ? estimatedEndMs <= new Date(shiftEndAt).getTime()
    : true;
  const shiftEndMs = shiftEndAt ? new Date(shiftEndAt).getTime() : null;
  const overflowMin = shiftEndMs
    ? Math.max(0, Math.round((estimatedEndMs - shiftEndMs) / 60_000))
    : 0;

  const allDone = completed.length === stops.length;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10 bg-white/5">
        <Target className="h-3.5 w-3.5 text-accent shrink-0" />
        <span className="text-[10px] font-black uppercase tracking-widest text-accent">
          Tour-Prognose
        </span>
        {allDone && (
          <CheckCircle2 className="h-3.5 w-3.5 text-accent ml-auto shrink-0" />
        )}
      </div>

      <div className="px-4 py-3 space-y-3">
        {/* ETA Fertig */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] text-matcha-400 font-semibold uppercase tracking-wide">
              Voraussichtlich fertig
            </div>
            <div className="text-2xl font-black text-matcha-50 tabular-nums mt-0.5">
              {fmtTime(estimatedEndMs)}
            </div>
            <div className="text-[10px] text-matcha-400 mt-0.5">
              Noch ca. {fmtMin(estimatedRemainingMin)}
            </div>
          </div>

          {/* Mini Progress */}
          <div className="shrink-0 flex flex-col items-end gap-1">
            <div className="text-[10px] text-matcha-400">
              {completed.length}/{stops.length} Stopps
            </div>
            <div className="w-24 h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-accent transition-all duration-700"
                style={{ width: `${stops.length > 0 ? (completed.length / stops.length) * 100 : 0}%` }}
              />
            </div>
            <div className="text-[10px] text-matcha-500">
              ∅ {avgMinPerStop} Min/Stop
            </div>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white/5 px-2 py-2 text-center">
            <div className="text-sm font-black text-matcha-50 tabular-nums">{pending.length}</div>
            <div className="text-[9px] text-matcha-500 mt-0.5">verbleibend</div>
          </div>
          <div className="rounded-xl bg-white/5 px-2 py-2 text-center">
            <div className="text-sm font-black text-matcha-50 tabular-nums">{elapsedMin}</div>
            <div className="text-[9px] text-matcha-500 mt-0.5">min aktiv</div>
          </div>
          <div className={cn(
            'rounded-xl px-2 py-2 text-center',
            shiftOk ? 'bg-accent/10' : 'bg-red-500/10',
          )}>
            <div className={cn('text-sm font-black tabular-nums', shiftOk ? 'text-accent' : 'text-red-400')}>
              {shiftOk ? 'OK' : `+${overflowMin}m`}
            </div>
            <div className="text-[9px] text-matcha-500 mt-0.5">Schicht</div>
          </div>
        </div>

        {/* Schicht-Überlauf Warnung */}
        {!shiftOk && overflowMin > 0 && (
          <div className="flex items-center gap-1.5 rounded-xl bg-red-500/10 border border-red-400/20 px-3 py-2">
            <TrendingUp className="h-3.5 w-3.5 text-red-400 shrink-0" />
            <span className="text-[11px] font-bold text-red-300">
              Tour endet {overflowMin} Min nach Schichtende
            </span>
          </div>
        )}

        {shiftOk && shiftEndMs && (
          <div className="flex items-center gap-1.5 text-[10px] text-matcha-500">
            <Zap className="h-3 w-3 text-accent shrink-0" />
            Schicht endet um {fmtTime(shiftEndMs)} — passt!
          </div>
        )}
      </div>
    </div>
  );
}
