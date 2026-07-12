'use client';

// Phase 1124 — Tour-Score-Visualisierung Pro (Dispatch)
// Live-Scoreboard aller aktiven Touren mit Fahrerbewertung + Fortschrittsbalken + Farb-Ampel

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, Loader2, MapPin, Star, TrendingUp, TrendingDown, Minus, Route } from 'lucide-react';

interface Props { locationId: string | null }

type TourHealth = 'gut' | 'ok' | 'risiko' | 'kritisch';
type TourRow = {
  batch_id: string;
  fahrer_name: string;
  score: number;
  stopps_gesamt: number;
  stopps_abgeschlossen: number;
  zone: string | null;
  laufzeit_min: number;
  sla_ok: boolean;
  health: TourHealth;
};

type ApiResponse = {
  touren: TourRow[];
  avg_score: number;
  generiert_am: string;
};

const MOCK: ApiResponse = {
  avg_score: 82,
  generiert_am: new Date().toISOString(),
  touren: [
    { batch_id: 'b1', fahrer_name: 'Ahmad K.',  score: 91, stopps_gesamt: 5, stopps_abgeschlossen: 4, zone: 'A', laufzeit_min: 38, sla_ok: true,  health: 'gut' },
    { batch_id: 'b2', fahrer_name: 'Lukas M.',  score: 75, stopps_gesamt: 4, stopps_abgeschlossen: 2, zone: 'B', laufzeit_min: 52, sla_ok: true,  health: 'ok' },
    { batch_id: 'b3', fahrer_name: 'Sara P.',   score: 58, stopps_gesamt: 6, stopps_abgeschlossen: 3, zone: 'C', laufzeit_min: 61, sla_ok: false, health: 'risiko' },
    { batch_id: 'b4', fahrer_name: 'Kemal D.',  score: 42, stopps_gesamt: 3, stopps_abgeschlossen: 0, zone: 'A', laufzeit_min: 72, sla_ok: false, health: 'kritisch' },
    { batch_id: 'b5', fahrer_name: 'Felix W.',  score: 88, stopps_gesamt: 4, stopps_abgeschlossen: 4, zone: 'D', laufzeit_min: 29, sla_ok: true,  health: 'gut' },
  ],
};

const HEALTH: Record<TourHealth, { bg: string; text: string; badge: string; label: string; bar: string }> = {
  gut:      { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-300', badge: 'bg-emerald-100 text-emerald-700', label: 'Gut',      bar: 'bg-emerald-500' },
  ok:       { bg: 'bg-blue-50 dark:bg-blue-900/20',       text: 'text-blue-700 dark:text-blue-300',       badge: 'bg-blue-100 text-blue-700',       label: 'OK',       bar: 'bg-blue-400' },
  risiko:   { bg: 'bg-amber-50 dark:bg-amber-900/20',     text: 'text-amber-700 dark:text-amber-300',     badge: 'bg-amber-100 text-amber-700',     label: 'Risiko',   bar: 'bg-amber-500' },
  kritisch: { bg: 'bg-red-50 dark:bg-red-900/20',         text: 'text-red-700 dark:text-red-300',         badge: 'bg-red-100 text-red-700',         label: 'Kritisch', bar: 'bg-red-500' },
};

function scoreTrend(score: number): 'up' | 'down' | 'neutral' {
  if (score >= 80) return 'up';
  if (score < 55)  return 'down';
  return 'neutral';
}

export function DispatchPhase1124TourScoreVisualisierungPro({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(true);
  const [sortBy, setSortBy] = useState<'score' | 'laufzeit'>('score');

  const load = useCallback(() => {
    if (!locationId) { setData(MOCK); return; }
    setLoading(true);
    fetch(`/api/delivery/admin/tour-completion?location_id=${locationId}`, { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d && d.touren ? d : MOCK))
      .catch(() => setData(MOCK))
      .finally(() => setLoading(false));
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 90_000); return () => clearInterval(iv); }, [load]);

  const rows = data?.touren
    ? [...data.touren].sort((a, b) =>
        sortBy === 'score' ? b.score - a.score : b.laufzeit_min - a.laufzeit_min
      )
    : [];

  const kritisch = rows.filter(r => r.health === 'kritisch').length;

  return (
    <div className="rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-stone-50 dark:hover:bg-stone-800/50 transition"
      >
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-stone-600 dark:text-stone-300" />
          <span className="font-bold text-sm">Tour-Score-Visualisierung</span>
          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wide">Phase 1124</span>
          {kritisch > 0 && (
            <span className="animate-pulse rounded-full bg-red-500 text-white text-[9px] font-black px-2 py-0.5">
              {kritisch} Kritisch
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-muted-foreground">
          {data && (
            <span className="text-xs font-bold">
              Ø Score: <span className={cn(
                'font-black',
                data.avg_score >= 80 ? 'text-emerald-600' : data.avg_score >= 60 ? 'text-amber-600' : 'text-red-600'
              )}>{data.avg_score}</span>
            </span>
          )}
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-stone-200 dark:border-stone-700">
          {/* Sort tabs */}
          <div className="flex gap-1 px-4 pt-3 pb-2">
            {(['score', 'laufzeit'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={cn(
                  'px-3 py-1 text-[10px] font-bold rounded-full transition',
                  sortBy === s
                    ? 'bg-stone-800 text-white dark:bg-stone-200 dark:text-stone-900'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200 dark:bg-stone-800 dark:text-stone-300'
                )}
              >
                {s === 'score' ? 'Nach Score' : 'Nach Laufzeit'}
              </button>
            ))}
          </div>

          <div className="divide-y divide-stone-100 dark:divide-stone-800">
            {rows.map(row => {
              const hs = HEALTH[row.health];
              const trend = scoreTrend(row.score);
              const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
              const progressPct = row.stopps_gesamt > 0
                ? Math.round((row.stopps_abgeschlossen / row.stopps_gesamt) * 100)
                : 0;

              return (
                <div key={row.batch_id} className={cn('px-4 py-3 flex items-center gap-3', hs.bg)}>
                  {/* Score circle */}
                  <div className={cn('shrink-0 h-12 w-12 rounded-full flex items-center justify-center font-black text-lg border-2', hs.text,
                    row.health === 'gut' ? 'border-emerald-300' :
                    row.health === 'ok'  ? 'border-blue-300' :
                    row.health === 'risiko' ? 'border-amber-300' : 'border-red-300 animate-pulse'
                  )}>
                    {row.score}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold truncate">{row.fahrer_name}</span>
                      {row.zone && (
                        <span className="text-[9px] font-bold rounded-full bg-white/70 dark:bg-white/10 border px-1.5 py-0.5">
                          Zone {row.zone}
                        </span>
                      )}
                      <span className={cn('text-[9px] font-black rounded-full px-1.5 py-0.5', hs.badge)}>
                        {hs.label}
                      </span>
                      <TrendIcon className={cn('h-3 w-3 shrink-0',
                        trend === 'up' ? 'text-emerald-500' : trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
                      )} />
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', hs.bar)}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold tabular-nums text-muted-foreground shrink-0">
                        {row.stopps_abgeschlossen}/{row.stopps_gesamt} Stopps
                      </span>
                    </div>
                  </div>

                  {/* Right: Laufzeit + SLA */}
                  <div className="shrink-0 text-right flex flex-col items-end gap-0.5">
                    <span className="font-mono text-sm font-black tabular-nums">{row.laufzeit_min}m</span>
                    <span className={cn('text-[9px] font-bold', row.sla_ok ? 'text-emerald-600' : 'text-red-600')}>
                      {row.sla_ok ? '✓ SLA' : '✗ SLA'}
                    </span>
                  </div>
                </div>
              );
            })}

            {rows.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                Keine aktiven Touren.
              </div>
            )}
          </div>

          {/* Footer KPI strip */}
          {rows.length > 0 && (
            <div className="px-4 py-2.5 bg-stone-50 dark:bg-stone-800/50 border-t border-stone-100 dark:border-stone-700 flex flex-wrap gap-4 text-[10px]">
              {(['gut', 'ok', 'risiko', 'kritisch'] as TourHealth[]).map(h => {
                const count = rows.filter(r => r.health === h).length;
                if (!count) return null;
                const hs = HEALTH[h];
                return (
                  <span key={h} className={cn('font-bold rounded-full px-2 py-0.5', hs.badge)}>
                    {count}× {hs.label}
                  </span>
                );
              })}
              <span className="ml-auto text-muted-foreground">
                SLA-Quote: {Math.round((rows.filter(r => r.sla_ok).length / rows.length) * 100)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
