'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Euro, Target, TrendingUp, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1384 — Live-Einnahmen-Ticker (Fahrer-App)
 *
 * Echtzeit-Ticker der heutigen Einnahmen:
 *   • Aktueller Tagesverdienst mit Animations-Highlight bei neuer Tour
 *   • Ziel-Indikator (Tages-Tagesziel + Fortschrittsbalken)
 *   • Trend vs. Vorwoche (Durchschnitt)
 *   • isOnline-Guard
 *
 * Nach Phase1379 in fahrer/app/client.tsx.
 */

interface ApiData {
  einnahmen_heute_eur: number;
  einnahmen_vorwoche_eur: number;
  touren_heute: number;
  tagesziel_eur: number;
  letzte_tour_eur: number | null;
  letzte_tour_at: string | null;
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

const MOCK: ApiData = {
  einnahmen_heute_eur: 87.5,
  einnahmen_vorwoche_eur: 72.0,
  touren_heute: 6,
  tagesziel_eur: 120.0,
  letzte_tour_eur: 14.5,
  letzte_tour_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
};

function fmt(eur: number) {
  return eur.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });
}

export function FahrerPhase1384LiveEinnahmenTicker({ driverId, isOnline }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);
  const [flash, setFlash] = useState(false);
  const prevTourenRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!driverId) return;
    try {
      const res = await fetch(`/api/delivery/driver/live-einnahmen?driver_id=${driverId}`);
      if (!res.ok) throw new Error('api');
      const json: ApiData = await res.json();
      setData((prev) => {
        // Flash-Animation wenn neue Tour erkannt
        if (prev && json.touren_heute > prev.touren_heute) {
          setFlash(true);
          setTimeout(() => setFlash(false), 2000);
        }
        return json;
      });
      // Init
      if (prevTourenRef.current === null) {
        prevTourenRef.current = json.touren_heute;
      }
    } catch {
      setData(MOCK);
    }
  }, [driverId]);

  useEffect(() => {
    if (!isOnline) return;
    load();
    timerRef.current = setInterval(load, 30 * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load, isOnline]);

  if (!isOnline) return null;

  const d = data ?? MOCK;
  const fortschrittPct = Math.min(100, (d.einnahmen_heute_eur / d.tagesziel_eur) * 100);
  const trendDiff = d.einnahmen_heute_eur - d.einnahmen_vorwoche_eur;
  const zielerreicht = d.einnahmen_heute_eur >= d.tagesziel_eur;

  const minutenSeitLetzterTour = d.letzte_tour_at
    ? Math.floor((Date.now() - new Date(d.letzte_tour_at).getTime()) / 60000)
    : null;

  return (
    <div className={cn(
      'rounded-xl border p-4 transition-all duration-500',
      flash ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 ring-2 ring-emerald-400' : 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/20'
    )}>
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        <Euro className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
        <span className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
          Live-Einnahmen heute
        </span>
        {flash && (
          <span className="flex animate-bounce items-center gap-1 rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">
            <Zap className="h-3 w-3" /> +Tour!
          </span>
        )}
        {zielerreicht && !flash && (
          <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-xs font-bold text-white">
            Ziel ✓
          </span>
        )}
        <span className="ml-auto text-lg font-bold text-emerald-700 dark:text-emerald-300">
          {fmt(d.einnahmen_heute_eur)}
        </span>
        <span className="text-xs text-emerald-600 dark:text-emerald-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Fortschrittsbalken zum Tagesziel */}
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Target className="h-3 w-3" />
                Tagesziel: {fmt(d.tagesziel_eur)}
              </span>
              <span className="font-medium text-emerald-700 dark:text-emerald-300">
                {Math.round(fortschrittPct)}%
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div
                className={cn(
                  'h-3 rounded-full transition-all duration-700',
                  zielerreicht ? 'bg-emerald-500' : fortschrittPct >= 70 ? 'bg-emerald-400' : 'bg-amber-400'
                )}
                style={{ width: `${fortschrittPct}%` }}
              />
            </div>
            {!zielerreicht && (
              <p className="mt-0.5 text-right text-xs text-slate-500 dark:text-slate-400">
                Noch {fmt(d.tagesziel_eur - d.einnahmen_heute_eur)} bis Ziel
              </p>
            )}
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/60 p-2.5 dark:bg-black/20">
              <div className="text-xs text-slate-500 dark:text-slate-400">Touren heute</div>
              <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{d.touren_heute}</div>
            </div>
            <div className="rounded-lg bg-white/60 p-2.5 dark:bg-black/20">
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <TrendingUp className="h-3 w-3" />
                vs. Vorwoche
              </div>
              <div className={cn(
                'text-lg font-bold',
                trendDiff >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-600 dark:text-red-400'
              )}>
                {trendDiff >= 0 ? '+' : ''}{fmt(trendDiff)}
              </div>
            </div>
          </div>

          {/* Letzte Tour */}
          {d.letzte_tour_eur != null && minutenSeitLetzterTour != null && (
            <div className="flex items-center justify-between rounded-lg bg-white/60 px-3 py-2 dark:bg-black/20">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Letzte Tour ({minutenSeitLetzterTour} Min. her)
              </span>
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                +{fmt(d.letzte_tour_eur)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
