'use client';

/**
 * FahrerTrinkgeldPrognose — Phase 487
 * Trinkgeld-Prognose für die aktuelle Schicht.
 *
 * Berechnung:
 *  - Erlöste Stops heute: aus abgeschlossenen Tour-Stops
 *  - Historische Trinkgeld-Rate: mock €1.20 / Lieferung (Schicht-Durchschnitt)
 *  - Verbleibende Stops: aktuelle Tour
 *  - Prognose: (abgeschl. + verbleib.) × Rate
 *
 * Design: Dark mobile-first (bg-gray-900)
 */

import { useMemo } from 'react';
import { Euro, TrendingUp, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

type Stop = {
  id: string;
  geliefert_am: string | null;
  reihenfolge: number;
};

const TIP_RATE_EUR = 1.2;

function fmtEur(cents: number) {
  return (cents / 100).toFixed(2).replace('.', ',') + ' €';
}

export function FahrerTrinkgeldPrognose({
  completedStops,
  remainingStops,
  earnedTipsCents = 0,
}: {
  completedStops: number;
  remainingStops: number;
  earnedTipsCents?: number;
}) {
  const { prognoseCents, earnedCents, progressPct } = useMemo(() => {
    const earned = earnedTipsCents > 0 ? earnedTipsCents : Math.round(completedStops * TIP_RATE_EUR * 100);
    const prognose = earned + Math.round(remainingStops * TIP_RATE_EUR * 100);
    const pct = prognose > 0 ? Math.min(100, Math.round((earned / prognose) * 100)) : 0;
    return { prognoseCents: prognose, earnedCents: earned, progressPct: pct };
  }, [completedStops, remainingStops, earnedTipsCents]);

  if (completedStops === 0 && remainingStops === 0) return null;

  const totalDeliveries = completedStops + remainingStops;
  const rateColor =
    TIP_RATE_EUR >= 1.5 ? 'text-matcha-400' : TIP_RATE_EUR >= 1.0 ? 'text-amber-400' : 'text-stone-400';

  return (
    <div className="mx-4 mt-3 rounded-2xl bg-gray-900 text-white overflow-hidden shadow-lg">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/10">
        <Euro className="h-4 w-4 text-amber-400 shrink-0" />
        <span className="text-xs font-black uppercase tracking-widest text-white/80">
          Trinkgeld-Prognose
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
          <span className={cn('text-[10px] font-bold', rateColor)}>
            Ø {TIP_RATE_EUR.toFixed(2).replace('.', ',')} €/Stopp
          </span>
        </div>
      </div>

      {/* Main numbers */}
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="flex-1">
          <div className="text-[10px] text-white/50 mb-0.5">Bisher verdient (est.)</div>
          <div className="text-2xl font-black tabular-nums text-amber-400">
            {fmtEur(earnedCents)}
          </div>
        </div>
        <div className="h-12 w-px bg-white/10" />
        <div className="flex-1 text-right">
          <div className="text-[10px] text-white/50 mb-0.5">Prognose gesamt</div>
          <div className="flex items-center justify-end gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-matcha-400 shrink-0" />
            <span className="text-2xl font-black tabular-nums text-matcha-400">
              {fmtEur(prognoseCents)}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="px-4 pb-2">
        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-amber-400 transition-all duration-700"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Stats footer */}
      <div className="flex items-center gap-4 border-t border-white/10 px-4 py-2.5">
        <div className="text-[10px] text-white/50">
          <span className="font-bold text-white">{completedStops}</span> abgschl.
        </div>
        <div className="text-[10px] text-white/50">
          <span className="font-bold text-white">{remainingStops}</span> verbleib.
        </div>
        <div className="text-[10px] text-white/50">
          <span className="font-bold text-white">{totalDeliveries}</span> gesamt
        </div>
        <div className="ml-auto text-[10px] text-white/40">
          Schätzung, inkl. laufende Tour
        </div>
      </div>
    </div>
  );
}
