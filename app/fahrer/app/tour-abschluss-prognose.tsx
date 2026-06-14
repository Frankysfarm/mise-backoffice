'use client';

/**
 * TourAbschlussPrognose — Tourende-Schätzung für Fahrer
 *
 * Berechnet aus verbleibenden Stopps + Ø Lieferzeit pro Stopp,
 * wann die aktuelle Tour voraussichtlich abgeschlossen ist.
 *
 * Zeigt:
 *  - Fortschrittsring (erledigte / gesamt Stopps)
 *  - Geschätzte Tourende-Zeit
 *  - Verbleibende Stopps mit ETA
 *  - Potenzielle Schichtverlängerung wenn Tourende > geplantes Schichtende
 */

import { useEffect, useState } from 'react';
import { cn, euro } from '@/lib/utils';
import { CheckCircle2, Clock, Flag, MapPin, Route, Timer, TrendingUp } from 'lucide-react';

type Stop = {
  id: string;
  reihenfolge: number;
  angekommen_am: string | null;
  geliefert_am: string | null;
  distanz_zum_vorgaenger_m?: number | null;
  order: {
    bestellnummer: string;
    kunde_name: string;
    gesamtbetrag: number;
    eta_earliest?: string | null;
    eta_latest?: string | null;
  };
};

type Props = {
  stops: Stop[];
  batchStartedAt: string | null;
  totalEtaMin?: number | null;
};

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtMin(min: number): string {
  if (min < 60) return `${min} Min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((n) => n + 1), 10_000);
    return () => clearInterval(iv);
  }, []);
}

export function TourAbschlussPrognose({ stops, batchStartedAt, totalEtaMin }: Props) {
  useTick();

  if (!stops || stops.length === 0) return null;

  const delivered = stops.filter((s) => s.geliefert_am != null).length;
  const total     = stops.length;
  const remaining = total - delivered;

  const progressPct = total > 0 ? Math.round((delivered / total) * 100) : 0;

  // Ø Zeit pro Stopp berechnen aus bereits erledigten Stopps
  const completedStops = stops.filter((s) => s.geliefert_am && s.angekommen_am);
  const avgStopMinutes: number = (() => {
    if (completedStops.length === 0) return 8; // Fallback
    const totalMs = completedStops.reduce((acc, s) => {
      return acc + (new Date(s.geliefert_am!).getTime() - new Date(s.angekommen_am!).getTime());
    }, 0);
    return Math.max(3, Math.round(totalMs / completedStops.length / 60_000));
  })();

  // Geschätzte Endzeit
  const now = Date.now();
  let estimatedEndMs: number;

  if (totalEtaMin != null && batchStartedAt) {
    // Server-seitige ETA nutzen wenn vorhanden
    estimatedEndMs = new Date(batchStartedAt).getTime() + totalEtaMin * 60_000;
  } else {
    // Eigene Schätzung: verbleibende Stopps × Ø Zeit
    const remainingIntervalMin = 5; // Ø Fahrzeit zwischen Stopps
    estimatedEndMs = now + remaining * (avgStopMinutes + remainingIntervalMin) * 60_000;
  }

  const remainingMin = Math.max(0, Math.round((estimatedEndMs - now) / 60_000));
  const estimatedEnd = new Date(estimatedEndMs);

  // Farbe basierend auf Fortschritt
  const progressColor = progressPct >= 80 ? '#4ade80' : progressPct >= 50 ? '#60a5fa' : '#fb923c';

  // SVG Ring
  const R = 36;
  const C = 2 * Math.PI * R;
  const dashOffset = C * (1 - progressPct / 100);

  return (
    <div className="rounded-2xl bg-matcha-900/80 border border-matcha-700/50 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Route className="h-4 w-4 text-matcha-400 shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider text-matcha-300">
          Tour-Prognose
        </span>
        {remaining === 0 && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-black text-matcha-700 bg-matcha-400 rounded-full px-2 py-0.5">
            <CheckCircle2 className="h-2.5 w-2.5" />
            Tour abgeschlossen!
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        {/* Fortschrittsring */}
        <div className="relative flex-none w-[88px] h-[88px] flex items-center justify-center">
          <svg className="-rotate-90" width="88" height="88" viewBox="0 0 88 88">
            <circle cx="44" cy="44" r={R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
            <circle
              cx="44" cy="44" r={R}
              fill="none"
              stroke={progressColor}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={dashOffset}
              style={{ transition: 'stroke-dashoffset 0.6s ease-out' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-black text-white tabular-nums">{delivered}</span>
            <span className="text-[9px] text-matcha-400 font-bold">/ {total}</span>
          </div>
        </div>

        {/* Rechte Spalte: Endzeit + Stats */}
        <div className="flex-1 space-y-2">
          <div>
            <div className="text-[9px] font-bold uppercase tracking-wider text-matcha-400">
              Voraussichtliches Tourende
            </div>
            <div className="flex items-baseline gap-1.5 mt-0.5">
              <span className="text-2xl font-black text-white tabular-nums">
                {fmtTime(estimatedEnd)}
              </span>
              {remaining > 0 && (
                <span className="text-[11px] text-matcha-400 font-semibold">
                  (noch {fmtMin(remainingMin)})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Flag className="h-3 w-3 text-matcha-400" />
              <span className="text-[10px] text-matcha-300">
                <span className="font-black text-white">{remaining}</span> offen
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Timer className="h-3 w-3 text-matcha-400" />
              <span className="text-[10px] text-matcha-300">
                Ø <span className="font-bold text-white">{avgStopMinutes}</span> Min/Stopp
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Verbleibende Stopps */}
      {remaining > 0 && (
        <div className="space-y-1 pt-1 border-t border-matcha-700/40">
          <div className="text-[9px] font-bold uppercase tracking-wider text-matcha-500 mb-1.5">
            Verbleibende Stopps
          </div>
          {stops
            .filter((s) => !s.geliefert_am)
            .sort((a, b) => a.reihenfolge - b.reihenfolge)
            .slice(0, 4)
            .map((stop, i) => {
              const etaMs = stop.order.eta_earliest
                ? new Date(stop.order.eta_earliest).getTime()
                : now + (i + 1) * (avgStopMinutes + 5) * 60_000;
              const etaMin = Math.max(0, Math.round((etaMs - now) / 60_000));
              const isNext = i === 0;

              return (
                <div
                  key={stop.id}
                  className={cn(
                    'flex items-center gap-2.5 rounded-xl px-2.5 py-1.5',
                    isNext ? 'bg-accent/15 border border-accent/30' : 'bg-white/5',
                  )}
                >
                  <span className={cn(
                    'h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0',
                    isNext ? 'bg-accent text-matcha-900' : 'bg-matcha-700 text-matcha-300',
                  )}>
                    {stop.reihenfolge}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      'text-[11px] font-bold truncate',
                      isNext ? 'text-accent' : 'text-matcha-200',
                    )}>
                      {stop.order.kunde_name}
                    </div>
                    <div className="text-[9px] text-matcha-500 font-mono">
                      #{stop.order.bestellnummer}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={cn(
                      'text-[11px] font-black tabular-nums',
                      etaMin <= 5 ? 'text-accent' : 'text-matcha-300',
                    )}>
                      ~{etaMin} Min
                    </div>
                    <div className="text-[9px] text-matcha-500 tabular-nums">
                      {euro(stop.order.gesamtbetrag)}
                    </div>
                  </div>
                </div>
              );
            })}
          {remaining > 4 && (
            <div className="text-center text-[10px] text-matcha-500 pt-1">
              +{remaining - 4} weitere Stopps
            </div>
          )}
        </div>
      )}

      {/* Abgeschlossen */}
      {remaining === 0 && (
        <div className="flex items-center justify-center gap-2 py-2">
          <TrendingUp className="h-4 w-4 text-matcha-400" />
          <span className="text-sm font-bold text-matcha-300">
            Alle {total} Stopps abgeliefert!
          </span>
        </div>
      )}
    </div>
  );
}
