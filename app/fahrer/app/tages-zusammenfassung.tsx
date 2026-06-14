'use client';

/**
 * FahrerTagesZusammenfassung
 *
 * Live-Zusammenfassung der aktuellen Schicht für den Fahrer.
 * Zeigt Gesamtleistung: Stopps, Touren, Ø-Zeit, Strecke, Einnahmen.
 * Erscheint als aufklappbare Karte im Warte-Zustand.
 *
 * Daten-Quelle: Props vom Eltern-Component (FahrerApp state).
 */

import { useMemo, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import {
  Award, Banknote, CheckCircle2, ChevronDown, ChevronUp,
  Clock, MapPin, Route, Star, TrendingUp, Zap,
} from 'lucide-react';

interface ShiftStop {
  id: string;
  geliefert_am: string | null;
  angekommen_am: string | null;
  order: {
    gesamtbetrag: number;
    zahlungsart?: string | null;
    bezahlt?: boolean | null;
  };
}

interface CompletedBatch {
  id: string;
  started_at: string | null;
  completed_at?: string | null;
  total_distance_km?: number | null;
  stops: ShiftStop[];
}

interface Props {
  driverId: string;
  completedBatches: CompletedBatch[];
  totalDeliveries: number;
  cashCollected: number;
  onlineSeit: string | null;
  currentBatchStops?: number;
}

type PerformanceTier = 'gold' | 'silver' | 'normal';

function getPerformanceTier(stopsPerHour: number): PerformanceTier {
  if (stopsPerHour >= 4) return 'gold';
  if (stopsPerHour >= 2.5) return 'silver';
  return 'normal';
}

const TIER_CONFIG: Record<PerformanceTier, { icon: string; label: string; color: string; bg: string }> = {
  gold:   { icon: '🥇', label: 'Spitzenleistung!',  color: 'text-amber-600', bg: 'bg-amber-500/10 border-amber-500/30' },
  silver: { icon: '🥈', label: 'Gute Leistung',     color: 'text-stone-400', bg: 'bg-white/5 border-white/10'          },
  normal: { icon: '💪', label: 'Weiter so!',         color: 'text-matcha-400', bg: 'bg-white/5 border-white/10'         },
};

function fmtDuration(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m} Min`;
  return `${Math.floor(m / 60)}h ${m % 60 > 0 ? `${m % 60}m` : ''}`.trim();
}

export function FahrerTagesZusammenfassung({
  completedBatches,
  totalDeliveries,
  cashCollected,
  onlineSeit,
  currentBatchStops = 0,
}: Props) {
  const [open, setOpen] = useState(false);

  const stats = useMemo(() => {
    const now = Date.now();
    const onlineMs = onlineSeit ? now - new Date(onlineSeit).getTime() : 0;
    const onlineHours = onlineMs / 3_600_000;

    const totalStops = totalDeliveries + currentBatchStops;

    // Total distance
    const totalKm = completedBatches.reduce(
      (sum, b) => sum + (b.total_distance_km ?? 0), 0,
    );

    // Avg time per batch (minutes)
    const batchTimes = completedBatches
      .filter(b => b.started_at && b.completed_at)
      .map(b => (new Date(b.completed_at!).getTime() - new Date(b.started_at!).getTime()) / 60_000);
    const avgBatchMin = batchTimes.length > 0
      ? Math.round(batchTimes.reduce((s, v) => s + v, 0) / batchTimes.length)
      : null;

    // Stops per hour
    const stopsPerHour = onlineHours > 0.1 ? totalStops / onlineHours : 0;

    // Performance tier
    const tier = getPerformanceTier(stopsPerHour);

    return {
      totalStops,
      totalKm: Math.round(totalKm * 10) / 10,
      onlineMs,
      avgBatchMin,
      stopsPerHour: Math.round(stopsPerHour * 10) / 10,
      completedBatches: completedBatches.length,
      cashCollected,
      tier,
    };
  }, [completedBatches, totalDeliveries, cashCollected, onlineSeit, currentBatchStops]);

  // Only show if driver has done at least 1 stop
  if (stats.totalStops === 0 && stats.onlineMs < 300_000) return null;

  const tierCfg = TIER_CONFIG[stats.tier];

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent shrink-0" />
          <span className="font-display text-sm font-bold uppercase tracking-wider text-accent">
            Schicht-Übersicht
          </span>
          {stats.totalStops > 0 && (
            <span className="rounded-full bg-accent/15 border border-accent/30 px-2 py-0.5 text-[10px] font-bold text-accent">
              {stats.totalStops} Stop{stats.totalStops !== 1 ? 'ps' : ''}
            </span>
          )}
        </div>
        {open
          ? <ChevronUp className="h-4 w-4 text-matcha-500 shrink-0" />
          : <ChevronDown className="h-4 w-4 text-matcha-500 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-white/8 px-4 pb-4 pt-3 space-y-3">
          {/* Performance tier badge */}
          <div className={cn('flex items-center gap-2.5 rounded-xl border px-3 py-2', tierCfg.bg)}>
            <span className="text-xl">{tierCfg.icon}</span>
            <div>
              <div className={cn('text-xs font-black', tierCfg.color)}>{tierCfg.label}</div>
              <div className="text-[10px] text-matcha-400">
                {stats.stopsPerHour > 0 ? `${stats.stopsPerHour} Stopps/h` : 'Weiter im Einsatz'}
              </div>
            </div>
            {stats.tier === 'gold' && (
              <Award className="h-5 w-5 text-amber-400 ml-auto shrink-0" />
            )}
            {stats.tier === 'silver' && (
              <Star className="h-5 w-5 text-stone-300 ml-auto shrink-0" />
            )}
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-white/5 border border-white/8 px-3 py-2.5 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-matcha-400 shrink-0" />
              <div>
                <div className="font-black text-matcha-50 text-lg tabular-nums leading-none">
                  {stats.totalStops}
                </div>
                <div className="text-[9px] text-matcha-500 mt-0.5">Stopps</div>
              </div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/8 px-3 py-2.5 flex items-center gap-2">
              <Route className="h-4 w-4 text-matcha-400 shrink-0" />
              <div>
                <div className="font-black text-matcha-50 text-lg tabular-nums leading-none">
                  {stats.totalKm > 0 ? `${stats.totalKm}` : '—'}
                </div>
                <div className="text-[9px] text-matcha-500 mt-0.5">km gefahren</div>
              </div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/8 px-3 py-2.5 flex items-center gap-2">
              <Clock className="h-4 w-4 text-matcha-400 shrink-0" />
              <div>
                <div className="font-black text-matcha-50 text-lg tabular-nums leading-none">
                  {stats.onlineMs > 0 ? fmtDuration(stats.onlineMs) : '—'}
                </div>
                <div className="text-[9px] text-matcha-500 mt-0.5">Online-Zeit</div>
              </div>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/8 px-3 py-2.5 flex items-center gap-2">
              <Zap className="h-4 w-4 text-matcha-400 shrink-0" />
              <div>
                <div className="font-black text-matcha-50 text-lg tabular-nums leading-none">
                  {stats.completedBatches}
                </div>
                <div className="text-[9px] text-matcha-500 mt-0.5">Touren</div>
              </div>
            </div>
          </div>

          {/* Cash collected (only if > 0) */}
          {stats.cashCollected > 0 && (
            <div className="flex items-center gap-2.5 rounded-xl bg-amber-500/10 border border-amber-400/20 px-3 py-2.5">
              <Banknote className="h-4 w-4 text-amber-400 shrink-0" />
              <div>
                <div className="text-xs font-black text-amber-300">
                  {euro(stats.cashCollected)} kassiert
                </div>
                <div className="text-[9px] text-amber-600">Bar-/EC-Einnahmen diese Schicht</div>
              </div>
            </div>
          )}

          {/* Avg batch time */}
          {stats.avgBatchMin !== null && (
            <div className="flex items-center justify-between text-[10px] text-matcha-500 px-1">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Ø Tour-Dauer
              </span>
              <span className="font-bold text-matcha-300">{stats.avgBatchMin} Min</span>
            </div>
          )}

          {/* Completion message */}
          {stats.totalStops >= 10 && (
            <div className="flex items-center gap-1.5 rounded-xl bg-accent/10 border border-accent/20 px-3 py-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-accent shrink-0" />
              <span className="text-[11px] font-bold text-accent">
                Starke Schicht! {stats.totalStops} Stopps erledigt.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
