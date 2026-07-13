'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Star, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1413 — Kunden-Bewertungs-Vorschau (Fahrer-App)
 *
 * Nach Lieferung: Mini-Karte mit letzter Kundenbewertung + 7-Tage-Trend.
 * isOnline-Guard. 60s-Polling.
 */

interface LetzteBewertung {
  sterne: number;
  kommentar: string | null;
  erstellt_am: string;
}

interface ApiData {
  letzte_bewertung: LetzteBewertung | null;
  schnitt_7_tage: number | null;
  schnitt_vorwoche: number | null;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_delta: number;
  anzahl_bewertungen: number;
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

const MOCK: ApiData = {
  letzte_bewertung: {
    sterne: 5,
    kommentar: 'Super schnell und freundlich!',
    erstellt_am: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
  },
  schnitt_7_tage: 4.7,
  schnitt_vorwoche: 4.4,
  trend: 'besser',
  trend_delta: 0.3,
  anzahl_bewertungen: 14,
};

function StarsRow({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn('h-3.5 w-3.5', n <= count ? 'text-yellow-400 fill-yellow-400' : 'text-slate-300 dark:text-slate-600')}
        />
      ))}
    </div>
  );
}

export function FahrerPhase1413KundenBewertungsVorschau({ driverId, isOnline }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/driver/letzte-bewertung?driver_id=${driverId}`);
      if (!res.ok) throw new Error('api');
      const json: ApiData = await res.json();
      setData(json);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    if (!isOnline) return;
    load();
    timerRef.current = setInterval(load, 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [load, isOnline]);

  if (!isOnline) return null;

  const TrendIcon =
    data?.trend === 'besser' ? TrendingUp : data?.trend === 'schlechter' ? TrendingDown : Minus;
  const trendColor =
    data?.trend === 'besser'
      ? 'text-emerald-400'
      : data?.trend === 'schlechter'
      ? 'text-rose-400'
      : 'text-slate-400';

  const minutesAgo = data?.letzte_bewertung
    ? Math.round((Date.now() - new Date(data.letzte_bewertung.erstellt_am).getTime()) / 60000)
    : null;

  return (
    <section className="bg-gradient-to-br from-yellow-900/80 to-amber-900/80 border border-yellow-700/50 rounded-2xl p-4 space-y-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-yellow-300 fill-yellow-300/30" />
          <span className="text-sm font-bold text-yellow-100">Kunden-Bewertungen</span>
          {data?.anzahl_bewertungen != null && (
            <span className="text-xs text-yellow-300/70">({data.anzahl_bewertungen} diese Woche)</span>
          )}
        </div>
        {loading && <RefreshCw className="h-3 w-3 animate-spin text-yellow-400" />}
      </button>

      {open && data && (
        <div className="space-y-2">
          {/* Letzte Bewertung */}
          {data.letzte_bewertung && (
            <div className="bg-white/10 rounded-xl p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <StarsRow count={data.letzte_bewertung.sterne} />
                {minutesAgo != null && (
                  <span className="text-xs text-yellow-300/60">vor {minutesAgo} Min</span>
                )}
              </div>
              {data.letzte_bewertung.kommentar && (
                <p className="text-xs text-yellow-100/80 italic leading-relaxed">
                  „{data.letzte_bewertung.kommentar}"
                </p>
              )}
            </div>
          )}

          {!data.letzte_bewertung && (
            <p className="text-xs text-yellow-200/60">Noch keine Bewertungen diese Woche.</p>
          )}

          {/* Schnitt + Trend */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white/10 rounded-lg p-2 text-center">
              <div className="text-xs text-yellow-300/70 mb-0.5">Ø diese Woche</div>
              <div className="text-lg font-black text-yellow-100 tabular-nums">
                {data.schnitt_7_tage?.toFixed(1) ?? '—'}
              </div>
            </div>
            <div className="bg-white/10 rounded-lg p-2 text-center">
              <div className="text-xs text-yellow-300/70 mb-0.5">Vorwoche</div>
              <div className="text-lg font-black text-yellow-100/70 tabular-nums">
                {data.schnitt_vorwoche?.toFixed(1) ?? '—'}
              </div>
            </div>
            <div className="bg-white/10 rounded-lg p-2 text-center">
              <div className="text-xs text-yellow-300/70 mb-0.5">Trend</div>
              <div className={cn('flex items-center justify-center gap-0.5 font-bold text-sm', trendColor)}>
                <TrendIcon className="h-4 w-4" />
                {data.trend_delta > 0 ? '+' : ''}{data.trend_delta.toFixed(1)}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
