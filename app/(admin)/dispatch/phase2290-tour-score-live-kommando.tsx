'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Gauge, Route, Star, TrendingDown, TrendingUp, Trophy, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ── Typen ─────────────────────────────────────────────────────────────── */
type TourScore = {
  fahrer_id: string;
  fahrer_name: string;
  tour_id: string;
  score: number;           // 0–100
  stopps_gesamt: number;
  stopps_erledigt: number;
  avg_eta_pct: number;     // 100 = perfekt pünktlich
  distanz_km: number;
  trend: 'steigend' | 'fallend' | 'stabil';
};

type ApiData = {
  touren: TourScore[];
  team_score: number;
  top_fahrer: string | null;
  alert_count: number;
};

/* ── Hilfsfunktionen ────────────────────────────────────────────────────── */
type ScoreLevel = 'exzellent' | 'gut' | 'mittel' | 'schlecht';

function scoreLevel(score: number): ScoreLevel {
  if (score >= 90) return 'exzellent';
  if (score >= 75) return 'gut';
  if (score >= 55) return 'mittel';
  return 'schlecht';
}

const LEVEL_STYLE: Record<ScoreLevel, { ring: string; text: string; bg: string; badge: string }> = {
  exzellent: { ring: 'bg-matcha-500',  text: 'text-matcha-700 dark:text-matcha-300',   bg: 'bg-matcha-50 dark:bg-matcha-950/20',   badge: 'bg-matcha-100 dark:bg-matcha-900/40 text-matcha-700 dark:text-matcha-300' },
  gut:       { ring: 'bg-blue-500',    text: 'text-blue-700 dark:text-blue-300',        bg: 'bg-blue-50 dark:bg-blue-950/20',        badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
  mittel:    { ring: 'bg-amber-400',   text: 'text-amber-700 dark:text-amber-300',      bg: 'bg-amber-50 dark:bg-amber-950/20',      badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' },
  schlecht:  { ring: 'bg-red-500',     text: 'text-red-700 dark:text-red-300',          bg: 'bg-red-50 dark:bg-red-950/20',          badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' },
};

/* ── Score-Ring ─────────────────────────────────────────────────────────── */
function ScoreRing({ score }: { score: number }) {
  const level = scoreLevel(score);
  const s = LEVEL_STYLE[level];
  const circumference = 2 * Math.PI * 16;
  const dashOffset = circumference * (1 - score / 100);

  return (
    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="16" fill="none" stroke="currentColor" strokeWidth="4" className="text-muted/20" />
        <circle
          cx="20" cy="20" r="16" fill="none"
          stroke="currentColor" strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          className={cn('transition-all duration-700', s.text)}
        />
      </svg>
      <span className={cn('text-[11px] font-black tabular-nums', s.text)}>{score}</span>
    </div>
  );
}

/* ── Tour-Zeile ─────────────────────────────────────────────────────────── */
function TourRow({ tour }: { tour: TourScore }) {
  const level = scoreLevel(tour.score);
  const s = LEVEL_STYLE[level];
  const fortschritt = tour.stopps_gesamt > 0
    ? Math.round((tour.stopps_erledigt / tour.stopps_gesamt) * 100)
    : 0;

  return (
    <div className={cn('rounded-xl border p-3 space-y-2', s.bg,
      level === 'schlecht' ? 'border-red-200 dark:border-red-800' :
      level === 'mittel'   ? 'border-amber-200 dark:border-amber-800' :
      level === 'gut'      ? 'border-blue-200 dark:border-blue-800' :
      'border-matcha-200 dark:border-matcha-800'
    )}>
      <div className="flex items-center gap-3">
        <ScoreRing score={tour.score} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs font-bold truncate">{tour.fahrer_name}</p>
            <span className={cn('rounded px-1.5 py-0.5 text-[8px] font-bold', s.badge)}>
              Score {tour.score}
            </span>
            {tour.trend === 'steigend' && <TrendingUp className="h-3 w-3 text-matcha-500" />}
            {tour.trend === 'fallend' && <TrendingDown className="h-3 w-3 text-red-500" />}
          </div>
          <div className="flex items-center gap-3 text-[10px] text-muted-foreground mt-0.5">
            <span>{tour.stopps_erledigt}/{tour.stopps_gesamt} Stopps</span>
            <span>{tour.distanz_km.toFixed(1)} km</span>
            <span>ETA {tour.avg_eta_pct.toFixed(0)}%</span>
          </div>
        </div>
      </div>
      {/* Fortschrittsbalken */}
      <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', s.ring)}
          style={{ width: `${fortschritt}%` }}
        />
      </div>
    </div>
  );
}

/* ── Mock-Daten ─────────────────────────────────────────────────────────── */
function getMockData(): ApiData {
  return {
    touren: [
      { fahrer_id: '1', fahrer_name: 'Max Mustermann', tour_id: 't1', score: 92, stopps_gesamt: 5, stopps_erledigt: 3, avg_eta_pct: 97, distanz_km: 8.4, trend: 'steigend' },
      { fahrer_id: '2', fahrer_name: 'Anna Schmidt',   tour_id: 't2', score: 74, stopps_gesamt: 4, stopps_erledigt: 2, avg_eta_pct: 88, distanz_km: 6.1, trend: 'stabil' },
      { fahrer_id: '3', fahrer_name: 'Kai Fischer',    tour_id: 't3', score: 51, stopps_gesamt: 6, stopps_erledigt: 1, avg_eta_pct: 71, distanz_km: 11.2, trend: 'fallend' },
    ],
    team_score: 72,
    top_fahrer: 'Max Mustermann',
    alert_count: 1,
  };
}

/* ── Team-Score-Balken ──────────────────────────────────────────────────── */
function TeamScoreBar({ score }: { score: number }) {
  const level = scoreLevel(score);
  const s = LEVEL_STYLE[level];
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">Team-Score</span>
        <span className={cn('font-black', s.text)}>{score}/100</span>
      </div>
      <div className="h-3 rounded-full bg-muted/30 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-700', s.ring)}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

/* ── Haupt-Komponente ───────────────────────────────────────────────────── */
export function DispatchPhase2290TourScoreLiveKommando({
  locationId,
}: {
  locationId?: string | null;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/driver-score?location_id=${locationId}&active=true`);
      if (res.ok) {
        setData(await res.json());
      } else {
        setData(getMockData());
      }
    } catch {
      setData(getMockData());
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const sorted = useMemo(
    () => data ? [...data.touren].sort((a, b) => b.score - a.score) : [],
    [data],
  );

  if (!locationId) return null;

  const teamLevel = data ? scoreLevel(data.team_score) : 'mittel';
  const ts = LEVEL_STYLE[teamLevel];

  return (
    <div className="rounded-xl border bg-card p-4 mb-3 space-y-3">
      {/* Header */}
      <button
        className="flex w-full items-center justify-between gap-2"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', ts.bg)}>
            <Gauge className={cn('h-4 w-4', ts.text)} />
          </span>
          <div className="text-left">
            <p className="text-sm font-bold leading-tight">Tour-Score Live</p>
            <p className="text-[10px] text-muted-foreground">Score-Anzeige · Tour-Visualisierung</p>
          </div>
          {data && (
            <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-bold ml-1', ts.badge)}>
              Team {data.team_score}
            </span>
          )}
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      {open && (
        <>
          {/* Team-Score */}
          {data && <TeamScoreBar score={data.team_score} />}

          {/* Top-Fahrer */}
          {data?.top_fahrer && (
            <div className="flex items-center gap-2 rounded-lg bg-matcha-50 dark:bg-matcha-950/20 border border-matcha-200 dark:border-matcha-800 px-3 py-2 text-xs">
              <Trophy className="h-3.5 w-3.5 text-matcha-500 shrink-0" />
              <span className="font-bold text-matcha-700 dark:text-matcha-300">
                Bester: {data.top_fahrer}
              </span>
              <Star className="h-3 w-3 text-amber-400 ml-auto" />
            </div>
          )}

          {/* Tour-Liste */}
          {sorted.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Route className="h-3 w-3" /> Aktive Touren ({sorted.length})
              </p>
              {sorted.map(tour => (
                <TourRow key={tour.tour_id} tour={tour} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-muted/20 py-4 text-center text-xs text-muted-foreground">
              <Zap className="mx-auto mb-1 h-5 w-5 text-muted-foreground/50" />
              Keine aktiven Touren
            </div>
          )}

          {/* Empfehlung */}
          {data && (
            <p className={cn('rounded-lg px-3 py-2 text-[10px]', ts.bg,
              teamLevel === 'exzellent' ? 'text-matcha-700 dark:text-matcha-300' :
              teamLevel === 'gut'       ? 'text-blue-700 dark:text-blue-300' :
              teamLevel === 'mittel'    ? 'text-amber-700 dark:text-amber-300' :
              'text-red-700 dark:text-red-300'
            )}>
              {teamLevel === 'exzellent'
                ? 'Hervorragend! Team-Score über 90 — optimale Touren-Effizienz.'
                : teamLevel === 'gut'
                ? 'Guter Score. Fokus auf die schwächeren Touren legen.'
                : teamLevel === 'mittel'
                ? 'Optimierungsbedarf: Routenführung und ETA-Genauigkeit verbessern.'
                : `Kritisch: ${data.alert_count} Tour(en) mit schlechtem Score — sofort eingreifen!`}
            </p>
          )}
        </>
      )}
    </div>
  );
}
