'use client';

import { useEffect, useState } from 'react';
import { Route, TrendingUp, TrendingDown, Minus, Clock, AlertTriangle, CheckCircle2, Star } from 'lucide-react';

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

const MOCK: ApiResponse = {
  touren: [
    { tourId: 't1', fahrerName: 'Kemal A.', zone: 'A', score: 91, scoreTrend: 'up', stopps: [{ nr: 1, erledigt: true }, { nr: 2, erledigt: true }, { nr: 3, erledigt: false }], etaMin: 6, status: 'on-time' },
    { tourId: 't2', fahrerName: 'Sara M.', zone: 'B', score: 64, scoreTrend: 'down', stopps: [{ nr: 1, erledigt: true }, { nr: 2, erledigt: false }, { nr: 3, erledigt: false }], etaMin: 24, status: 'late' },
    { tourId: 't3', fahrerName: 'Jonas R.', zone: 'C', score: 78, scoreTrend: 'neutral', stopps: [{ nr: 1, erledigt: true }, { nr: 2, erledigt: false }], etaMin: 11, status: 'tight' },
    { tourId: 't4', fahrerName: 'Lena W.', zone: 'A', score: 85, scoreTrend: 'up', stopps: [{ nr: 1, erledigt: false }, { nr: 2, erledigt: false }], etaMin: 3, status: 'on-time' },
  ],
};

function ScoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
}

function ScoreBarColor(score: number): string {
  if (score >= 80) return 'bg-green-500';
  if (score >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
}

function StatusBadge({ status }: { status: TourRow['status'] }) {
  if (status === 'on-time') return <span className="text-[10px] text-green-400 bg-green-900/30 px-1.5 py-0.5 rounded-full">Pünktlich</span>;
  if (status === 'tight') return <span className="text-[10px] text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded-full">Knapp</span>;
  return <span className="text-[10px] text-red-400 bg-red-900/30 px-1.5 py-0.5 rounded-full flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" />Verspätet</span>;
}

function TrendIcon({ trend }: { trend: TourRow['scoreTrend'] }) {
  if (trend === 'up') return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (trend === 'down') return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

export function DispatchPhase5292TourScoreVisualisierungV27({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const params = locationId ? `?location_id=${locationId}` : '';
    const res = await fetch(`/api/delivery/admin/dispatch-score-tour-cockpit${params}`).catch(() => null);
    if (res?.ok) setData(await res.json());
    else setData(MOCK);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 20 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data?.touren?.length) return null;

  const avgScore = Math.round(data.touren.reduce((s, t) => s + t.score, 0) / data.touren.length);
  const lateCount = data.touren.filter(t => t.status === 'late').length;
  const onTimeCount = data.touren.filter(t => t.status === 'on-time').length;

  return (
    <div className="rounded-xl border border-indigo-800/60 bg-indigo-950/30 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Route className="w-4 h-4 text-indigo-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Tour-Score & Visualisierung V27</span>
        <div className="ml-auto flex items-center gap-1">
          <Star className="w-3 h-3 text-yellow-400" />
          <span className={`text-sm font-black tabular-nums ${ScoreColor(avgScore)}`}>{avgScore}</span>
          <span className="text-[10px] text-gray-500">Ø Score</span>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="rounded-lg bg-gray-800/60 px-2 py-2 text-center">
          <div className="text-[10px] text-gray-500">Touren</div>
          <div className="text-base font-black text-indigo-300">{data.touren.length}</div>
        </div>
        <div className="rounded-lg bg-green-900/30 px-2 py-2 text-center">
          <div className="text-[10px] text-gray-500">Pünktlich</div>
          <div className="text-base font-black text-green-400">{onTimeCount}</div>
        </div>
        <div className="rounded-lg bg-red-900/30 px-2 py-2 text-center">
          <div className="text-[10px] text-gray-500">Verspätet</div>
          <div className="text-base font-black text-red-400">{lateCount}</div>
        </div>
        <div className="rounded-lg bg-gray-800/60 px-2 py-2 text-center">
          <div className="text-[10px] text-gray-500">Ø Score</div>
          <div className={`text-base font-black tabular-nums ${ScoreColor(avgScore)}`}>{avgScore}</div>
        </div>
      </div>

      <div className="space-y-2.5">
        {data.touren.map(tour => {
          const done = tour.stopps.filter(s => s.erledigt).length;
          const total = tour.stopps.length;
          const prog = total > 0 ? (done / total) * 100 : 0;

          return (
            <div key={tour.tourId} className="rounded-lg bg-gray-800/40 border border-gray-700/50 px-3 py-2">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-gray-200 truncate">{tour.fahrerName}</span>
                  {tour.zone && (
                    <span className="text-[10px] text-indigo-300 bg-indigo-900/40 px-1.5 py-0.5 rounded font-mono">Zone {tour.zone}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <StatusBadge status={tour.status} />
                  {tour.etaMin != null && (
                    <span className="flex items-center gap-0.5 text-[10px] text-gray-400">
                      <Clock className="w-2.5 h-2.5" />{tour.etaMin} Min
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${ScoreBarColor(tour.score)}`}
                      style={{ width: `${tour.score}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[9px] text-gray-600 mt-0.5">
                    <span>Score</span>
                    <span className={ScoreColor(tour.score)}>{tour.score}</span>
                  </div>
                </div>
                <TrendIcon trend={tour.scoreTrend} />
              </div>

              <div className="flex items-center gap-1 mt-1.5">
                {tour.stopps.map(s => (
                  <span key={s.nr} className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold ${
                    s.erledigt ? 'bg-green-700 text-green-100' : 'bg-gray-700 text-gray-400'
                  }`}>
                    {s.erledigt ? <CheckCircle2 className="w-3 h-3" /> : s.nr}
                  </span>
                ))}
                <span className="text-[9px] text-gray-500 ml-1">{done}/{total} Stopps</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
