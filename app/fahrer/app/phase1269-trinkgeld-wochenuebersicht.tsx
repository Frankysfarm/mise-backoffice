'use client';

// Phase 1269 — Trinkgeld-Wochenübersicht (Fahrer-App)
// Summe + Ø Trinkgeld je Tag als Balken-Chart + Trend vs. Vorwoche
// Props: driverId, isOnline · 15-Min-Polling · isOnline-Guard

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Euro, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrinkgeldTag {
  datum: string;
  wochentag: string;
  summe_eur: number;
  anzahl: number;
  schnitt_eur: number;
}

interface TrinkgeldData {
  woche_summe_eur: number;
  woche_anzahl: number;
  woche_schnitt_eur: number;
  vorwoche_summe_eur: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_pct: number;
  tage: TrinkgeldTag[];
  generiert_am: string;
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

const TREND_STYLE = {
  besser: { icon: TrendingUp, color: 'text-green-600 dark:text-green-400', label: 'besser' },
  gleich: { icon: Minus, color: 'text-slate-500', label: 'gleich' },
  schlechter: { icon: TrendingDown, color: 'text-red-500', label: 'schlechter' },
};

export function FahrerPhase1269TrinkgeldWochenuebersicht({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<TrinkgeldData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/delivery/driver/trinkgeld-woche?driver_id=${driverId}`);
        if (!cancelled && res.ok) setData(await res.json());
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    const id = setInterval(fetchData, 15 * 60 * 1000);
    return () => { cancelled = true; clearInterval(id); };
  }, [driverId, isOnline]);

  if (!isOnline) return null;

  const maxSumme = data ? Math.max(...data.tage.map(t => t.summe_eur), 0.01) : 1;
  const trendInfo = data ? TREND_STYLE[data.trend] : null;
  const TrendIcon = trendInfo?.icon ?? Minus;

  return (
    <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/20 shadow-sm overflow-hidden mb-3">
      <button
        className="flex w-full items-center justify-between px-4 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <Euro className="h-4 w-4" />
          <span className="font-semibold text-sm">Trinkgeld diese Woche</span>
          {data && (
            <span className="ml-1 rounded-full bg-white/25 px-2 py-0.5 text-xs font-bold">
              {data.woche_summe_eur.toFixed(2)} €
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {open && (
        <div className="px-4 py-3 space-y-3">
          {loading && !data && (
            <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              Lade Trinkgeld-Daten…
            </div>
          )}

          {data && (
            <>
              {/* KPI Row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-white/70 dark:bg-white/5 px-2 py-2 text-center">
                  <p className="text-[10px] text-slate-500">Gesamt</p>
                  <p className="text-lg font-black text-green-700 dark:text-green-400 tabular-nums">
                    {data.woche_summe_eur.toFixed(2)}€
                  </p>
                </div>
                <div className="rounded-lg bg-white/70 dark:bg-white/5 px-2 py-2 text-center">
                  <p className="text-[10px] text-slate-500">Ø je Stopp</p>
                  <p className="text-lg font-black text-green-700 dark:text-green-400 tabular-nums">
                    {data.woche_schnitt_eur.toFixed(2)}€
                  </p>
                </div>
                <div className="rounded-lg bg-white/70 dark:bg-white/5 px-2 py-2 text-center">
                  <p className="text-[10px] text-slate-500">Trend</p>
                  <div className={cn('flex items-center justify-center gap-0.5', trendInfo?.color)}>
                    <TrendIcon className="h-4 w-4" />
                    <span className="text-sm font-bold">
                      {data.trend_pct > 0 ? `${data.trend_pct}%` : '—'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">vs. Vorwoche</p>
                </div>
              </div>

              {/* Bar chart */}
              {data.tage.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Verlauf je Tag</p>
                  <div className="flex items-end gap-1.5 h-20">
                    {data.tage.map(t => {
                      const h = Math.max(4, Math.round((t.summe_eur / maxSumme) * 72));
                      const isToday = t.datum === new Date().toISOString().slice(0, 10);
                      return (
                        <div key={t.datum} className="flex flex-col items-center flex-1 gap-0.5">
                          <span className="text-[8px] text-slate-500 tabular-nums">{t.summe_eur.toFixed(0)}€</span>
                          <div
                            className={cn('w-full rounded-t-sm transition-all duration-500', isToday ? 'bg-green-500' : 'bg-green-300 dark:bg-green-700')}
                            style={{ height: `${h}px` }}
                          />
                          <span className={cn('text-[9px] font-bold', isToday ? 'text-green-700 dark:text-green-400' : 'text-slate-400')}>
                            {t.wochentag}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {data.tage.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-2">Noch kein Trinkgeld diese Woche.</p>
              )}

              <p className="text-[10px] text-slate-400 dark:text-slate-500 text-right tabular-nums">
                Vorwoche: {data.vorwoche_summe_eur.toFixed(2)} € · {new Date(data.generiert_am).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
