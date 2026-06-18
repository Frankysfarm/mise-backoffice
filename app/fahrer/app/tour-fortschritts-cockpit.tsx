'use client';

/**
 * TourFortschrittsCockpit — Echtzeit-Tour-Cockpit für Fahrer.
 *
 * Zeigt:
 *  - Großer kreisförmiger Fortschrittsring (SVG) mit abgeschlossenen/gesamt Stopps
 *  - Verstrichene Zeit seit Tourstart
 *  - Bisheriger Verdienst (Summe gelieferter Bestellungen)
 *  - Gesamtdistanz der Tour
 *
 * Dunkles Matcha-Theme (bg-matcha-900, text-matcha-50).
 * Aktualisiert sich jede Sekunde via useTick.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, CheckCircle2, Clock, Euro, MapPin } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TourStop = {
  geliefert_am: string | null;
  reihenfolge: number;
  order: {
    bestellnummer: string;
    gesamtbetrag: number;
  };
};

interface Props {
  stops: TourStop[];
  startedAt: string | null;
  totalDistanceKm: number | null;
}

// ---------------------------------------------------------------------------
// useTick — re-render every second
// ---------------------------------------------------------------------------

function useTick() {
  const [, setT] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setT((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatElapsed(startIso: string | null): string {
  if (!startIso) return '0:00';
  const totalSec = Math.max(0, Math.floor((Date.now() - new Date(startIso).getTime()) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatEuro(amount: number): string {
  return amount.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ---------------------------------------------------------------------------
// Kreisförmiger Fortschrittsring (SVG)
// ---------------------------------------------------------------------------

interface ProgressRingProps {
  completed: number;
  total: number;
  size?: number;
  strokeWidth?: number;
}

function ProgressRing({
  completed,
  total,
  size = 180,
  strokeWidth = 14,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? Math.min(1, completed / total) : 0;
  const offset = circumference * (1 - progress);
  const center = size / 2;

  const allDone = completed === total && total > 0;
  const strokeColor = allDone ? '#4ade80' : '#6ee7b7'; // green-400 / emerald-300

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        aria-hidden
      >
        {/* Hintergrund-Ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
        />
        {/* Fortschritts-Ring */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={strokeColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.3s ease' }}
        />
      </svg>

      {/* Inhalt in der Mitte */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        {allDone ? (
          <>
            <CheckCircle2 className="h-10 w-10 text-green-400 mb-1" />
            <span className="text-xs font-bold text-green-300 uppercase tracking-wide">
              Fertig!
            </span>
          </>
        ) : (
          <>
            <span className="text-4xl font-black text-matcha-50 tabular-nums leading-none">
              {completed}
            </span>
            <span className="text-xs text-matcha-300 font-medium mt-0.5">
              von {total}
            </span>
            <span className="text-[10px] text-matcha-400 uppercase tracking-widest mt-1 font-bold">
              Stopps
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat-Kachel
// ---------------------------------------------------------------------------

function StatKachel({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl bg-white/5 border border-white/10 px-4 py-3 min-w-0">
      <Icon className={cn('h-4 w-4 shrink-0', accent ?? 'text-matcha-300')} />
      <span className="text-xs font-bold text-matcha-50 tabular-nums text-center leading-tight">
        {value}
      </span>
      <span className="text-[10px] text-matcha-400 font-medium uppercase tracking-wide text-center">
        {label}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stop-Liste
// ---------------------------------------------------------------------------

function StopListe({ stops }: { stops: TourStop[] }) {
  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);

  return (
    <div className="space-y-1.5">
      {sorted.map((stop, idx) => {
        const done = stop.geliefert_am != null;
        const isCurrent =
          !done && sorted.slice(0, idx).every((s) => s.geliefert_am != null);

        return (
          <div
            key={stop.reihenfolge}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all',
              done
                ? 'bg-matcha-800/50 opacity-60'
                : isCurrent
                ? 'bg-white/10 border border-matcha-400/50'
                : 'bg-white/5 border border-white/5',
            )}
          >
            {/* Stopp-Nummer / Haken */}
            <div
              className={cn(
                'h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-black border-2 shrink-0',
                done
                  ? 'bg-matcha-600 border-matcha-500 text-white'
                  : isCurrent
                  ? 'bg-matcha-400 border-matcha-300 text-matcha-900 animate-pulse'
                  : 'bg-transparent border-matcha-700 text-matcha-500',
              )}
            >
              {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : idx + 1}
            </div>

            {/* Bestellnummer */}
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  'text-sm font-bold truncate tabular-nums',
                  done ? 'text-matcha-400 line-through' : 'text-matcha-50',
                )}
              >
                #{stop.order.bestellnummer}
              </p>
              {isCurrent && (
                <p className="text-[10px] text-matcha-300 font-medium">Aktueller Stopp</p>
              )}
            </div>

            {/* Betrag */}
            <span
              className={cn(
                'text-sm font-black tabular-nums shrink-0',
                done ? 'text-matcha-400' : 'text-matcha-200',
              )}
            >
              {formatEuro(stop.order.gesamtbetrag)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function TourFortschrittsCockpit({ stops, startedAt, totalDistanceKm }: Props) {
  useTick();

  const sorted = [...stops].sort((a, b) => a.reihenfolge - b.reihenfolge);
  const completedStops = stops.filter((s) => s.geliefert_am != null);
  const verdienst = completedStops.reduce((sum, s) => sum + s.order.gesamtbetrag, 0);
  const totalStops = stops.length;
  const completed = completedStops.length;
  const allDone = completed === totalStops && totalStops > 0;

  return (
    <div className="min-h-screen bg-matcha-900 text-matcha-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-6 pb-2">
        <Bike className="h-5 w-5 text-matcha-300 shrink-0" />
        <h1 className="text-base font-black uppercase tracking-wider text-matcha-100">
          Tour-Cockpit
        </h1>
        {allDone && (
          <span className="ml-auto rounded-full bg-green-500 text-white text-[10px] font-black px-2.5 py-0.5 uppercase tracking-wide">
            Tour abgeschlossen
          </span>
        )}
      </div>

      {/* Haupt-Ring */}
      <div className="flex justify-center py-6">
        <ProgressRing completed={completed} total={totalStops} />
      </div>

      {/* Stat-Kacheln */}
      <div className="grid grid-cols-3 gap-2 px-4 pb-6">
        <StatKachel
          icon={Clock}
          label="Laufzeit"
          value={formatElapsed(startedAt)}
          accent="text-blue-300"
        />
        <StatKachel
          icon={Euro}
          label="Verdienst"
          value={formatEuro(verdienst)}
          accent="text-matcha-300"
        />
        <StatKachel
          icon={MapPin}
          label="Distanz"
          value={
            totalDistanceKm != null
              ? `${totalDistanceKm.toFixed(1)} km`
              : '– km'
          }
          accent="text-amber-300"
        />
      </div>

      {/* Trennlinie */}
      <div className="mx-4 h-px bg-white/10 mb-4" />

      {/* Stopp-Liste */}
      <div className="px-4 flex-1 space-y-2 pb-8">
        <h2 className="text-[11px] font-bold uppercase tracking-widest text-matcha-400 mb-2">
          Stopps ({completed}/{totalStops})
        </h2>
        {totalStops === 0 ? (
          <div className="text-center py-8 text-matcha-500 text-sm">
            Keine Stopps in dieser Tour
          </div>
        ) : (
          <StopListe stops={sorted} />
        )}
      </div>
    </div>
  );
}
