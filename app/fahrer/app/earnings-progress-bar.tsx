'use client';

/**
 * EarningsProgressBar
 *
 * Zeigt dem Fahrer seinen Schicht-Verdienst in Echtzeit an:
 * - Bisherige Einnahmen aus kassierten Baraufträgen
 * - Anzahl Stopps + durchschnittliche Zeit pro Stopp
 * - Einfacher Fortschrittsbalken bis Tagesziel (Default: 80 €)
 *
 * Wird in der Fahrer-App unterhalb des Schicht-Panels angezeigt.
 */

import React, { useMemo } from 'react';
import { cn, euro } from '@/lib/utils';
import { Euro, Zap, Clock, MapPin } from 'lucide-react';

type Stop = {
  id: string;
  reihenfolge: number;
  geliefert_am: string | null;
  angekommen_am: string | null;
  order: {
    gesamtbetrag: number;
    zahlungsart?: string | null;
    bezahlt?: boolean | null;
  };
};

type ActiveBatch = {
  id: string;
  status: string;
  started_at: string | null;
  stops: Stop[];
};

interface Props {
  completedBatches: number;
  totalDeliveries: number;
  cashCollected: number;
  onlineSinceIso: string | null;
  activeBatch: ActiveBatch | null;
  dailyTargetEur?: number;
}

function fmtDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 60) return `${totalMin} Min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function EarningsProgressBar({
  completedBatches,
  totalDeliveries,
  cashCollected,
  onlineSinceIso,
  activeBatch,
  dailyTargetEur = 80,
}: Props) {
  const onlineMs = useMemo(
    () => (onlineSinceIso ? Date.now() - new Date(onlineSinceIso).getTime() : 0),
    [onlineSinceIso],
  );

  // Deliveries in current active batch
  const currentBatchCompleted = activeBatch?.stops.filter((s) => s.geliefert_am != null).length ?? 0;
  const totalDone = totalDeliveries + currentBatchCompleted;

  // Cash from active batch (already delivered stops)
  const activeCash = activeBatch?.stops
    .filter((s) => s.geliefert_am != null && !s.order.bezahlt && (s.order.zahlungsart === 'bar' || s.order.zahlungsart === 'ec'))
    .reduce((sum, s) => sum + s.order.gesamtbetrag, 0) ?? 0;

  const totalCash = cashCollected + activeCash;

  const pct = Math.min(100, Math.round((totalCash / dailyTargetEur) * 100));

  const avgMinPerDelivery = totalDone > 0 && onlineMs > 0
    ? Math.round(onlineMs / totalDone / 60_000)
    : null;

  const barColor =
    pct >= 100 ? 'bg-accent' :
    pct >= 75  ? 'bg-matcha-400' :
    pct >= 50  ? 'bg-amber-400' :
    'bg-white/30';

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-accent">
          <Euro className="h-4 w-4" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">Schicht-Einnahmen</span>
        </div>
        {pct >= 100 && (
          <span className="flex items-center gap-1 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-black text-accent">
            <Zap className="h-3 w-3" />
            Tagesziel erreicht!
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-end justify-between text-[11px]">
          <span className="font-black text-2xl text-matcha-50 tabular-nums">{euro(totalCash)}</span>
          <span className="text-matcha-400">Ziel: {euro(dailyTargetEur)}</span>
        </div>
        <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-700', barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-matcha-500">
          <span>0 €</span>
          <span className="font-bold text-matcha-300">{pct}%</span>
          <span>{euro(dailyTargetEur)}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 border-t border-white/10 pt-2">
        <div className="flex flex-col items-center gap-0.5">
          <MapPin className="h-3.5 w-3.5 text-matcha-400" />
          <span className="font-black text-matcha-50 text-sm tabular-nums">{totalDone}</span>
          <span className="text-[9px] text-matcha-500">Stopps</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <Clock className="h-3.5 w-3.5 text-matcha-400" />
          <span className="font-black text-matcha-50 text-sm tabular-nums">
            {avgMinPerDelivery != null ? `${avgMinPerDelivery} Min` : '—'}
          </span>
          <span className="text-[9px] text-matcha-500">Ø/Stopp</span>
        </div>
        <div className="flex flex-col items-center gap-0.5">
          <Zap className="h-3.5 w-3.5 text-matcha-400" />
          <span className="font-black text-matcha-50 text-sm tabular-nums">
            {onlineMs > 0 ? fmtDuration(onlineMs) : '—'}
          </span>
          <span className="text-[9px] text-matcha-500">Online</span>
        </div>
      </div>
    </div>
  );
}
