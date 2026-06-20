'use client';

/**
 * StopSmartCountdown — Phase 315
 *
 * Zeigt dem Fahrer einen intelligenten Countdown zum nächsten Stopp.
 * Farbkodiert nach Pünktlichkeit, mit Risiko-Warnung bei drohendem Delay.
 * Aktualisiert sich sekündlich (lokaler Timer) + Daten-Polling alle 30 s.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  AlertTriangle, CheckCircle2, Clock, MapPin, Navigation2, Timer,
} from 'lucide-react';

interface NextStopData {
  driverId: string;
  driverName: string;
  nextStop: {
    stopId: string;
    kundeAdresse: string | null;
    kundeName: string | null;
    remainingMinutes: number | null;
    stopStatus: string;
    delayMinutes: number | null;
    onTimeProb: number;
    etaLatest: string | null;
  } | null;
  stopsRemaining: number;
  tourEtaMin: number | null;
  tourHealth: 'on_time' | 'at_risk' | 'late' | 'unknown';
}

function useCountdown(etaIso: string | null): { minutes: number; seconds: number; overdue: boolean } {
  const calc = () => {
    if (!etaIso) return { minutes: 0, seconds: 0, overdue: false };
    const diff = new Date(etaIso).getTime() - Date.now();
    const overdue = diff < 0;
    const abs = Math.abs(diff);
    return {
      minutes: Math.floor(abs / 60_000),
      seconds: Math.floor((abs % 60_000) / 1_000),
      overdue,
    };
  };

  const [tick, setTick] = useState(calc);

  useEffect(() => {
    const iv = setInterval(() => setTick(calc()), 1_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etaIso]);

  return tick;
}

const HEALTH_STYLE = {
  on_time: {
    bg: 'bg-matcha-50 border-matcha-200',
    ring: 'from-matcha-400 to-matcha-600',
    text: 'text-matcha-700',
    badgeText: 'Im Plan',
    badgeBg: 'bg-matcha-100 text-matcha-700',
  },
  at_risk: {
    bg: 'bg-amber-50 border-amber-200',
    ring: 'from-amber-400 to-orange-500',
    text: 'text-amber-700',
    badgeText: 'Zeitkritisch',
    badgeBg: 'bg-amber-100 text-amber-700',
  },
  late: {
    bg: 'bg-red-50 border-red-200',
    ring: 'from-red-400 to-red-600',
    text: 'text-red-700',
    badgeText: 'Verspätet',
    badgeBg: 'bg-red-100 text-red-700',
  },
  unknown: {
    bg: 'bg-muted/30 border-border',
    ring: 'from-stone-300 to-stone-400',
    text: 'text-muted-foreground',
    badgeText: 'Keine Daten',
    badgeBg: 'bg-muted text-muted-foreground',
  },
};

function CountdownRing({
  minutes, seconds, overdue, health,
}: { minutes: number; seconds: number; overdue: boolean; health: keyof typeof HEALTH_STYLE }) {
  const style = HEALTH_STYLE[health];
  const totalSec = minutes * 60 + seconds;
  const maxSec = 30 * 60;
  const progress = overdue ? 1 : Math.max(0, 1 - totalSec / maxSec);
  const circumference = 2 * Math.PI * 38;
  const dash = circumference * progress;

  return (
    <div className="relative flex h-24 w-24 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r="38" fill="none" stroke="currentColor" strokeWidth="5" className="text-muted/30" />
        <circle
          cx="44" cy="44" r="38" fill="none" strokeWidth="5"
          stroke="url(#crd-grad)"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        <defs>
          <linearGradient id="crd-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={overdue ? '#ef4444' : health === 'at_risk' ? '#f59e0b' : '#65a30d'} />
            <stop offset="100%" stopColor={overdue ? '#b91c1c' : health === 'at_risk' ? '#ea580c' : '#4d7c0f'} />
          </linearGradient>
        </defs>
      </svg>
      <div className="text-center">
        {overdue ? (
          <div className="text-red-600 font-black text-sm leading-tight">
            <div className="text-[10px] font-bold uppercase">über</div>
            <div className="tabular-nums">{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}</div>
          </div>
        ) : (
          <div className={cn('font-black tabular-nums', style.text)}>
            <div className="text-xl leading-tight">{String(minutes).padStart(2, '0')}</div>
            <div className="text-sm leading-tight">:{String(seconds).padStart(2, '0')}</div>
          </div>
        )}
        <div className="text-[8px] text-muted-foreground font-semibold uppercase tracking-wide">Min</div>
      </div>
    </div>
  );
}

export function StopSmartCountdown({
  driverId,
  onNavigate,
}: {
  driverId?: string;
  onNavigate?: (address: string) => void;
}) {
  const [data, setData] = useState<NextStopData | null>(null);
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!driverId) return;
    try {
      const res = await fetch(
        `/api/delivery/driver/next-stop-eta?driver_id=${encodeURIComponent(driverId)}`,
        { cache: 'no-store' },
      ).catch(() => null);
      if (!res?.ok) return;
      const d = await res.json();
      setData(d);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    load();
    intervalRef.current = setInterval(load, 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load]);

  const stop = data?.nextStop ?? null;
  const health = data?.tourHealth ?? 'unknown';
  const style = HEALTH_STYLE[health];

  // Live-Countdown auf etaLatest
  const { minutes, seconds, overdue } = useCountdown(stop?.etaLatest ?? null);

  if (loading) {
    return (
      <div className={cn('rounded-2xl border p-4', 'bg-muted/20 border-border')}>
        <div className="h-24 flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-matcha-400 border-t-transparent animate-spin" />
        </div>
      </div>
    );
  }

  if (!data || !stop || data.stopsRemaining === 0) {
    return (
      <div className="rounded-2xl border border-matcha-200 bg-matcha-50 p-4 flex items-center gap-3">
        <CheckCircle2 className="h-8 w-8 text-matcha-500 shrink-0" />
        <div>
          <div className="font-bold text-matcha-800 text-sm">Tour abgeschlossen</div>
          <div className="text-xs text-matcha-600">Alle Stopps erledigt — gut gemacht!</div>
        </div>
      </div>
    );
  }

  const onTimeLabel = `${Math.round(stop.onTimeProb * 100)}% Pünktlichkeit`;

  return (
    <div className={cn('rounded-2xl border p-4 space-y-3', style.bg)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="h-4 w-4 text-matcha-600" />
          <span className="text-xs font-bold uppercase tracking-wider">Nächster Stopp</span>
        </div>
        <span className={cn('text-[10px] font-bold rounded-full px-2 py-0.5', style.badgeBg)}>
          {style.badgeText}
        </span>
      </div>

      {/* Countdown + Info */}
      <div className="flex items-center gap-4">
        <CountdownRing minutes={minutes} seconds={seconds} overdue={overdue} health={health} />

        <div className="flex-1 min-w-0 space-y-1.5">
          {stop.kundeName && (
            <div className="text-sm font-bold truncate">{stop.kundeName}</div>
          )}
          {stop.kundeAdresse && (
            <div className="flex items-start gap-1">
              <MapPin className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
              <span className="text-xs text-muted-foreground leading-snug">{stop.kundeAdresse}</span>
            </div>
          )}

          {/* Pünktlichkeits-Balken */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-black/10 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full',
                  stop.onTimeProb >= 0.8 ? 'bg-matcha-500' : stop.onTimeProb >= 0.55 ? 'bg-amber-400' : 'bg-red-400',
                )}
                style={{ width: `${Math.round(stop.onTimeProb * 100)}%` }}
              />
            </div>
            <span className="text-[9px] font-bold text-muted-foreground shrink-0">{onTimeLabel}</span>
          </div>

          {/* Warnung bei Verzug */}
          {(overdue || stop.delayMinutes !== null) && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-red-600">
              <AlertTriangle className="h-3 w-3" />
              {overdue
                ? `${minutes} Min überfällig`
                : `~${Math.round(stop.delayMinutes ?? 0)} Min Verzug erwartet`}
            </div>
          )}
        </div>
      </div>

      {/* CTA Navigation */}
      {stop.kundeAdresse && onNavigate && (
        <button
          onClick={() => onNavigate(stop.kundeAdresse!)}
          className={cn(
            'w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold',
            'bg-matcha-600 text-white hover:bg-matcha-700 active:scale-95 transition',
          )}
        >
          <Navigation2 className="h-4 w-4" />
          Navigation starten
        </button>
      )}

      {/* Tour-Fortschritt Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-black/10">
        <span className="text-[10px] text-muted-foreground">
          {data.stopsRemaining} Stopp{data.stopsRemaining !== 1 ? 's' : ''} verbleibend
        </span>
        {data.tourEtaMin !== null && (
          <span className="text-[10px] font-bold text-muted-foreground">
            <Clock className="inline h-2.5 w-2.5 mr-0.5" />
            ~{data.tourEtaMin} Min Gesamt
          </span>
        )}
      </div>
    </div>
  );
}
