'use client';

import { useEffect, useState } from 'react';
import { Award, Bike, CheckCircle2, Clock, Loader2, MapPin, TrendingUp, Trophy, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Phase 1407 — Tour Score + Visualisierung Ultimate (Dispatch)
 *
 * Kombiniertes Score- und Tour-Visualisierungs-Dashboard:
 *   • Aktive Touren mit Composite-Score (ETA-Genauigkeit + Pünktlichkeit + Effizienz)
 *   • Fahrer-Rangliste nach Score
 *   • Tour-Fortschritts-Visualisierung mit Stop-Indikatoren
 *   • Ampel: grün/gelb/rot je Performance
 *
 * API: GET /api/delivery/dispatch?location_id=... (Mock-Fallback falls nicht verfügbar)
 * 30-Sek-Polling.
 */

interface TourStop {
  id: string;
  status: 'pending' | 'delivered' | 'failed' | 'active';
  address?: string | null;
  eta_min?: number | null;
}

interface ActiveTour {
  batchId: string;
  driverId: string;
  driverName: string;
  stops: TourStop[];
  scoreTotal: number;          // 0–100
  scoreEta: number;
  scorePunctuality: number;
  scoreEfficiency: number;
  elapsedMin: number;
  estimatedTotalMin: number;
  zone?: string | null;
}

const MOCK_TOURS: ActiveTour[] = [
  {
    batchId: 'mock-1',
    driverId: 'd1',
    driverName: 'Ahmet K.',
    stops: [
      { id: 's1', status: 'delivered' },
      { id: 's2', status: 'active' },
      { id: 's3', status: 'pending' },
    ],
    scoreTotal: 87,
    scoreEta: 90,
    scorePunctuality: 85,
    scoreEfficiency: 88,
    elapsedMin: 22,
    estimatedTotalMin: 45,
    zone: 'Mitte',
  },
  {
    batchId: 'mock-2',
    driverId: 'd2',
    driverName: 'Mert S.',
    stops: [
      { id: 's4', status: 'delivered' },
      { id: 's5', status: 'delivered' },
      { id: 's6', status: 'active' },
    ],
    scoreTotal: 72,
    scoreEta: 68,
    scorePunctuality: 74,
    scoreEfficiency: 76,
    elapsedMin: 38,
    estimatedTotalMin: 50,
    zone: 'Süd',
  },
  {
    batchId: 'mock-3',
    driverId: 'd3',
    driverName: 'Lukas P.',
    stops: [
      { id: 's7', status: 'active' },
      { id: 's8', status: 'pending' },
    ],
    scoreTotal: 94,
    scoreEta: 96,
    scorePunctuality: 93,
    scoreEfficiency: 93,
    elapsedMin: 10,
    estimatedTotalMin: 35,
    zone: 'Nord',
  },
];

function scoreColor(score: number): string {
  if (score >= 85) return 'text-matcha-700';
  if (score >= 70) return 'text-amber-700';
  return 'text-red-600';
}

function scoreRingColor(score: number): string {
  if (score >= 85) return 'stroke-matcha-500';
  if (score >= 70) return 'stroke-amber-400';
  return 'stroke-red-500';
}

function ScoreRing({ score }: { score: number }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <svg width="44" height="44" viewBox="0 0 44 44" className="shrink-0">
      <circle cx="22" cy="22" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-stone-200" />
      <circle
        cx="22" cy="22" r={r} fill="none" strokeWidth="4"
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
        className={scoreRingColor(score)}
      />
      <text x="22" y="26" textAnchor="middle" className="text-[11px] font-black fill-current" style={{ fontSize: 11, fontWeight: 900 }}>
        {score}
      </text>
    </svg>
  );
}

export function DispatchPhase1680TourScoreVisualisierungUltimate({
  drivers,
  batches,
  orders,
  locationId,
}: {
  drivers?: unknown[];
  batches?: unknown[];
  orders?: unknown[];
  locationId?: string | null;
}) {
  const [tours, setTours] = useState<ActiveTour[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const qs = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/dispatch${qs}`, { cache: 'no-store' });
        if (!res.ok) throw new Error('no data');
        const data = await res.json();
        if (cancelled) return;
        const activeBatches: ActiveTour[] = (data.batches ?? [])
          .filter((b: Record<string, unknown>) => b.status === 'active' || b.status === 'in_transit')
          .map((b: Record<string, unknown>) => ({
            batchId: b.id as string,
            driverId: b.driver_id as string,
            driverName: ((b.driver as Record<string, unknown>)?.name ?? 'Fahrer') as string,
            stops: (b.stops as TourStop[] ?? []),
            scoreTotal: (b.score_total as number) ?? 80,
            scoreEta: (b.score_eta as number) ?? 80,
            scorePunctuality: (b.score_punctuality as number) ?? 80,
            scoreEfficiency: (b.score_efficiency as number) ?? 80,
            elapsedMin: (b.elapsed_min as number) ?? 0,
            estimatedTotalMin: (b.estimated_total_min as number) ?? 40,
            zone: b.zone as string | null,
          }));
        setTours(activeBatches.length > 0 ? activeBatches : MOCK_TOURS);
      } catch {
        if (!cancelled) setTours(MOCK_TOURS);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    const iv = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-xl border bg-white text-sm text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>Tour-Scores laden…</span>
      </div>
    );
  }

  if (tours.length === 0) return null;

  const sorted = [...tours].sort((a, b) => b.scoreTotal - a.scoreTotal);

  return (
    <div className="rounded-2xl border bg-white shadow-sm overflow-hidden mb-3">
      {/* Header */}
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 bg-stone-50 border-b text-left"
      >
        <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
        <span className="text-xs font-black uppercase tracking-wider flex-1">
          Tour Score · Visualisierung · {tours.length} aktiv
        </span>
        <span className="text-[10px] text-muted-foreground">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="divide-y">
          {sorted.map((tour, idx) => {
            const progress = tour.estimatedTotalMin > 0
              ? Math.min(100, (tour.elapsedMin / tour.estimatedTotalMin) * 100)
              : 0;
            const completedStops = tour.stops.filter(s => s.status === 'delivered').length;
            const totalStops = tour.stops.length;

            return (
              <div key={tour.batchId} className="px-4 py-3">
                <div className="flex items-center gap-3">
                  {/* Rank */}
                  <div className="w-5 text-center text-[10px] font-black text-muted-foreground shrink-0">
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </div>

                  {/* Score ring */}
                  <ScoreRing score={tour.scoreTotal} />

                  {/* Driver + zone */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold truncate">{tour.driverName}</span>
                      {tour.zone && (
                        <span className="text-[9px] bg-stone-100 border rounded-full px-1.5 py-0.5 font-bold">
                          Zone {tour.zone}
                        </span>
                      )}
                    </div>

                    {/* Stop indicators */}
                    <div className="flex items-center gap-1 mb-1.5">
                      {tour.stops.map(s => (
                        <div
                          key={s.id}
                          className={cn(
                            'h-2 w-2 rounded-full transition-colors',
                            s.status === 'delivered' ? 'bg-matcha-500' :
                            s.status === 'active'    ? 'bg-amber-400 animate-pulse' :
                            s.status === 'failed'    ? 'bg-red-500' :
                            'bg-stone-300',
                          )}
                        />
                      ))}
                      <span className="text-[9px] text-muted-foreground ml-1 tabular-nums">
                        {completedStops}/{totalStops} Stopps
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-1.5 rounded-full bg-stone-100 overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all duration-700',
                          tour.scoreTotal >= 85 ? 'bg-matcha-500' :
                          tour.scoreTotal >= 70 ? 'bg-amber-400' :
                          'bg-red-400',
                        )}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Elapsed */}
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-xs font-bold tabular-nums text-foreground">
                      {tour.elapsedMin}m
                    </div>
                    <div className="text-[8px] text-muted-foreground">/{tour.estimatedTotalMin}m</div>
                  </div>
                </div>

                {/* Sub-scores */}
                <div className="mt-2 grid grid-cols-3 gap-1.5 pl-8">
                  {[
                    { label: 'ETA', value: tour.scoreEta },
                    { label: 'Pünktl.', value: tour.scorePunctuality },
                    { label: 'Effiz.', value: tour.scoreEfficiency },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-center">
                      <div className={cn('text-[11px] font-black tabular-nums', scoreColor(value))}>
                        {value}
                      </div>
                      <div className="text-[8px] text-muted-foreground">{label}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="px-4 py-2 bg-stone-50 border-t text-[9px] text-muted-foreground flex items-center gap-2">
        <TrendingUp className="h-2.5 w-2.5" />
        Score 0–100 · grün ≥85 · gelb ≥70 · rot &lt;70 · 30-Sek-Polling
        {locationId && <span className="ml-auto">Mock-Daten als Fallback</span>}
      </div>
    </div>
  );
}
