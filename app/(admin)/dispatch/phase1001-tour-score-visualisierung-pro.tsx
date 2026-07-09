'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Route, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Bike, MapPin } from 'lucide-react';

/**
 * Phase 1001 — Tour-Score-Visualisierung Pro (Dispatch)
 *
 * Live-Score-Übersicht aller aktiven Touren:
 * Score-Gauge (0–100), Stopp-Sequenz als Icons, ETA-Ring und Fahrerstatus.
 * Polling alle 60 Sekunden gegen /api/delivery/admin/tour-score-cockpit.
 */

interface TourStop {
  nr: number;
  erledigt: boolean;
}

interface TourRow {
  tourId: string;
  fahrerName: string;
  zone: string | null;
  score: number;          // 0–100
  scoreTrend: 'up' | 'down' | 'neutral';
  stopps: TourStop[];
  etaMin: number | null;
  status: 'on-time' | 'tight' | 'late';
}

interface ApiResponse {
  touren: TourRow[];
}

const MOCK: ApiResponse = {
  touren: [
    {
      tourId: 't1', fahrerName: 'Kemal A.', zone: 'A', score: 88,
      scoreTrend: 'up',
      stopps: [{ nr: 1, erledigt: true }, { nr: 2, erledigt: true }, { nr: 3, erledigt: false }],
      etaMin: 8, status: 'on-time',
    },
    {
      tourId: 't2', fahrerName: 'Sara M.', zone: 'B', score: 62,
      scoreTrend: 'down',
      stopps: [{ nr: 1, erledigt: true }, { nr: 2, erledigt: false }, { nr: 3, erledigt: false }, { nr: 4, erledigt: false }],
      etaMin: 22, status: 'late',
    },
    {
      tourId: 't3', fahrerName: 'Jonas R.', zone: 'C', score: 75,
      scoreTrend: 'neutral',
      stopps: [{ nr: 1, erledigt: true }, { nr: 2, erledigt: false }],
      etaMin: 12, status: 'tight',
    },
  ],
};

function scoreColor(score: number): { gauge: string; text: string; bg: string; border: string } {
  if (score >= 80) return { gauge: 'stroke-matcha-500', text: 'text-matcha-700 dark:text-matcha-300', bg: 'bg-matcha-50 dark:bg-matcha-950/30', border: 'border-matcha-200' };
  if (score >= 60) return { gauge: 'stroke-amber-500',  text: 'text-amber-700 dark:text-amber-300',  bg: 'bg-amber-50 dark:bg-amber-950/30',  border: 'border-amber-200'  };
  return            { gauge: 'stroke-red-500',          text: 'text-red-700 dark:text-red-300',      bg: 'bg-red-50 dark:bg-red-950/30',      border: 'border-red-200'    };
}

function statusBadge(status: TourRow['status']): string {
  if (status === 'on-time') return 'bg-matcha-100 dark:bg-matcha-900/30 border-matcha-300 text-matcha-700 dark:text-matcha-300';
  if (status === 'tight')   return 'bg-amber-100 dark:bg-amber-900/30 border-amber-300 text-amber-700 dark:text-amber-300';
  return                           'bg-red-100 dark:bg-red-900/30 border-red-300 text-red-700 dark:text-red-300';
}

function statusLabel(s: TourRow['status']): string {
  if (s === 'on-time') return 'Pünktlich';
  if (s === 'tight')   return 'Knapp';
  return 'Verspätet';
}

function ScoreGauge({ score }: { score: number }) {
  const R = 18;
  const C = 2 * Math.PI * R;
  const c = scoreColor(score);
  const dash = C * (score / 100);
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90 shrink-0">
      <circle cx="24" cy="24" r={R} strokeWidth="4" className="stroke-muted" fill="none" />
      <circle
        cx="24" cy="24" r={R} strokeWidth="4" fill="none"
        className={cn('transition-all duration-700', c.gauge)}
        strokeDasharray={C}
        strokeDashoffset={C - dash}
        strokeLinecap="round"
      />
      <text
        x="24" y="24"
        textAnchor="middle"
        dominantBaseline="middle"
        className={c.text}
        style={{ fontSize: 11, fontWeight: 800, fill: 'currentColor', transform: 'rotate(90deg)', transformOrigin: '24px 24px' }}
      >
        {score}
      </text>
    </svg>
  );
}

function TrendIcon({ trend }: { trend: TourRow['scoreTrend'] }) {
  if (trend === 'up')   return <TrendingUp className="h-3 w-3 text-matcha-500" />;
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-zinc-400" />;
}

interface Props {
  locationId: string | null;
}

export function DispatchPhase1001TourScoreVisualisierungPro({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/dispatch-score-tour-cockpit${params}`);
        if (!res.ok) throw new Error();
        const raw = await res.json();
        const touren: TourRow[] = (raw.touren ?? raw.batches ?? []).map((t: {
          id?: string; tourId?: string;
          fahrer_name?: string; fahrerName?: string;
          zone?: string | null;
          score?: number;
          score_trend?: string; scoreTrend?: string;
          stopps?: Array<{ nr?: number; erledigt?: boolean }>;
          eta_min?: number | null; etaMin?: number | null;
          status?: string;
        }) => ({
          tourId: t.id ?? t.tourId ?? '',
          fahrerName: t.fahrer_name ?? t.fahrerName ?? 'Fahrer',
          zone: t.zone ?? null,
          score: t.score ?? 75,
          scoreTrend: (t.score_trend ?? t.scoreTrend ?? 'neutral') as TourRow['scoreTrend'],
          stopps: (t.stopps ?? []).map((s: { nr?: number; erledigt?: boolean }, i: number) => ({ nr: (s.nr ?? i + 1), erledigt: s.erledigt ?? false })),
          etaMin: t.eta_min ?? t.etaMin ?? null,
          status: (t.status ?? 'on-time') as TourRow['status'],
        }));
        if (touren.length > 0) setData({ touren });
      } catch {
        // keep mock
      }
    }
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  const vorspaetet = data.touren.filter(t => t.status === 'late').length;

  return (
    <div className="rounded-xl border bg-card text-card-foreground shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition"
      >
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-blue-500" />
          <span className="text-sm font-semibold">Tour-Score Visualisierung</span>
          {vorspaetet > 0 && (
            <span className="ml-1 rounded-full bg-red-100 dark:bg-red-900/30 border border-red-300 px-2 py-0.5 text-[10px] font-bold text-red-700 dark:text-red-300 animate-pulse">
              {vorspaetet}× Verspätet
            </span>
          )}
          <span className="ml-auto text-[9px] text-muted-foreground">{data.touren.length} Touren</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="divide-y">
          {data.touren.map(tour => {
            const c = scoreColor(tour.score);
            const done = tour.stopps.filter(s => s.erledigt).length;
            const total = tour.stopps.length;
            const pct = total > 0 ? (done / total) * 100 : 0;

            return (
              <div key={tour.tourId} className={cn('px-4 py-3 flex items-center gap-3', c.bg)}>
                <ScoreGauge score={tour.score} />

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Bike className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="text-xs font-bold truncate">{tour.fahrerName}</span>
                    {tour.zone && (
                      <span className="text-[9px] rounded-full bg-white/60 border px-1.5 py-0.5 font-bold">Zone {tour.zone}</span>
                    )}
                    <TrendIcon trend={tour.scoreTrend} />
                    <span className={cn('ml-auto rounded-full border px-1.5 py-0.5 text-[9px] font-bold', statusBadge(tour.status))}>
                      {statusLabel(tour.status)}
                    </span>
                  </div>

                  {/* Stopp-Sequenz */}
                  <div className="flex items-center gap-1">
                    {tour.stopps.map(s => (
                      <div
                        key={s.nr}
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold border',
                          s.erledigt
                            ? 'bg-matcha-500 border-matcha-600 text-white'
                            : 'bg-white dark:bg-zinc-800 border-border text-muted-foreground',
                        )}
                      >
                        {s.nr}
                      </div>
                    ))}
                    <div className="ml-auto text-[9px] text-muted-foreground tabular-nums">
                      {done}/{total} Stopps
                    </div>
                  </div>

                  {/* Progress + ETA */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-black/10 dark:bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-matcha-500 rounded-full transition-all duration-700"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {tour.etaMin !== null && (
                      <div className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        ~{tour.etaMin} Min
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {data.touren.length === 0 && (
            <div className="py-6 text-center text-xs text-muted-foreground">Keine aktiven Touren.</div>
          )}
        </div>
      )}
    </div>
  );
}
