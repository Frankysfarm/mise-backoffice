'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Medal, Trophy, TrendingUp } from 'lucide-react';

/**
 * Phase 921 — Monats-Rangliste (Fahrer-App)
 *
 * Fahrers Rang im Monatsvergleich mit Top-3-Fahrern und eigenem Rang.
 * Nur sichtbar wenn isOnline=true.
 * 10-Min-Polling.
 */

interface Props {
  driverId: string;
  isOnline: boolean;
}

interface RanglistenFahrer {
  rank: number;
  driver_id: string;
  name: string;
  touren: number;
  pct_puenktlich: number;
  einnahmen_eur: number;
  is_me: boolean;
}

interface RanglistenData {
  monat: string;
  mein_rang: number;
  gesamt_fahrer: number;
  top3: RanglistenFahrer[];
  ich: RanglistenFahrer | null;
}

const MOCK: RanglistenData = {
  monat: 'Juli 2026',
  mein_rang: 4,
  gesamt_fahrer: 12,
  top3: [
    { rank: 1, driver_id: 't1', name: 'Tarkan A.', touren: 187, pct_puenktlich: 97, einnahmen_eur: 1620, is_me: false },
    { rank: 2, driver_id: 't2', name: 'Lena M.', touren: 172, pct_puenktlich: 94, einnahmen_eur: 1490, is_me: false },
    { rank: 3, driver_id: 't3', name: 'Jörn K.', touren: 165, pct_puenktlich: 92, einnahmen_eur: 1430, is_me: false },
  ],
  ich: { rank: 4, driver_id: 'me', name: 'Du', touren: 154, pct_puenktlich: 89, einnahmen_eur: 1310, is_me: true },
};

const POLL_MS = 10 * 60 * 1000;

const MEDAL_COLOR: Record<number, string> = {
  1: 'text-yellow-500',
  2: 'text-stone-400',
  3: 'text-amber-600',
};

const MEDAL_BG: Record<number, string> = {
  1: 'bg-yellow-50 border-yellow-200',
  2: 'bg-stone-50 border-stone-200',
  3: 'bg-amber-50 border-amber-200',
};

export function FahrerPhase921MonatsRangliste({ driverId, isOnline }: Props) {
  const [data, setData] = useState<RanglistenData | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!driverId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/driver/monats-rangliste?driver_id=${driverId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error();
      const json = await res.json();
      if (json.mein_rang) setData(json as RanglistenData);
      else setData(MOCK);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [driverId, isOnline]);

  useEffect(() => {
    if (!isOnline) { setData(null); return; }
    load();
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [load, isOnline]);

  if (!isOnline || !data) return null;

  const rangColor = data.mein_rang <= 3 ? 'text-yellow-600' : data.mein_rang <= 5 ? 'text-matcha-600' : 'text-stone-600';

  return (
    <div className="rounded-2xl border border-stone-200 bg-white/90 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
        onClick={() => setOpen((p) => !p)}
      >
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-500" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Monats-Rangliste
          </span>
          <span className="rounded-full bg-yellow-50 border border-yellow-200 px-2 py-0.5 text-[10px] font-bold text-yellow-700">
            Rang {data.mein_rang} / {data.gesamt_fahrer}
          </span>
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <span className="text-xs text-muted-foreground">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t px-4 py-3 space-y-3">
          {/* Mein Rang Hero */}
          <div className="flex items-center gap-4 rounded-xl bg-gradient-to-r from-stone-50 to-white border border-stone-100 p-3">
            <div className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl bg-stone-100 border border-stone-200">
              <span className={cn('text-2xl font-black', rangColor)}>#{data.mein_rang}</span>
              <span className="text-[8px] text-stone-400 font-semibold">RANG</span>
            </div>
            <div className="flex-1">
              <div className="text-xs font-bold text-stone-700">{data.monat}</div>
              {data.ich && (
                <div className="flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-0.5 text-[10px] text-stone-500">
                    <TrendingUp className="h-3 w-3 text-matcha-500" />
                    {data.ich.touren} Touren
                  </span>
                  <span className="text-[10px] text-stone-500">
                    {data.ich.pct_puenktlich}% pünktlich
                  </span>
                  <span className="text-[10px] text-stone-500">
                    {data.ich.einnahmen_eur.toLocaleString('de-DE')}€
                  </span>
                </div>
              )}
              {data.mein_rang <= 3 && (
                <span className="mt-1 inline-block rounded-full bg-yellow-100 px-2 py-0.5 text-[9px] font-black text-yellow-700">
                  🏆 Top 3 diesen Monat!
                </span>
              )}
              {data.mein_rang > 3 && data.mein_rang <= 5 && (
                <span className="mt-1 inline-block rounded-full bg-matcha-100 px-2 py-0.5 text-[9px] font-black text-matcha-700">
                  Fast im Top 3 — weiter so!
                </span>
              )}
            </div>
          </div>

          {/* Top-3 */}
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Top 3 diesen Monat
            </div>
            <div className="space-y-1.5">
              {data.top3.map((f) => (
                <div
                  key={f.driver_id}
                  className={cn(
                    'flex items-center gap-2 rounded-xl border px-3 py-2',
                    f.is_me ? 'bg-matcha-50 border-matcha-200' : (MEDAL_BG[f.rank] ?? 'bg-stone-50 border-stone-100'),
                  )}
                >
                  <Medal className={cn('h-4 w-4 shrink-0', MEDAL_COLOR[f.rank] ?? 'text-stone-400')} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-stone-800 truncate">{f.name}</span>
                      {f.is_me && (
                        <span className="rounded-full bg-matcha-200 px-1.5 text-[8px] font-black text-matcha-800">
                          DU
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-stone-500">
                      <span>{f.touren} Touren</span>
                      <span>{f.pct_puenktlich}%</span>
                      <span>{f.einnahmen_eur.toLocaleString('de-DE')}€</span>
                    </div>
                  </div>
                  <span className="text-sm font-black text-stone-700">#{f.rank}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Eigener Rang wenn nicht Top 3 */}
          {data.ich && data.mein_rang > 3 && (
            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Dein Rang
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-matcha-200 bg-matcha-50 px-3 py-2">
                <span className="text-base font-black text-matcha-700 w-8 text-center">
                  #{data.mein_rang}
                </span>
                <div className="flex-1">
                  <div className="text-xs font-bold text-stone-700">Du</div>
                  <div className="flex items-center gap-2 text-[9px] text-stone-500">
                    <span>{data.ich.touren} Touren</span>
                    <span>{data.ich.pct_puenktlich}% pünktlich</span>
                    <span>{data.ich.einnahmen_eur.toLocaleString('de-DE')}€</span>
                  </div>
                </div>
                <div className="text-[9px] text-stone-500 text-right">
                  {data.mein_rang - 3} Plätze<br />hinter Top 3
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
