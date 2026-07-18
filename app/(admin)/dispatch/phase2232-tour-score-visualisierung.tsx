'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Trophy, TrendingUp, TrendingDown, Minus, Route } from 'lucide-react';

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

interface ApiData {
  touren: TourRow[];
}

function scoreColor(score: number) {
  if (score >= 80) return { ring: '#22c55e', text: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' };
  if (score >= 60) return { ring: '#f59e0b', text: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800' };
  return { ring: '#ef4444', text: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' };
}

function statusLabel(status: TourRow['status']) {
  if (status === 'on-time') return { label: 'Pünktlich', cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' };
  if (status === 'tight') return { label: 'Knapp', cls: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' };
  return { label: 'Verspätet', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' };
}

function ScoreRing({ score }: { score: number }) {
  const { ring } = scoreColor(score);
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;

  return (
    <svg width="50" height="50" className="shrink-0">
      <circle cx="25" cy="25" r={r} fill="none" stroke="currentColor" strokeWidth="3.5"
        className="text-gray-200 dark:text-gray-700" />
      <circle cx="25" cy="25" r={r} fill="none" stroke={ring} strokeWidth="3.5"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform="rotate(-90 25 25)" />
      <text x="25" y="25" textAnchor="middle" dominantBaseline="central"
        fontSize="11" fontWeight="bold" fill={ring}>{score}</text>
    </svg>
  );
}

function StoppDots({ stopps }: { stopps: TourStop[] }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {stopps.map((s) => (
        <div
          key={s.nr}
          className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${
            s.erledigt
              ? 'bg-green-500 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
          }`}
        >
          {s.nr}
        </div>
      ))}
    </div>
  );
}

export function DispatchPhase2232TourScoreVisualisierung({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    try {
      const url = locationId
        ? `/api/delivery/admin/dispatch-score-tour-cockpit?location_id=${locationId}`
        : '/api/delivery/admin/dispatch-score-tour-cockpit';
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!data || data.touren.length === 0) return null;

  const avgScore = Math.round(data.touren.reduce((s, t) => s + t.score, 0) / data.touren.length);
  const best = [...data.touren].sort((a, b) => b.score - a.score)[0];
  const lateCount = data.touren.filter((t) => t.status === 'late').length;

  return (
    <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/20 p-4 mb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span className="font-semibold text-purple-900 dark:text-purple-200">Tour-Score-Visualisierung</span>
          {lateCount > 0 && (
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full">
              {lateCount} verspätet
            </span>
          )}
        </div>
        {open
          ? <ChevronUp className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          : <ChevronDown className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-white dark:bg-gray-800 px-3 py-2 text-sm">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-purple-500" />
              <span className="text-gray-600 dark:text-gray-400">Touren-Ø Score</span>
            </div>
            <span className={`font-bold text-base ${scoreColor(avgScore).text}`}>{avgScore} / 100</span>
          </div>

          {data.touren.map((tour) => {
            const { text, bg } = scoreColor(tour.score);
            const { label, cls } = statusLabel(tour.status);
            const erledigtCount = tour.stopps.filter((s) => s.erledigt).length;

            return (
              <div key={tour.tourId} className={`rounded-xl border px-3 py-3 ${bg}`}>
                <div className="flex items-center gap-3">
                  <ScoreRing score={tour.score} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold dark:text-white">{tour.fahrerName}</span>
                      {tour.zone && (
                        <span className="text-xs bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 px-1.5 py-0.5 rounded-full font-medium">
                          Zone {tour.zone}
                        </span>
                      )}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${cls}`}>
                        {label}
                      </span>
                      {best?.tourId === tour.tourId && (
                        <span className="text-xs bg-yellow-400 text-yellow-900 px-1.5 py-0.5 rounded-full font-bold">
                          ★ Best
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5">
                      <StoppDots stopps={tour.stopps} />
                      <span className="text-xs text-gray-500 dark:text-gray-400 shrink-0">
                        {erledigtCount}/{tour.stopps.length} Stopps
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-bold flex items-center gap-1 ${text}`}>
                      {tour.scoreTrend === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
                      {tour.scoreTrend === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
                      {tour.scoreTrend === 'neutral' && <Minus className="w-3.5 h-3.5" />}
                      {tour.score}
                    </div>
                    {tour.etaMin !== null && (
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
                        ETA {tour.etaMin} Min
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          <p className="text-xs text-purple-600 dark:text-purple-400 text-center pt-1">
            Score ≥80 Grün · ≥60 Gelb · &lt;60 Rot · alle 2 Min. aktualisiert
          </p>
        </div>
      )}
    </div>
  );
}
