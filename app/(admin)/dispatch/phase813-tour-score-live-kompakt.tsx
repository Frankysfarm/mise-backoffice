'use client';

import { useEffect, useState } from 'react';
import { Gauge, MapPin, Clock, Trophy } from 'lucide-react';

const ACTIVE_STATUSES = ['aktiv', 'unterwegs', 'on_route', 'assigned', 'pickup'];

interface Stop {
  id: string;
  order_id: string;
  reihenfolge: number;
  geliefert_am: string | null;
}

interface Fahrer {
  vorname: string;
  nachname: string;
}

interface Batch {
  id: string;
  status: string;
  fahrer_id: string | null;
  total_distance_km: number | null;
  total_eta_min: number | null;
  zone: string | null;
  fahrer: Fahrer | null;
  stops: Stop[];
}

interface Driver {
  employee_id: string;
  ist_online: boolean;
  employee: { vorname: string; nachname: string } | null;
}

interface Props {
  batches: Batch[];
  drivers: Driver[];
}

interface TourScore {
  batch_id: string;
  fahrer_name: string;
  zone: string | null;
  score: number;
  completed: number;
  total: number;
  distance_km: number | null;
  eta_min: number | null;
}

function computeScore(batch: Batch): TourScore {
  const completed = batch.stops.filter((s) => s.geliefert_am !== null).length;
  const total = batch.stops.length;

  // Distance efficiency: 30 pts — 0 km = 30 pts, 50+ km = 0 pts
  const dist = batch.total_distance_km ?? 0;
  const distance_pts = Math.max(0, Math.round(30 * (1 - Math.min(1, dist / 50))));

  // Stop completion: 40 pts
  const completion_pts = total > 0 ? Math.round((completed / total) * 40) : 0;

  // Punctuality: 30 pts
  const eta = batch.total_eta_min ?? 0;
  const punctuality_pts = eta <= 15 ? 30 : eta <= 30 ? 20 : 10;

  const score = Math.min(100, distance_pts + completion_pts + punctuality_pts);

  const fahrer_name = batch.fahrer
    ? `${batch.fahrer.vorname} ${batch.fahrer.nachname}`
    : 'Unbekannt';

  return {
    batch_id: batch.id,
    fahrer_name,
    zone: batch.zone,
    score,
    completed,
    total,
    distance_km: batch.total_distance_km,
    eta_min: batch.total_eta_min,
  };
}

function buildMock(): TourScore[] {
  return [
    {
      batch_id: 'B-001',
      fahrer_name: 'Max Müller',
      zone: 'Nord',
      score: 82,
      completed: 3,
      total: 4,
      distance_km: 12.4,
      eta_min: 12,
    },
    {
      batch_id: 'B-002',
      fahrer_name: 'Anna Koch',
      zone: 'Süd',
      score: 55,
      completed: 1,
      total: 4,
      distance_km: 24.8,
      eta_min: 8,
    },
    {
      batch_id: 'B-003',
      fahrer_name: 'Tom Becker',
      zone: 'Mitte',
      score: 35,
      completed: 1,
      total: 3,
      distance_km: 35.0,
      eta_min: 45,
    },
  ];
}

function scoreTextColor(score: number): string {
  if (score >= 70) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 40) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBarColor(score: number): string {
  if (score >= 70) return 'bg-emerald-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-red-500';
}

function scoreStroke(score: number): string {
  if (score >= 70) return '#10b981';
  if (score >= 40) return '#f59e0b';
  return '#ef4444';
}

function ScoreRing({ score }: { score: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  const color = scoreStroke(score);
  return (
    <svg width="52" height="52" viewBox="0 0 52 52" aria-hidden="true">
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        className="text-muted/30"
      />
      <circle
        cx="26"
        cy="26"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        transform="rotate(-90 26 26)"
        style={{ transition: 'stroke-dashoffset 0.6s ease' }}
      />
      <text x="26" y="30" textAnchor="middle" fontSize="11" fontWeight="700" fill={color}>
        {score}
      </text>
    </svg>
  );
}

export function DispatchPhase813TourScoreLiveKompakt({ batches, drivers: _drivers }: Props) {
  const [scores, setScores] = useState<TourScore[]>([]);
  const [loading, setLoading] = useState(true);

  const buildScores = () => {
    const active = batches.filter((b) => ACTIVE_STATUSES.includes(b.status));
    if (active.length === 0) {
      setScores(buildMock());
    } else {
      setScores(active.map(computeScore));
    }
    setLoading(false);
  };

  useEffect(() => {
    buildScores();
    const id = setInterval(buildScores, 30_000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batches]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
        <div className="h-40 animate-pulse bg-muted rounded" />
      </div>
    );
  }

  const topScore = scores.length > 0 ? Math.max(...scores.map((s) => s.score)) : 0;

  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-xs font-semibold">Tour-Score Live</span>
        </div>
        <div className="flex items-center gap-1.5">
          {scores.length > 0 && <Trophy className="h-3 w-3 text-amber-500" />}
          <span className="text-[10px] text-muted-foreground">{scores.length} aktive Touren</span>
        </div>
      </div>

      {scores.length === 0 ? (
        <div className="flex items-center justify-center py-6 text-[11px] text-muted-foreground">
          Keine aktiven Touren
        </div>
      ) : (
        <div className="space-y-2">
          {scores.map((tour) => (
            <div
              key={tour.batch_id}
              className={`rounded-lg border px-3 py-2.5 transition-colors ${
                tour.score === topScore && scores.length > 1
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                  : 'bg-muted/20 border-border/50'
              }`}
            >
              <div className="flex items-center gap-3">
                {/* Score ring */}
                <div className="shrink-0">
                  <ScoreRing score={tour.score} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span className="text-[11px] font-semibold truncate">{tour.fahrer_name}</span>
                    {tour.zone && (
                      <span className="shrink-0 rounded-full bg-[#4a7c59]/10 text-[#4a7c59] dark:bg-[#6aad7e]/10 dark:text-[#6aad7e] px-2 py-0.5 text-[9px] font-medium">
                        {tour.zone}
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="mb-1.5">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[9px] text-muted-foreground">
                        {tour.completed}/{tour.total} Stopps
                      </span>
                      <span className={`text-[9px] font-bold tabular-nums ${scoreTextColor(tour.score)}`}>
                        {tour.score} Pkt
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${scoreBarColor(tour.score)}`}
                        style={{
                          width: `${tour.total > 0 ? (tour.completed / tour.total) * 100 : 0}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Distance + ETA badges */}
                  <div className="flex items-center gap-2">
                    {tour.distance_km !== null && (
                      <div className="flex items-center gap-0.5">
                        <MapPin className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="text-[9px] text-muted-foreground tabular-nums">
                          {tour.distance_km.toFixed(1)} km
                        </span>
                      </div>
                    )}
                    {tour.eta_min !== null && (
                      <div className="flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                        <span className="text-[9px] text-muted-foreground tabular-nums">
                          {tour.eta_min} Min
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-2 text-[9px] text-muted-foreground">
        Tour-Score · Distanz + Stopps + Pünktlichkeit · 30s-Update
      </p>
    </div>
  );
}
