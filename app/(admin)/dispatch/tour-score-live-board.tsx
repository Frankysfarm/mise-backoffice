'use client';

import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, Clock } from 'lucide-react';

interface TourEntry {
  tour_id: string;
  driver_name: string;
  score: number;
  stops_done: number;
  stops_total: number;
  eta_min: number | null;
  on_time: boolean;
}

interface Props {
  locationId: string;
}

const MOCK_TOURS: TourEntry[] = [
  { tour_id: 'mock-1', driver_name: 'Max Müller', score: 88, stops_done: 4, stops_total: 6, eta_min: 12, on_time: true },
  { tour_id: 'mock-2', driver_name: 'Anna Schmidt', score: 72, stops_done: 2, stops_total: 5, eta_min: 25, on_time: false },
  { tour_id: 'mock-3', driver_name: 'Tom Wagner', score: 55, stops_done: 1, stops_total: 4, eta_min: null, on_time: false },
];

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-500';
}

function getScoreRingColor(score: number): string {
  if (score >= 80) return '#16a34a';
  if (score >= 60) return '#d97706';
  return '#ef4444';
}

function ScoreRing({ score }: { score: number }) {
  const radius = 18;
  const circ = 2 * Math.PI * radius;
  const filled = (score / 100) * circ;
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" className="flex-shrink-0">
      <circle cx="24" cy="24" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="4" />
      <circle
        cx="24"
        cy="24"
        r={radius}
        fill="none"
        stroke={getScoreRingColor(score)}
        strokeWidth="4"
        strokeDasharray={`${filled} ${circ - filled}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
      />
      <text
        x="24"
        y="28"
        textAnchor="middle"
        fontSize="12"
        fontWeight="700"
        fill={getScoreRingColor(score)}
      >
        {score}
      </text>
    </svg>
  );
}

export function DispatchTourScoreLiveBoard({ locationId }: Props) {
  const [tours, setTours] = useState<TourEntry[]>(MOCK_TOURS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchTours = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/delivery/admin/tour-score-live?location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('fetch failed');
      const data = await res.json();
      if (!data.tours || data.tours.length === 0) {
        setTours(MOCK_TOURS);
        setError(false);
      } else {
        const sorted = [...data.tours].sort((a: TourEntry, b: TourEntry) => b.score - a.score);
        setTours(sorted);
        setError(false);
      }
    } catch {
      setTours(MOCK_TOURS);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchTours();
    const interval = setInterval(fetchTours, 30_000);
    return () => clearInterval(interval);
  }, [fetchTours]);

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100 bg-stone-50">
        <Trophy className="w-4 h-4 text-amber-500" />
        <h2 className="text-sm font-semibold text-stone-700">Tour-Score Live</h2>
        {error && (
          <span className="ml-2 text-xs text-amber-500">(Demo-Daten)</span>
        )}
        <span className="ml-auto text-xs text-stone-400">{tours.length} aktive Touren</span>
      </div>

      {loading ? (
        <div className="p-6 text-center text-sm text-stone-400">Lade...</div>
      ) : tours.length === 0 ? (
        <div className="p-6 text-center text-sm text-stone-400">Keine aktiven Touren</div>
      ) : (
        <ul className="divide-y divide-stone-100">
          {tours.map((tour, i) => (
            <li key={tour.tour_id} className="flex items-center gap-3 px-4 py-3">
              {/* Rank */}
              <span className="w-6 text-xs font-bold text-stone-400 flex-shrink-0">
                #{i + 1}
              </span>

              {/* Score Ring */}
              <ScoreRing score={tour.score} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-stone-800 truncate">{tour.driver_name}</p>

                {/* Stop progress */}
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#5c7a4e] rounded-full transition-all"
                      style={{ width: `${(tour.stops_done / Math.max(tour.stops_total, 1)) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-stone-400 flex-shrink-0">
                    {tour.stops_done}/{tour.stops_total}
                  </span>
                </div>
              </div>

              {/* Right side: ETA + badge */}
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {/* On-time badge */}
                {tour.on_time ? (
                  <span className="inline-flex items-center gap-0.5 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    ✓ Pünktlich
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                    ⚠ Verspätet
                  </span>
                )}

                {/* ETA */}
                {tour.eta_min != null && (
                  <span className="flex items-center gap-1 text-xs text-stone-400">
                    <Clock className="w-3 h-3" />
                    {tour.eta_min} Min
                  </span>
                )}

                {/* Score label */}
                <span className={cn('text-sm font-bold', getScoreColor(tour.score))}>
                  {tour.score}/100
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
