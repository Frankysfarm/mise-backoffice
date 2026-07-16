'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, AlertTriangle, Clock } from 'lucide-react';

/**
 * Phase 1912 — Zubereitungszeit-Trendlinie (Kitchen)
 *
 * Ø Zubereitungszeit letzte 7 Tage als Sparkline.
 * Trend-Pfeil; Alert wenn heute >20% über Wochenschnitt.
 * useMemo + Collapsible; rein props-basiert.
 */

interface Order {
  id: string;
  status?: string;
  created_at?: string;
  prep_started_at?: string;
  prep_finished_at?: string;
  ready_at?: string;
}

interface Props {
  orders: Order[];
  className?: string;
}

interface TagDaten {
  datum: string;
  avg_min: number;
  anzahl: number;
}

function datumLabel(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function Sparkline({ tage, alert }: { tage: TagDaten[]; alert: boolean }) {
  const vals = tage.map((t) => t.avg_min);
  const max = Math.max(...vals, 1);
  const min = Math.min(...vals);
  const range = max - min || 1;
  const W = 110;
  const H = 30;
  const pts = tage.map((t, i) => {
    const x = (i / (tage.length - 1)) * W;
    const y = H - ((t.avg_min - min) / range) * (H - 4) - 2;
    return `${x},${y}`;
  });
  const color = alert ? '#ef4444' : '#22c55e';
  return (
    <svg width={W} height={H} className="shrink-0 overflow-visible">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts.join(' ')}
      />
    </svg>
  );
}

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export function KitchenPhase1912ZubereitungszeitTrendlinie({ orders, className }: Props) {
  const [offen, setOffen] = useState(true);

  const { tage, heute, wochenAvg, abweichung, alert, trend } = useMemo(() => {
    const tagDaten = Array.from({ length: 7 }, (_, i) => ({ datum: datumLabel(6 - i), minuten: [] as number[] }));
    const tagMap = new Map(tagDaten.map((t) => [t.datum, t.minuten]));

    for (const o of orders) {
      if (!o.created_at) continue;
      const start = o.prep_started_at ?? o.created_at;
      const end = o.prep_finished_at ?? o.ready_at;
      if (!end) continue;
      const dauer = (new Date(end).getTime() - new Date(start).getTime()) / 60_000;
      if (dauer <= 0 || dauer > 120) continue;
      const datum = o.created_at.slice(0, 10);
      const arr = tagMap.get(datum);
      if (arr) arr.push(dauer);
    }

    const aufbereitete: TagDaten[] = tagDaten.map((t) => ({
      datum: t.datum,
      avg_min: t.minuten.length > 0 ? Math.round(t.minuten.reduce((s, v) => s + v, 0) / t.minuten.length) : 0,
      anzahl: t.minuten.length,
    }));

    const heut = aufbereitete[6].avg_min;
    const vorherigeWoche = aufbereitete.slice(0, 6).filter((t) => t.avg_min > 0);
    const wAvg = vorherigeWoche.length > 0
      ? Math.round(vorherigeWoche.reduce((s, t) => s + t.avg_min, 0) / vorherigeWoche.length)
      : heut;
    const abw = wAvg > 0 ? Math.round(((heut - wAvg) / wAvg) * 1000) / 10 : 0;
    const isAlert = heut > 0 && abw > 20;

    let trendRicht: 'steigend' | 'fallend' | 'stabil' = 'stabil';
    if (abw > 5) trendRicht = 'steigend';
    else if (abw < -5) trendRicht = 'fallend';

    return { tage: aufbereitete, heute: heut, wochenAvg: wAvg, abweichung: abw, alert: isAlert, trend: trendRicht };
  }, [orders]);

  const hatDaten = tage.some((t) => t.avg_min > 0);

  const TrendIcon =
    trend === 'steigend' ? (
      <TrendingUp className="h-3.5 w-3.5 text-red-500 shrink-0" />
    ) : trend === 'fallend' ? (
      <TrendingDown className="h-3.5 w-3.5 text-green-500 shrink-0" />
    ) : (
      <Minus className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
    );

  return (
    <div className={cn('rounded-2xl border bg-card shadow-sm overflow-hidden', className)}>
      <button
        onClick={() => setOffen((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-2.5 border-b hover:bg-muted/30 transition-colors"
      >
        <Clock className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider">Zubereitungszeit · 7-Tage-Trend</span>
        {alert && (
          <span className="ml-1 text-[10px] font-bold rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-2 py-0.5">
            +{abweichung.toFixed(0)}%
          </span>
        )}
        {offen ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
        )}
      </button>

      {offen && (
        <div className="p-4 space-y-3">
          {alert && (
            <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 px-3 py-2 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 dark:text-red-300">
                Heutige Ø-Zubereitungszeit {heute} Min — {abweichung.toFixed(0)}% über Wochenschnitt ({wochenAvg} Min). Küche prüfen.
              </p>
            </div>
          )}

          {!hatDaten ? (
            <p className="text-xs text-muted-foreground text-center py-4">Noch keine Zubereitungszeiten heute</p>
          ) : (
            <>
              {/* KPI-Zeile */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border bg-muted/30 px-3 py-2 text-center">
                  <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Heute</div>
                  <div
                    className={cn(
                      'text-lg font-black tabular-nums mt-0.5',
                      alert
                        ? 'text-red-600 dark:text-red-400'
                        : heute <= wochenAvg
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-amber-600 dark:text-amber-400',
                    )}
                  >
                    {heute > 0 ? `${heute}m` : '–'}
                  </div>
                </div>
                <div className="rounded-xl border bg-muted/30 px-3 py-2 text-center">
                  <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Ø Woche</div>
                  <div className="text-lg font-black tabular-nums mt-0.5">{wochenAvg > 0 ? `${wochenAvg}m` : '–'}</div>
                </div>
                <div className="rounded-xl border bg-muted/30 px-3 py-2 text-center">
                  <div className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Trend</div>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    {TrendIcon}
                    <span
                      className={cn(
                        'text-xs font-bold',
                        abweichung > 5
                          ? 'text-red-600 dark:text-red-400'
                          : abweichung < -5
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-muted-foreground',
                      )}
                    >
                      {abweichung > 0 ? '+' : ''}{abweichung.toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Sparkline */}
              <div className="space-y-1 px-1">
                <Sparkline tage={tage} alert={alert} />
                <div className="flex justify-between">
                  {WOCHENTAGE.map((t, i) => (
                    <span key={i} className="text-[9px] text-muted-foreground">{t}</span>
                  ))}
                </div>
              </div>

              {/* Tageswerte */}
              <div className="space-y-1">
                {tage.filter((t) => t.avg_min > 0).map((t) => (
                  <div key={t.datum} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-20 shrink-0">
                      {new Date(t.datum + 'T12:00:00Z').toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                    </span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          t.datum === tage[6].datum && alert
                            ? 'bg-red-500'
                            : t.avg_min <= (wochenAvg || 20)
                            ? 'bg-green-500'
                            : 'bg-amber-400',
                        )}
                        style={{ width: `${Math.min(100, (t.avg_min / Math.max(...tage.map((x) => x.avg_min), 1)) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold tabular-nums text-right w-10 shrink-0">{t.avg_min} Min</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
