'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Star, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

/**
 * Phase 1829 — Kunden-Bewertungs-Feed (Fahrer-App)
 *
 * Letzte 5 Kunden-Bewertungen + Ø-Score + Trend-Vergleich gestern.
 * isOnline-Guard; 30-Min-Polling.
 */

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
  className?: string;
}

interface Bewertung {
  id: string;
  sterne: number;
  kommentar?: string;
  zeitpunkt: string;
  tour_id?: string;
}

interface BewertungsDaten {
  durchschnitt: number;
  anzahl_heute: number;
  anzahl_gestern: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  letzte_bewertungen: Bewertung[];
}

const MOCK_DATEN: BewertungsDaten = {
  durchschnitt: 4.7,
  anzahl_heute: 8,
  anzahl_gestern: 6,
  trend: 'steigend',
  letzte_bewertungen: [
    { id: '1', sterne: 5, kommentar: 'Super schnell, danke!', zeitpunkt: new Date(Date.now() - 12 * 60_000).toISOString() },
    { id: '2', sterne: 5, zeitpunkt: new Date(Date.now() - 38 * 60_000).toISOString() },
    { id: '3', sterne: 4, kommentar: 'Sehr freundlich.', zeitpunkt: new Date(Date.now() - 72 * 60_000).toISOString() },
    { id: '4', sterne: 5, zeitpunkt: new Date(Date.now() - 110 * 60_000).toISOString() },
    { id: '5', sterne: 3, kommentar: 'Etwas spät.', zeitpunkt: new Date(Date.now() - 148 * 60_000).toISOString() },
  ],
};

function zeitVor(iso: string): string {
  const diff = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (diff < 60) return `vor ${diff} Min`;
  return `vor ${Math.round(diff / 60)} Std`;
}

function SterneReihe({ n, small }: { n: number; small?: boolean }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={cn(
            small ? 'h-3 w-3' : 'h-3.5 w-3.5',
            i <= n ? 'fill-amber-400 text-amber-400' : 'text-zinc-200 dark:text-zinc-700',
          )}
        />
      ))}
    </div>
  );
}

export function FahrerPhase1829KundenBewertungsFeed({
  driverId,
  locationId,
  isOnline,
  className,
}: Props) {
  const [daten, setDaten] = useState<BewertungsDaten | null>(null);
  const [offen, setOffen] = useState(true);

  useEffect(() => {
    if (!isOnline || !driverId) return;
    let aktiv = true;

    const laden = async () => {
      try {
        const params = new URLSearchParams({ driver_id: driverId });
        if (locationId) params.set('location_id', locationId);
        const r = await fetch(`/api/delivery/driver/bewertungen?${params}`, { cache: 'no-store' });
        if (!r.ok) throw new Error('fetch_failed');
        if (aktiv) setDaten(await r.json());
      } catch {
        if (aktiv) setDaten(MOCK_DATEN);
      }
    };

    laden();
    const id = setInterval(laden, 30 * 60_000);
    return () => { aktiv = false; clearInterval(id); };
  }, [driverId, locationId, isOnline]);

  if (!isOnline) {
    return (
      <div className={cn('flex items-center gap-2 rounded-xl border bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400', className)}>
        <WifiOff className="h-4 w-4 shrink-0" />
        <span>Bewertungen nicht verfügbar (offline).</span>
      </div>
    );
  }

  const d = daten ?? MOCK_DATEN;
  const trendPositiv = d.trend === 'steigend';
  const trendNegativ = d.trend === 'fallend';

  return (
    <div className={cn('rounded-xl border bg-white dark:bg-zinc-900 shadow-sm', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Kunden-Bewertungen
          </span>
          <span className={cn(
            'rounded-full text-[10px] font-bold px-1.5 py-0.5',
            trendPositiv
              ? 'bg-matcha-100 text-matcha-700 dark:bg-matcha-900/40 dark:text-matcha-300'
              : trendNegativ
                ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
          )}>
            Ø {d.durchschnitt.toFixed(1)} ★
          </span>
        </div>
        {offen ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
      </button>

      {offen && (
        <div className="px-4 pb-4 space-y-3">
          {/* KPI Row */}
          <div className="flex items-center gap-4">
            <div className="flex-1 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-center">
              <p className="text-xl font-black text-amber-500">{d.durchschnitt.toFixed(1)}</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Ø heute</p>
            </div>
            <div className="flex-1 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2 text-center">
              <p className="text-xl font-black text-zinc-800 dark:text-zinc-200">{d.anzahl_heute}</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Bewertungen heute</p>
            </div>
            <div className="flex items-center gap-1 text-sm font-semibold">
              {trendPositiv && <TrendingUp className="h-4 w-4 text-matcha-600 dark:text-matcha-400" />}
              {trendNegativ && <TrendingDown className="h-4 w-4 text-red-500" />}
              {!trendPositiv && !trendNegativ && <Minus className="h-4 w-4 text-zinc-400" />}
              <span className={cn(
                'text-xs',
                trendPositiv ? 'text-matcha-600 dark:text-matcha-400' : trendNegativ ? 'text-red-500' : 'text-zinc-400',
              )}>
                vs. gestern ({d.anzahl_gestern})
              </span>
            </div>
          </div>

          {/* Feed */}
          <div className="space-y-2">
            {d.letzte_bewertungen.map((b) => (
              <div
                key={b.id}
                className="flex items-start gap-3 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-800/30 px-3 py-2"
              >
                <div className="shrink-0 flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-xs font-black">
                  {b.sterne}
                </div>
                <div className="flex-1 min-w-0">
                  <SterneReihe n={b.sterne} small />
                  {b.kommentar && (
                    <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-300 truncate">{b.kommentar}</p>
                  )}
                </div>
                <span className="shrink-0 text-[10px] text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                  {zeitVor(b.zeitpunkt)}
                </span>
              </div>
            ))}

            {d.letzte_bewertungen.length === 0 && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center py-2">
                Noch keine Bewertungen heute.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
