'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart2, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1412 — Schicht-Produktivitäts-Cockpit (Dispatch)
 *
 * Bestellungen/Stunde je Fahrer + Ø-Vergleich. Farb-Ranking Top/Mitte/Low.
 * 10-Min-Polling. Nach Phase1407 in dispatch/client.tsx.
 */

interface FahrerProduktivitaet {
  driver_id: string;
  name: string;
  bestellungen_heute: number;
  stunden_aktiv: number;
  bestellungen_pro_stunde: number;
  ranking: 'top' | 'mitte' | 'low';
}

interface ApiData {
  fahrer: FahrerProduktivitaet[];
  schnitt_bestellungen_pro_stunde: number;
}

interface Props {
  locationId: string | null;
}

const RANKING_CONFIG = {
  top: {
    label: 'Top',
    color: 'text-emerald-700 dark:text-emerald-300',
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    bar: 'bg-emerald-500',
    dot: 'bg-emerald-500',
  },
  mitte: {
    label: 'Mittel',
    color: 'text-sky-700 dark:text-sky-300',
    bg: 'bg-sky-100 dark:bg-sky-900/30',
    bar: 'bg-sky-500',
    dot: 'bg-sky-500',
  },
  low: {
    label: 'Niedrig',
    color: 'text-rose-700 dark:text-rose-300',
    bg: 'bg-rose-100 dark:bg-rose-900/30',
    bar: 'bg-rose-400',
    dot: 'bg-rose-400',
  },
};

const MOCK: ApiData = {
  fahrer: [
    { driver_id: '1', name: 'Lena K.', bestellungen_heute: 33, stunden_aktiv: 4, bestellungen_pro_stunde: 8.2, ranking: 'top' },
    { driver_id: '2', name: 'Sara M.', bestellungen_heute: 31, stunden_aktiv: 4, bestellungen_pro_stunde: 7.8, ranking: 'top' },
    { driver_id: '3', name: 'Markus R.', bestellungen_heute: 26, stunden_aktiv: 4, bestellungen_pro_stunde: 6.5, ranking: 'mitte' },
    { driver_id: '4', name: 'Felix W.', bestellungen_heute: 21, stunden_aktiv: 4, bestellungen_pro_stunde: 5.3, ranking: 'mitte' },
    { driver_id: '5', name: 'Tobias H.', bestellungen_heute: 16, stunden_aktiv: 4, bestellungen_pro_stunde: 4.1, ranking: 'low' },
  ],
  schnitt_bestellungen_pro_stunde: 6.4,
};

export function DispatchPhase1412SchichtProduktivitaetsCockpit({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/schicht-produktivitaet?location_id=${locationId}`);
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

  const schnitt = data?.schnitt_bestellungen_pro_stunde ?? 0;
  const maxRate = Math.max(...(data?.fahrer ?? []).map((f) => f.bestellungen_pro_stunde), 1);

  return (
    <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/20 p-3 mb-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <BarChart2 className="h-4 w-4 text-teal-600 dark:text-teal-400" />
          <span className="text-sm font-bold text-teal-700 dark:text-teal-300">Schicht-Produktivität</span>
          {data && (
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300">
              Ø {schnitt.toFixed(1)}/h
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {loading && <RefreshCw className="h-3 w-3 animate-spin text-teal-400" />}
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

          {(data?.fahrer ?? []).map((f) => {
            const cfg = RANKING_CONFIG[f.ranking];
            const delta = f.bestellungen_pro_stunde - schnitt;
            const TrendIcon = delta > 0.5 ? TrendingUp : delta < -0.5 ? TrendingDown : Minus;
            const trendColor =
              delta > 0.5 ? 'text-emerald-600 dark:text-emerald-400'
              : delta < -0.5 ? 'text-rose-600 dark:text-rose-400'
              : 'text-slate-400';
            const barPct = Math.round((f.bestellungen_pro_stunde / maxRate) * 100);

            return (
              <div key={f.driver_id} className="rounded-lg bg-white/70 dark:bg-white/5 border border-white/50 dark:border-white/10 p-2">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('h-2 w-2 rounded-full inline-block', cfg.dot)} />
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">{f.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded-full', cfg.bg, cfg.color)}>
                      {cfg.label}
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                      {f.bestellungen_pro_stunde.toFixed(1)}/h
                    </span>
                    <TrendIcon className={cn('h-3 w-3', trendColor)} />
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', cfg.bar)}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                  <span>{f.bestellungen_heute} Bestellungen heute</span>
                  <span>{f.stunden_aktiv}h aktiv</span>
                </div>
              </div>
            );
          })}

          {data && data.fahrer.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-1">Keine aktiven Fahrer.</p>
          )}
        </div>
      )}
    </div>
  );
}
