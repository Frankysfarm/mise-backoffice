'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Loader2, Star, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourScore {
  tour_id: string;
  datum: string;
  stopps_gesamt: number;
  stopps_puenktlich: number;
  puenktlichkeit_pct: number;
  kundenbewertung: number | null;
  effizienz_score: number;
  gesamt_score: number;
  badge: 'gold' | 'silber' | 'bronze' | 'keine';
}

interface ApiData {
  driver_id: string;
  touren: TourScore[];
  durchschnitt_gesamt: number;
  durchschnitt_puenktlichkeit_pct: number;
  durchschnitt_bewertung: number | null;
}

interface Props {
  isOnline: boolean;
  driverId: string | null;
}

const BADGE_STYLE: Record<TourScore['badge'], { bg: string; text: string; icon: string }> = {
  gold:   { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', icon: '🥇' },
  silber: { bg: 'bg-slate-100 dark:bg-slate-800',     text: 'text-slate-600 dark:text-slate-300',   icon: '🥈' },
  bronze: { bg: 'bg-orange-100 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400', icon: '🥉' },
  keine:  { bg: 'bg-muted',                            text: 'text-muted-foreground',                 icon: '·' },
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

export function FahrerPhase1644TourQualitaetsScoreKarte({ isOnline, driverId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      const res = await window.fetch(`/api/delivery/driver/tour-qualitaets-score?driver_id=${driverId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [driverId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15 * 60_000);
    return () => clearInterval(iv);
  }, [load]);

  if (!isOnline) return null;
  if (!driverId) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
        <span className="text-sm font-bold">Tour-Qualitäts-Score</span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground ml-auto" />}
      </div>

      {data && (
        <>
          {/* Durchschnitte */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Gesamt', value: `${data.durchschnitt_gesamt}`, unit: 'Pkt' },
              { label: 'Pünktlich', value: `${data.durchschnitt_puenktlichkeit_pct}`, unit: '%' },
              { label: 'Bewertung', value: data.durchschnitt_bewertung !== null ? `${data.durchschnitt_bewertung}` : '–', unit: '★' },
            ].map(({ label, value, unit }) => (
              <div key={label} className="rounded-xl bg-muted/50 p-2 text-center">
                <div className="flex items-baseline justify-center gap-0.5">
                  <span className="text-lg font-bold tabular-nums">{value}</span>
                  <span className="text-[10px] text-muted-foreground">{unit}</span>
                </div>
                <div className="text-[10px] text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>

          {/* Timeline der letzten 5 Touren */}
          <div>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Letzte {data.touren.length} Touren
            </div>
            <div className="space-y-2">
              {data.touren.map((t, i) => {
                const bs = BADGE_STYLE[t.badge];
                return (
                  <div key={t.tour_id} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-4 shrink-0">{i + 1}</span>
                    <div className={cn('flex items-center gap-1.5 rounded-full px-2 py-0.5 shrink-0', bs.bg)}>
                      <span className="text-[11px]">{bs.icon}</span>
                      <span className={cn('text-[10px] font-bold tabular-nums', bs.text)}>{t.gesamt_score}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <span className="text-muted-foreground shrink-0">{fmtDate(t.datum)}</span>
                        <span className="truncate text-muted-foreground">·</span>
                        <span className="truncate">{t.stopps_puenktlich}/{t.stopps_gesamt} pünktl.</span>
                        {t.kundenbewertung !== null && (
                          <>
                            <span className="text-muted-foreground">·</span>
                            <span className="flex items-center gap-0.5">
                              <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                              <span className="tabular-nums">{t.kundenbewertung}</span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Mini-Balken Gesamt-Score */}
                    <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
                      <div
                        className={cn('h-full rounded-full', t.gesamt_score >= 85 ? 'bg-yellow-400' : t.gesamt_score >= 70 ? 'bg-slate-400' : t.gesamt_score >= 50 ? 'bg-orange-400' : 'bg-muted-foreground')}
                        style={{ width: `${t.gesamt_score}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="text-sm text-muted-foreground text-center py-3">Noch keine Tour-Daten.</div>
      )}
    </div>
  );
}
