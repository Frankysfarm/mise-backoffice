'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, TrendingDown, TrendingUp, Minus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type StornoGrund = {
  grund: string;
  anzahl: number;
  anteil_pct: number;
  tageszeit: string;
  trend: 'steigend' | 'stabil' | 'fallend';
};

type StundeRate = {
  stunde: number;
  label: string;
  storno_rate_pct: number;
  total: number;
  stornos: number;
};

type ApiResponse = {
  gesamt_storno_rate_pct: number;
  alert: boolean;
  alert_message: string | null;
  grunde: StornoGrund[];
  stunden: StundeRate[];
  kritischste_stunde: string | null;
};

function mock(): ApiResponse {
  return {
    gesamt_storno_rate_pct: 7.4,
    alert: false,
    alert_message: null,
    grunde: [
      { grund: 'Zu lange Wartezeit', anzahl: 12, anteil_pct: 40, tageszeit: '19:00–20:00', trend: 'steigend' },
      { grund: 'Falsche Bestellung', anzahl: 7, anteil_pct: 23, tageszeit: '12:00–13:00', trend: 'stabil' },
      { grund: 'Keine Antwort Fahrer', anzahl: 5, anteil_pct: 17, tageszeit: '18:00–19:00', trend: 'fallend' },
      { grund: 'Technischer Fehler', anzahl: 4, anteil_pct: 13, tageszeit: 'ganztags', trend: 'stabil' },
      { grund: 'Sonstiges', anzahl: 2, anteil_pct: 7, tageszeit: 'ganztags', trend: 'stabil' },
    ],
    stunden: [
      { stunde: 11, label: '11:00', storno_rate_pct: 2.1, total: 48, stornos: 1 },
      { stunde: 12, label: '12:00', storno_rate_pct: 5.3, total: 75, stornos: 4 },
      { stunde: 13, label: '13:00', storno_rate_pct: 6.7, total: 90, stornos: 6 },
      { stunde: 18, label: '18:00', storno_rate_pct: 8.2, total: 85, stornos: 7 },
      { stunde: 19, label: '19:00', storno_rate_pct: 9.1, total: 110, stornos: 10 },
      { stunde: 20, label: '20:00', storno_rate_pct: 7.8, total: 77, stornos: 6 },
    ],
    kritischste_stunde: '19:00',
  };
}

const TREND_ICON = {
  steigend: TrendingUp,
  stabil: Minus,
  fallend: TrendingDown,
} as const;

const TREND_CLS = {
  steigend: 'text-red-500',
  stabil: 'text-gray-400',
  fallend: 'text-matcha-500',
} as const;

function rateColor(pct: number): string {
  if (pct > 10) return 'bg-red-500';
  if (pct > 7) return 'bg-orange-400';
  if (pct > 4) return 'bg-amber-300';
  return 'bg-matcha-400';
}

export function KitchenPhase1073EchtzeitStornoAnalyse({ locationId }: { locationId?: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const p = new URLSearchParams();
      if (locationId) p.set('location_id', locationId);
      const r = await fetch(`/api/delivery/admin/echtzeit-storno-analyse?${p}`);
      if (r.ok) setData(await r.json());
      else throw new Error();
    } catch {
      setData(mock());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 90_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const maxRate = Math.max(...(data?.stunden.map((s) => s.storno_rate_pct) ?? [1]));

  return (
    <div className={cn(
      'rounded-2xl border overflow-hidden',
      data?.alert
        ? 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30'
        : 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20',
    )}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-orange-200 dark:border-orange-800">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className={data?.alert ? 'text-red-600 dark:text-red-400' : 'text-orange-500'} />
          <span className="text-xs font-bold uppercase tracking-wider text-orange-800 dark:text-orange-200">
            Echtzeit-Storno-Analyse
          </span>
        </div>
        {data && (
          <div className="flex items-center gap-2">
            {data.alert && (
              <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white animate-pulse">
                ALERT
              </span>
            )}
            <span className={cn(
              'rounded-full px-2 py-0.5 text-[10px] font-bold',
              data.gesamt_storno_rate_pct > 10
                ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                : 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300',
            )}>
              {data.gesamt_storno_rate_pct.toFixed(1)}% Storno-Rate
            </span>
          </div>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 size={16} className="animate-spin text-orange-400" />
        </div>
      )}

      {!loading && data && (
        <div className="p-3 space-y-3">
          {data.alert_message && (
            <div className="flex items-center gap-2 rounded-lg bg-red-100 dark:bg-red-900/40 border border-red-300 dark:border-red-700 px-3 py-2">
              <AlertTriangle size={13} className="text-red-600 shrink-0" />
              <span className="text-xs font-semibold text-red-700 dark:text-red-300">{data.alert_message}</span>
            </div>
          )}

          {/* Storno-Rate je Tageszeit */}
          <div>
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Rate nach Tageszeit {data.kritischste_stunde && `· Peak: ${data.kritischste_stunde}`}
            </div>
            <div className="space-y-1.5">
              {data.stunden.map((s) => (
                <div key={s.stunde} className="flex items-center gap-2">
                  <span className="w-12 shrink-0 text-[11px] font-bold tabular-nums text-orange-900 dark:text-orange-100">
                    {s.label}
                  </span>
                  <div className="flex-1 h-4 bg-white dark:bg-black/20 rounded overflow-hidden relative">
                    <div
                      className={cn('h-full rounded transition-all duration-700', rateColor(s.storno_rate_pct))}
                      style={{ width: `${Math.min(100, (s.storno_rate_pct / Math.max(maxRate, 1)) * 100)}%` }}
                    />
                    <span className="absolute inset-0 flex items-center px-1.5 text-[9px] font-black tabular-nums text-gray-800 dark:text-white">
                      {s.storno_rate_pct.toFixed(1)}% · {s.stornos}/{s.total}
                    </span>
                  </div>
                  {s.storno_rate_pct > 10 && (
                    <AlertTriangle size={10} className="text-red-500 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Storno-Gründe */}
          {data.grunde.length > 0 && (
            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Top-Gründe (7 Tage)</div>
              <div className="space-y-1">
                {data.grunde.slice(0, 4).map((g) => {
                  const Icon = TREND_ICON[g.trend];
                  return (
                    <div key={g.grund} className="flex items-center gap-2">
                      <div className="flex-1 flex items-center gap-1 min-w-0">
                        <Icon size={10} className={cn('shrink-0', TREND_CLS[g.trend])} />
                        <span className="text-[11px] text-foreground truncate">{g.grund}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-14 h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-orange-400"
                            style={{ width: `${g.anteil_pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold tabular-nums text-muted-foreground w-8 text-right">
                          {g.anteil_pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
