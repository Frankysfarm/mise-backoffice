'use client';

/**
 * Phase 2635 — Tour-Score Visualisierung Kompakt
 *
 * Kompaktes Cockpit mit Score-Ring je Fahrer + farbkodierte Stop-Dots
 * + Fortschrittsbalken + ETA-Badge + Alert bei Score < 60.
 * 25-Sek-Polling.
 */

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Route, AlertTriangle, TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';

interface TourStop {
  nr: number;
  erledigt: boolean;
}

interface TourRow {
  tourId: string;
  fahrerName: string;
  zone: string | null;
  score: number;
  scoreTrend: 'up' | 'down' | 'neutral';
  stopps: TourStop[];
  etaMin: number | null;
  status: 'on-time' | 'tight' | 'late';
}

interface ApiResponse {
  touren: TourRow[];
}

function scoreColor(s: number): string {
  if (s >= 80) return 'text-matcha-700';
  if (s >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function scoreBg(s: number): string {
  if (s >= 80) return 'bg-matcha-50 border-matcha-200';
  if (s >= 60) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

function statusBadge(s: TourRow['status']): string {
  if (s === 'on-time') return 'bg-matcha-100 text-matcha-700';
  if (s === 'tight')   return 'bg-amber-100 text-amber-700';
  return 'bg-red-100 text-red-700';
}

function statusLabel(s: TourRow['status']): string {
  if (s === 'on-time') return 'Pünktlich';
  if (s === 'tight')   return 'Knapp';
  return 'Verspätet';
}

function TrendIcon({ trend }: { trend: TourRow['scoreTrend'] }) {
  if (trend === 'up')   return <TrendingUp className="h-3 w-3 text-matcha-500" />;
  if (trend === 'down') return <TrendingDown className="h-3 w-3 text-red-500" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

function ScoreRing({ score }: { score: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <svg width="52" height="52" className="shrink-0">
      <circle cx="26" cy="26" r={r} fill="none" stroke="currentColor" strokeWidth="4"
        className="text-muted/30" />
      <circle
        cx="26" cy="26" r={r} fill="none" strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 26 26)"
        className={score >= 80 ? 'stroke-matcha-500' : score >= 60 ? 'stroke-amber-500' : 'stroke-red-500'}
      />
      <text x="26" y="30" textAnchor="middle"
        className={cn('text-[10px] font-black', scoreColor(score))}
        style={{ fontSize: 10, fontWeight: 900, fill: 'currentColor' }}>
        {score}
      </text>
    </svg>
  );
}

export function DispatchPhase2635TourScoreVisualisierungKompakt({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchData() {
    if (!locationId) return;
    setLoading(prev => data === null ? true : prev);
    try {
      const r = await fetch(
        `/api/delivery/admin/dispatch-score-tour-cockpit?location_id=${locationId}`
      );
      if (r.ok) setData(await r.json());
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => {
    fetchData();
    pollRef.current = setInterval(fetchData, 25_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!locationId) return null;

  const touren = data?.touren ?? [];
  const hasAlert = touren.some(t => t.score < 60 || t.status === 'late');

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b bg-card">
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-matcha-600" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Tour-Score Cockpit
          </span>
          {touren.length > 0 && (
            <span className="rounded-full bg-matcha-100 px-2 py-0.5 text-[10px] font-bold text-matcha-700">
              {touren.length} Tour{touren.length !== 1 ? 'en' : ''}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasAlert && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
              <AlertTriangle className="h-3 w-3" />
              Score-Alert
            </span>
          )}
          {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
      </div>

      {touren.length === 0 && !loading && (
        <div className="px-5 py-6 text-center text-sm text-muted-foreground">
          Keine aktiven Touren
        </div>
      )}

      <div className="divide-y">
        {touren.map((tour) => {
          const erledigte = tour.stopps.filter(s => s.erledigt).length;
          const pct = tour.stopps.length > 0 ? (erledigte / tour.stopps.length) * 100 : 0;

          return (
            <div
              key={tour.tourId}
              className={cn('flex items-center gap-4 px-4 py-3 border-l-4 transition-colors', scoreBg(tour.score))}
            >
              <ScoreRing score={tour.score} />

              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-sm truncate">{tour.fahrerName}</span>
                  <TrendIcon trend={tour.scoreTrend} />
                  {tour.zone && (
                    <span className="rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase">
                      Zone {tour.zone}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {tour.stopps.map((s) => (
                    <span
                      key={s.nr}
                      className={cn(
                        'inline-flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-black border',
                        s.erledigt
                          ? 'bg-matcha-500 text-white border-matcha-600'
                          : 'bg-white text-muted-foreground border-border'
                      )}
                    >
                      {s.nr}
                    </span>
                  ))}
                </div>

                <div className="h-1.5 rounded-full bg-white/60 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      tour.score >= 80 ? 'bg-matcha-500' :
                      tour.score >= 60 ? 'bg-amber-500' : 'bg-red-500'
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-end gap-1">
                {tour.etaMin !== null && (
                  <span className="font-mono text-lg font-black tabular-nums leading-none">
                    {tour.etaMin}
                    <span className="text-[9px] font-normal text-muted-foreground ml-0.5">Min</span>
                  </span>
                )}
                <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold', statusBadge(tour.status))}>
                  {statusLabel(tour.status)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
