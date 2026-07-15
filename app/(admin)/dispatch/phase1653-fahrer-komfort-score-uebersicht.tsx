'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, RefreshCw, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerKomfort {
  fahrer_id: string;
  fahrer_name: string;
  pausen_minuten: number;
  km_gesamt: number;
  tour_anzahl: number;
  komfort_score: number;
  empfehlung: 'pause' | 'weiter' | 'schicht_ende';
}

interface ApiData {
  fahrer: FahrerKomfort[];
  location_id: string;
  generiert_am: string;
}

interface Props {
  locationId: string | null;
}

const SCORE_STYLE = (score: number) => {
  if (score >= 70) return { bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400' };
  if (score >= 45) return { bar: 'bg-amber-400',   text: 'text-amber-700 dark:text-amber-400' };
  return               { bar: 'bg-red-500',         text: 'text-red-700 dark:text-red-400' };
};

const EMPFEHLUNG_STYLE: Record<FahrerKomfort['empfehlung'], { label: string; chip: string }> = {
  weiter:      { label: 'Weiter',      chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400' },
  pause:       { label: 'Pause',       chip: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' },
  schicht_ende:{ label: 'Schicht Ende',chip: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' },
};

function TrendIcon({ score }: { score: number }) {
  if (score >= 70) return <TrendingUp className="h-3 w-3 text-emerald-500" />;
  if (score >= 45) return <Minus className="h-3 w-3 text-amber-500" />;
  return <TrendingDown className="h-3 w-3 text-red-500" />;
}

export function DispatchPhase1653FahrerKomfortScoreUebersicht({ locationId }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [lastFetch, setLastFetch] = useState<number | null>(null);

  const doFetch = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await window.fetch(`/api/delivery/admin/fahrer-komfort-uebersicht?location_id=${locationId}`);
      if (res.ok) {
        setData(await res.json());
        setLastFetch(Date.now());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    doFetch();
    const iv = setInterval(doFetch, 30 * 60_000);
    return () => clearInterval(iv);
  }, [doFetch]);

  if (!locationId) return null;

  const avgScore = data && data.fahrer.length > 0
    ? Math.round(data.fahrer.reduce((a, f) => a + f.komfort_score, 0) / data.fahrer.length)
    : null;

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold">Fahrer-Komfort-Score</span>
          {avgScore !== null && (
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', SCORE_STYLE(avgScore).text, 'bg-muted')}>
              Ø {avgScore}
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <div className="flex items-center gap-2">
          {lastFetch && (
            <span className="text-[10px] text-muted-foreground hidden sm:block">
              vor {Math.floor((Date.now() - lastFetch) / 60_000)} Min
            </span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); doFetch(); }}
            className="rounded p-1 hover:bg-muted transition"
            title="Aktualisieren"
          >
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          {collapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
        </div>
      </button>

      {!collapsed && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {!data && !loading && (
            <div className="text-sm text-muted-foreground text-center py-4">Keine Daten verfügbar.</div>
          )}

          {data && data.fahrer.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-4">Keine aktiven Fahrer.</div>
          )}

          {data && data.fahrer.map((f) => {
            const sStyle = SCORE_STYLE(f.komfort_score);
            const eStyle = EMPFEHLUNG_STYLE[f.empfehlung];
            return (
              <div key={f.fahrer_id} className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-3">
                {/* Name + Empfehlung + Trend */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <TrendIcon score={f.komfort_score} />
                    <span className="text-xs font-bold truncate">{f.fahrer_name}</span>
                  </div>
                  <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold shrink-0', eStyle.chip)}>
                    {eStyle.label}
                  </span>
                </div>

                {/* Score-Balken */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn('h-full rounded-full', sStyle.bar)} style={{ width: `${f.komfort_score}%` }} />
                  </div>
                  <span className={cn('text-xs font-bold tabular-nums shrink-0 w-8 text-right', sStyle.text)}>
                    {f.komfort_score}
                  </span>
                </div>

                {/* KPI-Chips */}
                <div className="flex gap-2 flex-wrap">
                  {[
                    { label: 'Pausen', value: `${f.pausen_minuten} Min` },
                    { label: 'km', value: `${f.km_gesamt} km` },
                    { label: 'Touren', value: `${f.tour_anzahl}×` },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
                      <span className="font-bold text-foreground">{value}</span> {label}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
