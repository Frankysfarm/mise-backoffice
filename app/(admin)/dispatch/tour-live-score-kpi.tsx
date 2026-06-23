'use client';

import { useState, useEffect } from 'react';
import { Target, Clock, Bike, TrendingUp, Zap, CheckCircle2 } from 'lucide-react';

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

type TourScore = {
  tour_id: string;
  driver_name: string;
  zone: string | null;
  score: number;
  time_factor: number;
  completion_pct: number;
  efficiency: number;
  elapsed_min: number;
  total_stops: number;
  completed_stops: number;
};

interface Props {
  tours?: TourScore[];
}

const MOCK_TOURS: TourScore[] = [
  { tour_id: 'T1', driver_name: 'Klaus Heinz', zone: 'Nord', score: 87, time_factor: 92, completion_pct: 80, efficiency: 88, elapsed_min: 42, total_stops: 5, completed_stops: 4 },
  { tour_id: 'T2', driver_name: 'Maria Braun', zone: 'Mitte', score: 61, time_factor: 58, completion_pct: 67, efficiency: 60, elapsed_min: 35, total_stops: 3, completed_stops: 2 },
  { tour_id: 'T3', driver_name: 'Jan Richter', zone: 'Süd', score: 44, time_factor: 40, completion_pct: 50, efficiency: 45, elapsed_min: 68, total_stops: 4, completed_stops: 2 },
  { tour_id: 'T4', driver_name: 'Sara König', zone: null, score: 95, time_factor: 98, completion_pct: 100, efficiency: 91, elapsed_min: 28, total_stops: 3, completed_stops: 3 },
];

function getScoreColor(score: number): { ring: string; text: string; bg: string } {
  if (score >= 80) return { ring: '#22c55e', text: 'text-green-600', bg: 'bg-green-50' };
  if (score >= 55) return { ring: '#f59e0b', text: 'text-amber-600', bg: 'bg-amber-50' };
  return { ring: '#ef4444', text: 'text-red-600', bg: 'bg-red-50' };
}

function ScoreRing({ score }: { score: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const fill = (score / 100) * circ;
  const { ring, text } = getScoreColor(score);

  return (
    <div className="relative w-14 h-14 flex items-center justify-center shrink-0">
      <svg width="56" height="56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#e5e7eb" strokeWidth="5" />
        <circle
          cx="28" cy="28" r={r} fill="none"
          stroke={ring} strokeWidth="5"
          strokeDasharray={`${fill} ${circ}`}
          strokeLinecap="round"
        />
      </svg>
      <span className={cn('absolute text-xs font-bold', text)}>{score}</span>
    </div>
  );
}

function formatElapsed(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function DispatchTourLiveScoreKpi({ tours }: Props) {
  const data = tours && tours.length > 0 ? tours : MOCK_TOURS;
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="p-3">
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-5 h-5 text-blue-500" />
        <h2 className="font-bold text-gray-800 text-sm">Tour Live-Score</h2>
        <span className="ml-auto text-xs text-gray-400">{data.length} Touren</span>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {data.map(tour => {
          const { bg, text } = getScoreColor(tour.score);

          return (
            <div key={tour.tour_id} className={cn('rounded-xl border border-gray-200 p-3 min-w-[200px] flex flex-col gap-2', bg)}>
              <div className="flex items-center gap-2">
                <ScoreRing score={tour.score} />
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 text-xs truncate">{tour.driver_name}</p>
                  {tour.zone && <p className="text-xs text-gray-500">{tour.zone}</p>}
                  <div className="flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3 text-gray-400" />
                    <span className="text-xs text-gray-500">{formatElapsed(tour.elapsed_min)}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1 text-center">
                <div className="bg-white/60 rounded p-1">
                  <div className={cn('text-xs font-bold', text)}>{tour.time_factor}</div>
                  <div className="text-xs text-gray-400 leading-tight">Zeit</div>
                </div>
                <div className="bg-white/60 rounded p-1">
                  <div className={cn('text-xs font-bold', text)}>{tour.completion_pct}%</div>
                  <div className="text-xs text-gray-400 leading-tight">Abschluss</div>
                </div>
                <div className="bg-white/60 rounded p-1">
                  <div className={cn('text-xs font-bold', text)}>{tour.efficiency}</div>
                  <div className="text-xs text-gray-400 leading-tight">Effizienz</div>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <div className="flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                  {tour.completed_stops}/{tour.total_stops} Stopps
                </div>
                <div className="flex items-center gap-1">
                  <Zap className="w-3 h-3 text-blue-400" />
                  <TrendingUp className="w-3 h-3 text-gray-400" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {data.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <Bike className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">Keine aktiven Touren</p>
        </div>
      )}
    </div>
  );
}
