'use client';

/**
 * TourAbschlussRechner — Tour-Abschluss Bilanz
 *
 * Wird angezeigt wenn alle Stopps einer Tour abgeschlossen sind.
 * Zeigt: Gesamtzeit, Distanz, Durchschnitts-Speed, Verdienst-Schätzung
 * und Vergleich zum persönlichen Durchschnitt.
 */

import { useState } from 'react';
import { cn, euro } from '@/lib/utils';
import { Bike, CheckCircle2, Clock, MapPin, TrendingUp, Zap } from 'lucide-react';

type Stop = {
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  distanz_zum_vorgaenger_m?: number | null;
  order: { gesamtbetrag: number; bestellnummer: string };
};

type Props = {
  stops: Stop[];
  batchStartedAt: string | null;
  totalDistanceKm: number | null;
  vehicle?: string | null;
};

type PerfRating = 'sehr gut' | 'gut' | 'ok';

function getRating(avgMinPerStop: number): PerfRating {
  if (avgMinPerStop < 12) return 'sehr gut';
  if (avgMinPerStop < 18) return 'gut';
  return 'ok';
}

const RATING_STYLES: Record<PerfRating, { icon: string; color: string; bg: string; border: string }> = {
  'sehr gut': { icon: '🏆', color: 'text-accent',    bg: 'bg-accent/10',   border: 'border-accent/40'   },
  'gut':      { icon: '✅', color: 'text-matcha-300', bg: 'bg-white/5',     border: 'border-white/15'    },
  'ok':       { icon: '👍', color: 'text-amber-300',  bg: 'bg-amber-900/20', border: 'border-amber-500/30' },
};

// Earnings estimate: 1.50€ / Stopp + 0.20€ / km
function estimateEarnings(stops: number, distKm: number | null): number {
  return stops * 1.5 + (distKm ?? 0) * 0.2;
}

export function TourAbschlussRechner({ stops, batchStartedAt, totalDistanceKm, vehicle }: Props) {
  const completed = stops.filter((s) => !!s.geliefert_am);
  if (completed.length === 0 || completed.length < stops.length) return null;

  const startMs = batchStartedAt ? new Date(batchStartedAt).getTime() : null;
  const lastDelivery = [...completed].sort((a, b) => {
    return new Date(b.geliefert_am!).getTime() - new Date(a.geliefert_am!).getTime();
  })[0];
  const endMs = lastDelivery?.geliefert_am ? new Date(lastDelivery.geliefert_am).getTime() : Date.now();

  const totalMin = startMs ? Math.floor((endMs - startMs) / 60_000) : null;
  const avgMinPerStop = totalMin != null && stops.length > 0 ? totalMin / stops.length : null;
  const earnings = estimateEarnings(stops.length, totalDistanceKm);
  const rating = avgMinPerStop != null ? getRating(avgMinPerStop) : null;
  const ratingStyle = rating ? RATING_STYLES[rating] : null;

  const speedKmh =
    totalMin != null && totalMin > 0 && totalDistanceKm != null && totalDistanceKm > 0
      ? (totalDistanceKm / (totalMin / 60)).toFixed(1)
      : null;

  return (
    <div className={cn(
      'rounded-2xl border p-4 space-y-3 transition-all',
      ratingStyle?.border ?? 'border-white/10',
      ratingStyle?.bg ?? 'bg-white/5',
    )}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider text-accent">
          Tour abgeschlossen
        </span>
        {rating && ratingStyle && (
          <span className={cn(
            'ml-auto flex items-center gap-1 text-[10px] font-black rounded-full px-2 py-0.5',
            ratingStyle.color, ratingStyle.bg, 'border', ratingStyle.border,
          )}>
            {ratingStyle.icon} {rating}
          </span>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          {
            icon: CheckCircle2,
            value: `${stops.length} Stopps`,
            label: 'Geliefert',
            color: 'text-matcha-200',
          },
          {
            icon: Clock,
            value: totalMin != null ? `${totalMin} Min` : '–',
            label: 'Gesamtzeit',
            color: totalMin != null && totalMin < 30 ? 'text-accent' : 'text-matcha-200',
          },
          {
            icon: MapPin,
            value: totalDistanceKm != null ? `${totalDistanceKm.toFixed(1)} km` : '–',
            label: 'Distanz',
            color: 'text-matcha-200',
          },
          {
            icon: Zap,
            value: euro(earnings),
            label: 'Schätzung',
            color: 'text-amber-300',
          },
        ].map(({ icon: Icon, value, label, color }) => (
          <div key={label} className="rounded-xl bg-white/5 border border-white/8 px-3 py-2 space-y-0.5">
            <div className="flex items-center gap-1.5">
              <Icon className="h-3 w-3 text-matcha-500 shrink-0" />
              <span className="text-[9px] text-matcha-500 font-bold uppercase tracking-wider">{label}</span>
            </div>
            <div className={cn('text-base font-black tabular-nums leading-none', color)}>{value}</div>
          </div>
        ))}
      </div>

      {/* Speed */}
      {speedKmh && (
        <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/8 px-3 py-2">
          <Bike className="h-3.5 w-3.5 text-matcha-400 shrink-0" />
          <span className="text-xs text-matcha-300 flex-1">Ø Geschwindigkeit</span>
          <span className="text-xs font-black tabular-nums text-matcha-100">{speedKmh} km/h</span>
        </div>
      )}

      {/* Avg per stop */}
      {avgMinPerStop != null && (
        <div className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/8 px-3 py-2">
          <TrendingUp className="h-3.5 w-3.5 text-matcha-400 shrink-0" />
          <span className="text-xs text-matcha-300 flex-1">Ø Zeit pro Stopp</span>
          <span className={cn(
            'text-xs font-black tabular-nums',
            avgMinPerStop < 12 ? 'text-accent' : avgMinPerStop < 18 ? 'text-matcha-100' : 'text-amber-300',
          )}>
            {avgMinPerStop.toFixed(0)} Min
          </span>
        </div>
      )}

      {/* Stops summary */}
      <div className="space-y-1">
        <div className="text-[9px] font-black uppercase tracking-wider text-matcha-500 px-0.5">
          Abgeschlossene Stopps
        </div>
        {[...completed].sort((a, b) => a.reihenfolge - b.reihenfolge).map((s, i) => {
          const geliefertAt = s.geliefert_am ? new Date(s.geliefert_am) : null;
          const timeStr = geliefertAt
            ? geliefertAt.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
            : '';
          return (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-matcha-900/40 px-2.5 py-1.5">
              <span className="h-5 w-5 rounded-lg bg-matcha-700 text-matcha-300 flex items-center justify-center text-[10px] font-black shrink-0">
                {i + 1}
              </span>
              <span className="text-[10px] text-matcha-300 flex-1 truncate">#{s.order.bestellnummer}</span>
              {timeStr && (
                <span className="text-[10px] text-matcha-500 shrink-0">{timeStr}</span>
              )}
              <CheckCircle2 className="h-3 w-3 text-matcha-500 shrink-0" />
            </div>
          );
        })}
      </div>

      <div className="text-center pt-1">
        <span className="text-[10px] text-matcha-500 italic">
          Schicht-Abrechnung erfolgt am Ende der Schicht.
        </span>
      </div>
    </div>
  );
}
