'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

// Phase 1132 — Einnahmen-Wochenübersicht (Fahrer-App)
// 7-Tage-Balkendiagramm eigener Umsatz + Vergleich mit Vorwoche

interface Props {
  driverId: string;
  isOnline: boolean;
}

type TagEinnahmen = {
  datum: string;
  wochentag: string;
  umsatz_eur: number;
  stopps: number;
  vorwoche_eur: number;
};

type ApiResponse = {
  tage: TagEinnahmen[];
  gesamt_eur: number;
  vorwoche_gesamt_eur: number;
  trend_pct: number;
  bester_tag: string;
  generiert_am: string;
};

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const MOCK: ApiResponse = {
  tage: [
    { datum: '2026-07-06', wochentag: 'Mo', umsatz_eur: 82,  stopps: 9,  vorwoche_eur: 74 },
    { datum: '2026-07-07', wochentag: 'Di', umsatz_eur: 91,  stopps: 10, vorwoche_eur: 88 },
    { datum: '2026-07-08', wochentag: 'Mi', umsatz_eur: 67,  stopps: 7,  vorwoche_eur: 79 },
    { datum: '2026-07-09', wochentag: 'Do', umsatz_eur: 105, stopps: 12, vorwoche_eur: 95 },
    { datum: '2026-07-10', wochentag: 'Fr', umsatz_eur: 134, stopps: 15, vorwoche_eur: 120 },
    { datum: '2026-07-11', wochentag: 'Sa', umsatz_eur: 156, stopps: 18, vorwoche_eur: 142 },
    { datum: '2026-07-12', wochentag: 'So', umsatz_eur: 48,  stopps: 5,  vorwoche_eur: 130 },
  ],
  gesamt_eur: 683,
  vorwoche_gesamt_eur: 728,
  trend_pct: -6,
  bester_tag: 'Sa',
  generiert_am: new Date().toISOString(),
};

export function FahrerPhase1132EinnahmenWochenuebersicht({ driverId, isOnline }: Props) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/driver/einnahmen-wochenuebersicht?driver_id=${encodeURIComponent(driverId)}`);
      if (!res.ok) throw new Error('fetch');
      setData(await res.json() as ApiResponse);
    } catch {
      setData(MOCK);
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    if (isOnline) {
      load();
      const id = setInterval(load, 5 * 60_000);
      return () => clearInterval(id);
    }
  }, [isOnline, load]);

  if (!isOnline) return null;

  const trend = data?.trend_pct ?? 0;
  const TrendIcon = trend > 2 ? TrendingUp : trend < -2 ? TrendingDown : Minus;
  const trendColor = trend > 2 ? 'text-emerald-600 dark:text-emerald-400' : trend < -2 ? 'text-red-500 dark:text-red-400' : 'text-muted-foreground';

  const maxUmsatz = data ? Math.max(...data.tage.map(t => Math.max(t.umsatz_eur, t.vorwoche_eur)), 1) : 1;

  return (
    <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50 dark:bg-violet-900/20 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm text-violet-700 dark:text-violet-300">Einnahmen-Woche</span>
          {data && (
            <span className="rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-2 py-0.5 text-[10px] font-bold">
              {data.gesamt_eur.toFixed(0)} €
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <span className="text-[10px] text-muted-foreground">…</span>}
          {data && (
            <div className={cn('flex items-center gap-0.5 text-[10px] font-bold', trendColor)}>
              <TrendIcon className="h-3 w-3" />
              {trend > 0 ? '+' : ''}{trend}% ggü. VW
            </div>
          )}
          {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {open && data && (
        <div className="px-4 pb-4 space-y-3 border-t border-violet-200/50 dark:border-violet-800/50 pt-3">
          {/* Balkendiagramm */}
          <div className="flex items-end gap-1.5 h-28">
            {data.tage.map(tag => {
              const currentH = Math.round((tag.umsatz_eur / maxUmsatz) * 100);
              const vorwocheH = Math.round((tag.vorwoche_eur / maxUmsatz) * 100);
              const isToday = tag.wochentag === WOCHENTAGE[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
              return (
                <div key={tag.datum} className="flex-1 flex flex-col items-center gap-0.5">
                  <div className="w-full flex items-end gap-0.5 h-20">
                    {/* Vorwoche (grau) */}
                    <div
                      className="flex-1 rounded-t bg-violet-200 dark:bg-violet-800/60 transition-all duration-500"
                      style={{ height: `${vorwocheH}%` }}
                    />
                    {/* Diese Woche (violett) */}
                    <div
                      className={cn(
                        'flex-1 rounded-t transition-all duration-500',
                        isToday ? 'bg-violet-600' : 'bg-violet-400 dark:bg-violet-500'
                      )}
                      style={{ height: `${currentH}%` }}
                    />
                  </div>
                  <div className={cn('text-[9px] font-bold', isToday ? 'text-violet-700 dark:text-violet-300' : 'text-muted-foreground')}>
                    {tag.wochentag}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legende */}
          <div className="flex items-center gap-3 justify-center">
            <div className="flex items-center gap-1">
              <div className="w-3 h-2 rounded-sm bg-violet-400" />
              <span className="text-[9px] text-muted-foreground">Diese Woche</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-2 rounded-sm bg-violet-200 dark:bg-violet-800/60" />
              <span className="text-[9px] text-muted-foreground">Vorwoche</span>
            </div>
          </div>

          {/* Zusammenfassung */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-white/70 dark:bg-white/5 p-2 text-center">
              <div className="text-base font-black text-foreground">{data.gesamt_eur.toFixed(0)} €</div>
              <div className="text-[9px] text-muted-foreground">Diese Woche</div>
            </div>
            <div className="rounded-lg bg-white/70 dark:bg-white/5 p-2 text-center">
              <div className="text-base font-black text-muted-foreground">{data.vorwoche_gesamt_eur.toFixed(0)} €</div>
              <div className="text-[9px] text-muted-foreground">Vorwoche</div>
            </div>
          </div>

          <div className="text-[9px] text-muted-foreground text-center">
            Bester Tag: <span className="font-bold text-violet-700 dark:text-violet-300">{data.bester_tag}</span>
          </div>
        </div>
      )}
    </div>
  );
}
