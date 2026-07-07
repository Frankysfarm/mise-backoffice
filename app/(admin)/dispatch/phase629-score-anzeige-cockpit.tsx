'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Trophy, TrendingUp, TrendingDown, Minus, Star } from 'lucide-react';

interface Props {
  locationId: string | null;
}

interface DriverScore {
  driverId: string;
  name: string;
  score: number;
  trend: number;
  lieferungen: number;
  pünktlichkeit: number;
}

const MOCK_SCORES: DriverScore[] = [
  { driverId: '1', name: 'Max M.', score: 94, trend: 2, lieferungen: 18, pünktlichkeit: 96 },
  { driverId: '2', name: 'Anna K.', score: 89, trend: -1, lieferungen: 14, pünktlichkeit: 88 },
  { driverId: '3', name: 'Tobias H.', score: 82, trend: 0, lieferungen: 11, pünktlichkeit: 81 },
  { driverId: '4', name: 'Lisa B.', score: 77, trend: 3, lieferungen: 9, pünktlichkeit: 79 },
];

function scoreColor(score: number): string {
  if (score >= 90) return 'text-matcha-600 dark:text-matcha-400';
  if (score >= 75) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

function scoreBg(score: number): string {
  if (score >= 90) return 'bg-matcha-100 dark:bg-matcha-900/40';
  if (score >= 75) return 'bg-amber-100 dark:bg-amber-900/40';
  return 'bg-red-100 dark:bg-red-900/40';
}

function TrendIcon({ trend }: { trend: number }) {
  if (trend > 0) return <TrendingUp className="h-3.5 w-3.5 text-matcha-500" />;
  if (trend < 0) return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-gray-400" />;
}

export function DispatchPhase629ScoreAnzeigeCockpit({ locationId }: Props) {
  const [scores] = useState<DriverScore[]>(MOCK_SCORES);

  if (!locationId) return null;

  const top = scores[0];

  return (
    <div className="mb-4 rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/20 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
        <span className="text-sm font-bold uppercase tracking-wide text-yellow-800 dark:text-yellow-200">
          Fahrer-Score Cockpit
        </span>
        {top && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-yellow-100 dark:bg-yellow-900/40 px-2 py-0.5 text-xs font-bold text-yellow-700 dark:text-yellow-300">
            <Star className="h-3 w-3" fill="currentColor" />
            {top.name} · {top.score}
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {scores.map((d, i) => (
          <div
            key={d.driverId}
            className="flex items-center gap-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 px-3 py-2.5"
          >
            <span className="w-5 shrink-0 text-center text-xs font-black text-gray-400 dark:text-gray-500">
              {i + 1}
            </span>
            <span className="flex-1 text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">
              {d.name}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <TrendIcon trend={d.trend} />
              <span className="text-[10px] text-gray-400 dark:text-gray-500 tabular-nums">
                {d.lieferungen} Ldg.
              </span>
              <span className={`rounded-full px-2.5 py-1 text-sm font-black tabular-nums ${scoreColor(d.score)} ${scoreBg(d.score)}`}>
                {d.score}
              </span>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-2 text-center text-[10px] text-yellow-600 dark:text-yellow-500">
        Heute · Schicht-Score · Live
      </p>
    </div>
  );
}
