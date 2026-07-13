'use client';

// Phase 1256 — Fahrer-Stimmungs-Dashboard (Lieferdienst)
// Admin-Übersicht aller Fahrer: Ø-Score + kritische Fahrer rot + Verteilungsbalken
// Nutzt /api/delivery/admin/fahrer-stimmungs-aggregat · 10-Min-Polling

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, SmilePlus, Loader2, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KritischerFahrer {
  id: string;
  name: string;
  letzter_score: number;
}

interface ApiResponse {
  schnitt: number;
  trend: 'steigend' | 'stabil' | 'fallend';
  kritische_fahrer: KritischerFahrer[];
  stimmungs_verteilung: Array<{ score: number; count: number }>;
  gesamt_eintraege: number;
  location_id: string;
  generiert_am: string;
}

const TREND_ICON = { steigend: TrendingUp, stabil: Minus, fallend: TrendingDown };
const TREND_COLOR = { steigend: 'text-green-500', stabil: 'text-slate-400', fallend: 'text-red-500' };
const TREND_LABEL = { steigend: 'Steigend', stabil: 'Stabil', fallend: 'Fallend' };

const SCORE_EMOJI: Record<number, string> = { 1: '😞', 2: '😑', 3: '😐', 4: '😊', 5: '😄' };
const SCORE_COLOR: Record<number, string> = {
  1: 'bg-red-500',
  2: 'bg-orange-400',
  3: 'bg-amber-400',
  4: 'bg-green-400',
  5: 'bg-emerald-500',
};

function SchnittBadge({ schnitt }: { schnitt: number }) {
  const color =
    schnitt >= 4.5 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
    schnitt >= 3.5 ? 'text-green-600 bg-green-50 border-green-200' :
    schnitt >= 2.5 ? 'text-amber-600 bg-amber-50 border-amber-200' :
    'text-red-600 bg-red-50 border-red-200';

  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full border px-3 py-1 text-lg font-black tabular-nums', color)}>
      {SCORE_EMOJI[Math.round(schnitt)] ?? '😐'} {schnitt.toFixed(1)}
    </span>
  );
}

export function LieferdienstPhase1256FahrerStimmungsDashboard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = () => {
    if (!locationId) return;
    setLoading(true);
    fetch(`/api/delivery/admin/fahrer-stimmungs-aggregat?location_id=${locationId}`)
      .then(r => r.json())
      .then((d: ApiResponse) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 10 * 60_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const TrendIcon = data ? TREND_ICON[data.trend] : Minus;
  const kritisch = (data?.kritische_fahrer ?? []).length;
  const maxCount = Math.max(1, ...(data?.stimmungs_verteilung ?? []).map(v => v.count));

  const headerBg = kritisch > 0
    ? 'bg-gradient-to-r from-red-500 to-rose-500'
    : 'bg-gradient-to-r from-indigo-500 to-violet-500';

  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn('w-full flex items-center gap-2 px-4 py-2.5 text-white', headerBg)}
      >
        <SmilePlus className="h-4 w-4 shrink-0" />
        <span className="text-sm font-bold flex-1 text-left">Fahrer-Stimmungs-Dashboard</span>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin opacity-70" />}
        {kritisch > 0 && (
          <span className="flex items-center gap-1 text-xs bg-white/20 rounded-full px-2 py-0.5 font-bold">
            <AlertTriangle className="h-3 w-3" />
            {kritisch} Kritisch
          </span>
        )}
        {open ? <ChevronUp className="h-4 w-4 opacity-80" /> : <ChevronDown className="h-4 w-4 opacity-80" />}
      </button>

      {open && (
        <div className="p-4 space-y-4 bg-background">
          {!locationId && (
            <p className="text-sm text-muted-foreground">Bitte Filiale auswählen.</p>
          )}

          {locationId && !data && !loading && (
            <p className="text-sm text-muted-foreground">Keine Daten verfügbar.</p>
          )}

          {data && (
            <>
              {/* Ø-Score + Trend */}
              <div className="flex items-center gap-4">
                <SchnittBadge schnitt={data.schnitt} />
                <div className="flex items-center gap-1.5">
                  <TrendIcon className={cn('h-4 w-4', TREND_COLOR[data.trend])} />
                  <span className={cn('text-xs font-semibold', TREND_COLOR[data.trend])}>
                    {TREND_LABEL[data.trend]}
                  </span>
                </div>
                <span className="ml-auto text-xs text-muted-foreground">
                  {data.gesamt_eintraege} Einträge heute
                </span>
              </div>

              {/* Verteilungsbalken 1–5 */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Stimmungs-Verteilung
                </div>
                {[...data.stimmungs_verteilung].reverse().map(({ score, count }) => (
                  <div key={score} className="flex items-center gap-2">
                    <span className="w-6 text-sm shrink-0">{SCORE_EMOJI[score]}</span>
                    <div className="flex-1 h-3 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', SCORE_COLOR[score])}
                        style={{ width: `${(count / maxCount) * 100}%` }}
                      />
                    </div>
                    <span className="w-5 shrink-0 text-right text-xs font-bold tabular-nums text-foreground">
                      {count}
                    </span>
                  </div>
                ))}
              </div>

              {/* Kritische Fahrer */}
              {kritisch > 0 && (
                <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-bold uppercase tracking-wide">Kritische Fahrer (Score ≤ 2)</span>
                  </div>
                  <div className="space-y-1">
                    {data.kritische_fahrer.map(f => (
                      <div key={f.id} className="flex items-center gap-2">
                        <span className="text-base">{SCORE_EMOJI[f.letzter_score]}</span>
                        <span className="text-sm font-semibold text-foreground">{f.name}</span>
                        <span className="ml-auto text-xs font-black text-red-600 dark:text-red-400 tabular-nums">
                          {f.letzter_score}/5
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {kritisch === 0 && (
                <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                  ✓ Alle Fahrer mit Stimmungs-Score ≥ 3 — Team in guter Verfassung.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
