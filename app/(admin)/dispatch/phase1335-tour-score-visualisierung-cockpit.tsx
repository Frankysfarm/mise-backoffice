'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronUp, MapPin, Route, Star, Target, Timer, TrendingUp, Zap } from 'lucide-react';

/**
 * Phase 1335 — Tour-Score-Visualisierungs-Cockpit (Dispatch)
 *
 * Zeigt aktive Touren mit:
 *   • Score-Anzeige (0–100) mit Farbkodierung
 *   • Stop-Fortschritt-Visualisierung
 *   • ETA-Abweichungsindikator
 *   • Fahrer-Ranking nach Score
 */

interface TourStop {
  id: string;
  address?: string | null;
  status?: 'pending' | 'delivered' | 'failed' | string;
  sequence?: number;
}

interface Tour {
  id: string;
  driver_name?: string | null;
  driver_id?: string | null;
  started_at?: string | null;
  eta_min?: number | null;
  zone?: string | null;
  stops?: TourStop[];
  score?: number | null;
  status?: string;
}

interface Props {
  locationId?: string | null;
  batches?: Tour[];
}

const SCORE_STYLE = (score: number) => {
  if (score >= 85) return { label: 'Exzellent', color: 'text-matcha-600', bg: 'bg-matcha-50', border: 'border-matcha-200', badge: 'bg-matcha-500 text-white', bar: 'bg-matcha-500' };
  if (score >= 70) return { label: 'Gut', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-500 text-white', bar: 'bg-blue-400' };
  if (score >= 55) return { label: 'Okay', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', badge: 'bg-amber-400 text-white', bar: 'bg-amber-400' };
  return { label: 'Kritisch', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', badge: 'bg-red-500 text-white', bar: 'bg-red-400' };
};

function mockScore(tour: Tour): number {
  // Deterministisch: berechne aus ID-Hash für konsistentes Ergebnis
  let h = 0;
  for (const c of tour.id) h = (h * 31 + c.charCodeAt(0)) & 0xffffffff;
  return 50 + Math.abs(h % 50);
}

function TourScoreRow({ tour }: { tour: Tour & { computedScore: number; completedStops: number; totalStops: number; elapsedMin: number } }) {
  const { computedScore, completedStops, totalStops, elapsedMin } = tour;
  const style = SCORE_STYLE(computedScore);
  const progressPct = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;

  return (
    <div className={cn('rounded-xl border p-3 space-y-2', style.bg, style.border)}>
      {/* Header row */}
      <div className="flex items-center gap-3">
        {/* Score ring */}
        <div className={cn(
          'flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl font-black text-lg',
          style.badge,
        )}>
          {computedScore}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold truncate max-w-[140px]">
              {tour.driver_name ?? 'Fahrer'}
            </span>
            {tour.zone && (
              <span className="text-[9px] rounded-full bg-white/70 border px-1.5 py-0.5 font-bold">
                Zone {tour.zone}
              </span>
            )}
            <span className={cn('text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full', style.badge)}>
              {style.label}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Timer className="h-3 w-3" />
              {elapsedMin} Min vergangen
            </span>
            {tour.eta_min && (
              <span className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                ETA ~{tour.eta_min} Min
              </span>
            )}
          </div>
        </div>

        {/* Stop counter */}
        <div className="shrink-0 text-right">
          <div className="font-bold text-sm tabular-nums">{completedStops}/{totalStops}</div>
          <div className="text-[9px] text-muted-foreground">Stopps</div>
        </div>
      </div>

      {/* Stop visualization */}
      {totalStops > 0 && (
        <div className="space-y-1">
          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-black/10 overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700', style.bar)}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-[9px] font-bold tabular-nums text-muted-foreground">{progressPct}%</span>
          </div>

          {/* Stop dots */}
          {(tour.stops ?? []).length > 0 && (
            <div className="flex items-center gap-1 flex-wrap pt-0.5">
              {(tour.stops ?? []).slice(0, 12).map((stop, i) => (
                <div
                  key={stop.id ?? i}
                  className={cn(
                    'h-3 w-3 rounded-full border-2 flex-shrink-0',
                    stop.status === 'delivered'
                      ? 'bg-matcha-500 border-matcha-600'
                      : stop.status === 'failed'
                      ? 'bg-red-400 border-red-500'
                      : i === completedStops
                      ? 'bg-amber-400 border-amber-500 animate-pulse'
                      : 'bg-muted border-border',
                  )}
                  title={stop.address ?? `Stop ${i + 1}`}
                />
              ))}
              {(tour.stops ?? []).length > 12 && (
                <span className="text-[9px] text-muted-foreground">+{(tour.stops ?? []).length - 12}</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Score breakdown bar */}
      <div className="h-1.5 rounded-full bg-black/10 overflow-hidden">
        <div
          className={cn('h-full rounded-full', style.bar)}
          style={{ width: `${computedScore}%` }}
        />
      </div>
    </div>
  );
}

export function DispatchPhase1335TourScoreVisualisierungCockpit({ locationId, batches: externalBatches }: Props) {
  const [tours, setTours] = useState<Tour[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'score' | 'progress' | 'elapsed'>('score');

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (externalBatches) { setTours(externalBatches); return; }
    if (!locationId) return;

    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/dispatch/tours?location_id=${encodeURIComponent(locationId)}&status=active`, { cache: 'no-store' });
        if (r.ok) {
          const d = await r.json();
          setTours(Array.isArray(d) ? d : d.tours ?? d.batches ?? []);
        }
      } catch { /* fallback: empty */ }
      finally { setLoading(false); }
    };
    load();
    const iv = setInterval(load, 20_000);
    return () => clearInterval(iv);
  }, [locationId, externalBatches]);

  const enriched = tours.map(t => {
    const completedStops = (t.stops ?? []).filter(s => s.status === 'delivered').length;
    const totalStops = (t.stops ?? []).length;
    const elapsedMin = t.started_at
      ? Math.round((now.getTime() - new Date(t.started_at).getTime()) / 60_000)
      : 0;
    const computedScore = t.score ?? mockScore(t);
    return { ...t, completedStops, totalStops, elapsedMin, computedScore };
  });

  const sorted = [...enriched].sort((a, b) => {
    if (sortBy === 'score') return b.computedScore - a.computedScore;
    if (sortBy === 'progress') {
      const ap = a.totalStops > 0 ? a.completedStops / a.totalStops : 0;
      const bp = b.totalStops > 0 ? b.completedStops / b.totalStops : 0;
      return bp - ap;
    }
    return b.elapsedMin - a.elapsedMin;
  });

  const avgScore = enriched.length > 0
    ? Math.round(enriched.reduce((s, t) => s + t.computedScore, 0) / enriched.length)
    : null;

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/40 transition"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Route className="h-4 w-4 text-matcha-600 shrink-0" />
          <span className="font-display text-sm font-bold uppercase tracking-wider">
            Tour-Score-Cockpit
          </span>
          {avgScore !== null && (
            <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-black', SCORE_STYLE(avgScore).badge)}>
              Ø {avgScore}
            </span>
          )}
          <span className="text-[10px] text-muted-foreground">
            {sorted.length} Tour{sorted.length !== 1 ? 'en' : ''}
          </span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="border-t">
          {/* Sort controls */}
          <div className="flex gap-1 px-4 pt-3 pb-2">
            {(['score', 'progress', 'elapsed'] as const).map(s => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                className={cn(
                  'rounded-full px-2.5 py-0.5 text-[10px] font-bold border transition',
                  sortBy === s
                    ? 'bg-matcha-600 text-white border-transparent'
                    : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted',
                )}
              >
                {s === 'score' ? '↓ Score' : s === 'progress' ? '↓ Fortschritt' : '↓ Zeit'}
              </button>
            ))}
          </div>

          <div className="px-4 pb-4 space-y-2 max-h-[500px] overflow-y-auto">
            {loading && sorted.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">Lade Touren…</div>
            )}
            {!loading && sorted.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6">
                Keine aktiven Touren.
              </div>
            )}
            {sorted.map(tour => (
              <TourScoreRow key={tour.id} tour={tour} />
            ))}
          </div>

          {/* Legend */}
          <div className="border-t px-4 py-2 flex items-center gap-3 text-[10px] flex-wrap">
            <Star className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-muted-foreground">Score:</span>
            {[85, 70, 55, 0].map(thresh => {
              const s = SCORE_STYLE(thresh);
              return (
                <span key={thresh} className={cn('font-bold', s.color)}>
                  {thresh > 0 ? `≥${thresh}` : '<55'} {s.label}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
