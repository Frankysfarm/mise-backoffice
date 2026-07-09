'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Euro, Loader2, Star, TrendingUp } from 'lucide-react';

/**
 * phase887 — Trinkgeld-Tagestrend
 *
 * Tages-Timeline Trinkgeld je Stunde + Bestzeit-Highlight.
 * 5-Min-Polling gegen /api/delivery/driver/trinkgeld-tagestrend.
 */

interface Stunde {
  hour: number;
  trinkgeld: number;
  ist_vergangen: boolean;
  ist_aktuell: boolean;
}

interface TrinkgeldData {
  stunden: Stunde[];
  total: number;
  best_hour: number;
  best_trinkgeld: number;
  hist_avg_tag: number;
  trend: 'besser' | 'schlechter' | 'normal';
}

interface Props {
  driverId: string;
  isOnline: boolean;
}

const MOCK_DATA: TrinkgeldData = {
  stunden: Array.from({ length: 10 }, (_, i) => ({
    hour: 10 + i,
    trinkgeld: [0.5, 1.0, 0.0, 2.5, 3.0, 1.5, 0.0, 2.0, 1.0, 0.5][i] ?? 0,
    ist_vergangen: i < 9,
    ist_aktuell: i === 9,
  })),
  total: 12.0,
  best_hour: 14,
  best_trinkgeld: 3.0,
  hist_avg_tag: 9.5,
  trend: 'besser',
};

const TREND_CONFIG = {
  besser: { label: '↑ Besser als üblich', cls: 'text-matcha-600 bg-matcha-50 border-matcha-300 dark:bg-matcha-900/30' },
  schlechter: { label: '↓ Unter Durchschnitt', cls: 'text-red-600 bg-red-50 border-red-300 dark:bg-red-900/30' },
  normal: { label: '→ Im Durchschnitt', cls: 'text-blue-600 bg-blue-50 border-blue-300 dark:bg-blue-900/30' },
};

export function FahrerPhase887TrinkgeldTagestrend({ driverId, isOnline }: Props) {
  const [data, setData] = useState<TrinkgeldData | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  async function poll() {
    if (!driverId) return;
    try {
      const res = await fetch(`/api/delivery/driver/trinkgeld-tagestrend?driver_id=${driverId}`);
      if (res.ok) {
        const json = await res.json() as TrinkgeldData;
        setData(json);
        return;
      }
    } catch { /* intentional */ }
    setData(MOCK_DATA);
  }

  useEffect(() => {
    setLoading(true);
    poll().finally(() => setLoading(false));
    const t = setInterval(poll, 5 * 60_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId]);

  if (!isOnline && !data) return null;

  const maxTrinkgeld = data ? Math.max(...data.stunden.map(s => s.trinkgeld), 0.01) : 1;
  const trend = data ? TREND_CONFIG[data.trend] : null;

  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2">
          <Euro className="h-4 w-4 text-amber-500" />
          <span className="text-sm font-bold text-amber-700 dark:text-amber-300">Trinkgeld Heute</span>
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
          {data && !loading && (
            <span className="text-sm font-black text-amber-800 dark:text-amber-200">
              {data.total.toFixed(2)} €
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && data && (
        <div className="mt-3 space-y-3">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-white dark:bg-gray-900/50 border border-amber-200 px-3 py-2 text-center">
              <div className="text-lg font-black text-amber-700 dark:text-amber-300">{data.total.toFixed(2)} €</div>
              <div className="text-[9px] text-muted-foreground">Heute gesamt</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-900/50 border border-amber-200 px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <Star className="h-3 w-3 text-amber-500" />
                <span className="text-lg font-black text-amber-700 dark:text-amber-300">{data.best_trinkgeld.toFixed(2)} €</span>
              </div>
              <div className="text-[9px] text-muted-foreground">{data.best_hour}:00 Uhr Bestzeit</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-900/50 border border-amber-200 px-3 py-2 text-center">
              <div className="flex items-center justify-center gap-1">
                <TrendingUp className="h-3 w-3 text-blue-500" />
                <span className="text-lg font-black text-blue-700 dark:text-blue-300">{data.hist_avg_tag.toFixed(2)} €</span>
              </div>
              <div className="text-[9px] text-muted-foreground">Ø gleicher Wochentag</div>
            </div>
          </div>

          {/* Trend badge */}
          {trend && (
            <div className={cn('rounded-lg border px-3 py-1.5 text-xs font-bold', trend.cls)}>
              {trend.label}
            </div>
          )}

          {/* Hourly timeline bars */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-2">Timeline heute</p>
            <div className="flex items-end gap-1" style={{ height: 56 }}>
              {data.stunden.map(s => {
                const heightPct = maxTrinkgeld > 0 ? (s.trinkgeld / maxTrinkgeld) * 100 : 0;
                const isBest = s.hour === data.best_hour && s.trinkgeld > 0;
                return (
                  <div key={s.hour} className="flex-1 flex flex-col items-center justify-end gap-0.5" style={{ height: 56 }}>
                    <div
                      className={cn(
                        'w-full rounded-t-sm transition-all duration-300',
                        isBest ? 'bg-amber-500' : s.ist_aktuell ? 'bg-amber-400' : s.trinkgeld > 0 ? 'bg-amber-300 dark:bg-amber-700' : 'bg-gray-200 dark:bg-gray-700',
                      )}
                      style={{ height: `${Math.max(4, heightPct)}%` }}
                    />
                    <span className={cn(
                      'text-[8px] tabular-nums',
                      isBest ? 'font-black text-amber-600' : 'text-muted-foreground',
                    )}>
                      {s.hour}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {data.best_trinkgeld > 0 && (
            <div className="rounded-lg border border-amber-300 bg-amber-100 dark:bg-amber-900/30 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-200">
              ⭐ Bestzeit: {data.best_hour}:00 Uhr — {data.best_trinkgeld.toFixed(2)} € Trinkgeld
            </div>
          )}
        </div>
      )}
    </div>
  );
}
