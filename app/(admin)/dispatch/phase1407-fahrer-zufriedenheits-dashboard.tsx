'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Heart, RefreshCw, TrendingDown, TrendingUp, Minus, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1407 — Fahrer-Zufriedenheits-Dashboard (Dispatch)
 *
 * Zeigt Phase1405-API:
 *   • Kacheln je Fahrer: Stimmung / Trinkgeld-Trend / Bonus-Fortschritt
 *   • Gesamt-Score-Ampel (sehr_gut / gut / mittel / schlecht)
 *   • Ø-Score Gesamtüberblick
 *
 * 10-Min-Polling. Nach Phase1402 in dispatch/client.tsx.
 */

interface FahrerScore {
  driver_id: string;
  name: string;
  stimmung_score: number;
  trinkgeld_trend: number;
  bonus_fortschritt: number;
  gesamt_score: number;
  kategorie: 'sehr_gut' | 'gut' | 'mittel' | 'schlecht';
}

interface ApiData {
  fahrer: FahrerScore[];
  schnitt_gesamt: number;
  beste_stimmung: string | null;
}

interface Props {
  locationId: string | null;
}

const KATEGORIE_CONFIG = {
  sehr_gut: { label: 'Sehr gut', color: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30', dot: 'bg-emerald-500' },
  gut: { label: 'Gut', color: 'text-sky-700 dark:text-sky-400', bg: 'bg-sky-100 dark:bg-sky-900/30', dot: 'bg-sky-500' },
  mittel: { label: 'Mittel', color: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30', dot: 'bg-amber-500' },
  schlecht: { label: 'Niedrig', color: 'text-rose-700 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-900/30', dot: 'bg-rose-500' },
};

const MOCK: ApiData = {
  fahrer: [
    { driver_id: '1', name: 'Markus R.', stimmung_score: 82, trinkgeld_trend: 12, bonus_fortschritt: 75, gesamt_score: 79, kategorie: 'gut' },
    { driver_id: '2', name: 'Lena K.', stimmung_score: 91, trinkgeld_trend: 18, bonus_fortschritt: 90, gesamt_score: 91, kategorie: 'sehr_gut' },
    { driver_id: '3', name: 'Tobias H.', stimmung_score: 55, trinkgeld_trend: -5, bonus_fortschritt: 40, gesamt_score: 47, kategorie: 'mittel' },
  ],
  schnitt_gesamt: 72,
  beste_stimmung: 'Lena K.',
};

export function DispatchPhase1407FahrerZufriedenheitsDashboard({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-zufriedenheits-score?location_id=${locationId}`);
      if (!res.ok) throw new Error('api');
      const json: ApiData = await res.json();
      setData(json);
      setLastUpdate(new Date());
    } catch {
      setData(MOCK);
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 10 * 60 * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load]);

  const schnitt = data?.schnitt_gesamt ?? 0;
  const schnittCfg =
    schnitt >= 80 ? KATEGORIE_CONFIG.sehr_gut
    : schnitt >= 60 ? KATEGORIE_CONFIG.gut
    : schnitt >= 40 ? KATEGORIE_CONFIG.mittel
    : KATEGORIE_CONFIG.schlecht;

  return (
    <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-950/20 p-3 mb-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Heart className="h-4 w-4 text-violet-600 dark:text-violet-400" />
          <span className="text-sm font-bold text-violet-700 dark:text-violet-300">Fahrer-Zufriedenheit</span>
          {data && (
            <span className={cn('text-xs font-semibold px-1.5 py-0.5 rounded-full', schnittCfg.bg, schnittCfg.color)}>
              Ø {schnitt}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {loading && <RefreshCw className="h-3 w-3 animate-spin text-violet-400" />}
          {lastUpdate && (
            <span className="text-xs text-muted-foreground">
              {lastUpdate.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {!locationId && (
            <p className="text-xs text-muted-foreground">Bitte Filiale auswählen.</p>
          )}

          {locationId && !data && (
            <p className="text-xs text-muted-foreground">Lade Daten…</p>
          )}

          {data?.beste_stimmung && (
            <div className="flex items-center gap-1.5 text-xs text-violet-700 dark:text-violet-300 mb-1">
              <Star className="h-3 w-3" />
              <span>Beste Stimmung: <strong>{data.beste_stimmung}</strong></span>
            </div>
          )}

          {(data?.fahrer ?? []).map((f) => {
            const cfg = KATEGORIE_CONFIG[f.kategorie];
            const TrendIcon = f.trinkgeld_trend > 2 ? TrendingUp : f.trinkgeld_trend < -2 ? TrendingDown : Minus;
            const trendColor =
              f.trinkgeld_trend > 2 ? 'text-emerald-600 dark:text-emerald-400'
              : f.trinkgeld_trend < -2 ? 'text-rose-600 dark:text-rose-400'
              : 'text-slate-400';
            return (
              <div key={f.driver_id} className="rounded-lg bg-white/70 dark:bg-white/5 border border-white/50 dark:border-white/10 p-2">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full inline-block', cfg.dot)} />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{f.name}</span>
                  </div>
                  <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded-full', cfg.bg, cfg.color)}>
                    {f.gesamt_score} — {cfg.label}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-xs">
                  <div className="text-center">
                    <div className="text-muted-foreground mb-0.5">Stimmung</div>
                    <div className="font-bold">{f.stimmung_score}/100</div>
                    <div className="h-1 rounded-full bg-slate-200 dark:bg-slate-700 mt-1">
                      <div className={cn('h-full rounded-full', cfg.dot)} style={{ width: `${f.stimmung_score}%` }} />
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground mb-0.5">Trinkgeld</div>
                    <div className={cn('font-bold flex items-center justify-center gap-0.5', trendColor)}>
                      <TrendIcon className="h-3 w-3" />
                      {f.trinkgeld_trend > 0 ? '+' : ''}{f.trinkgeld_trend.toFixed(1)}%
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-muted-foreground mb-0.5">Bonus</div>
                    <div className="font-bold">{f.bonus_fortschritt}%</div>
                    <div className="h-1 rounded-full bg-slate-200 dark:bg-slate-700 mt-1">
                      <div className="h-full rounded-full bg-violet-500" style={{ width: `${f.bonus_fortschritt}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
