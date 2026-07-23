'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, Star, Gauge, Route, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FahrerScore {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  rang: number;
  rang_delta: number;
  touren_heute: number;
  avg_lieferzeit_min: number | null;
  puenktlichkeit_pct: number | null;
  bewertung: number | null;
  aktiv: boolean;
}

interface ApiResponse {
  fahrer: FahrerScore[];
  team_avg_score: number;
  top_performer: string | null;
  alert_count: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: '1', fahrer_name: 'Leon S.', score: 94, rang: 1, rang_delta: 1, touren_heute: 7, avg_lieferzeit_min: 22, puenktlichkeit_pct: 96, bewertung: 4.9, aktiv: true },
    { fahrer_id: '2', fahrer_name: 'Kai M.', score: 88, rang: 2, rang_delta: 0, touren_heute: 6, avg_lieferzeit_min: 26, puenktlichkeit_pct: 89, bewertung: 4.7, aktiv: true },
    { fahrer_id: '3', fahrer_name: 'Ria W.', score: 81, rang: 3, rang_delta: -1, touren_heute: 5, avg_lieferzeit_min: 29, puenktlichkeit_pct: 82, bewertung: 4.6, aktiv: false },
    { fahrer_id: '4', fahrer_name: 'Tom B.', score: 73, rang: 4, rang_delta: 0, touren_heute: 4, avg_lieferzeit_min: 33, puenktlichkeit_pct: 74, bewertung: 4.4, aktiv: true },
  ],
  team_avg_score: 84,
  top_performer: 'Leon S.',
  alert_count: 0,
};

function scoreColor(s: number) {
  if (s >= 90) return { text: 'text-green-700', bar: 'bg-green-500', bg: 'bg-green-50' };
  if (s >= 75) return { text: 'text-amber-700', bar: 'bg-amber-400', bg: 'bg-amber-50' };
  return { text: 'text-red-700', bar: 'bg-red-500', bg: 'bg-red-50' };
}

export function DispatchPhase3552TourScoreVisualisierungLive({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);

  const fetchData = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/dispatch-score-tour-cockpit?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) {
        const d = await r.json();
        if (d?.fahrer?.length) setData(d);
      }
    } catch {}
  }, [locationId]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 60_000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const teamColor = scoreColor(data.team_avg_score);

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4" />
          <span className="text-sm font-bold uppercase tracking-wide">Tour-Score Live</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="bg-white/20 rounded px-2 py-0.5 font-bold">
            Team-Ø {data.team_avg_score}
          </span>
          {data.top_performer && (
            <span className="flex items-center gap-1 bg-yellow-400/30 rounded px-2 py-0.5">
              <Star className="w-3 h-3 text-yellow-300" /> {data.top_performer}
            </span>
          )}
        </div>
      </div>

      {/* Team Score Bar */}
      <div className="px-4 py-2 bg-gray-50 border-b">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wide w-20 shrink-0">Team-Ø Score</span>
          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', teamColor.bar)}
              style={{ width: `${data.team_avg_score}%` }}
            />
          </div>
          <span className={cn('text-sm font-black tabular-nums w-8 text-right', teamColor.text)}>
            {data.team_avg_score}
          </span>
        </div>
      </div>

      {/* Fahrer List */}
      <div className="divide-y">
        {data.fahrer.map(f => {
          const C = scoreColor(f.score);
          return (
            <div key={f.fahrer_id} className={cn('px-4 py-2.5', f.aktiv ? '' : 'opacity-50')}>
              <div className="flex items-center gap-2 mb-1">
                {/* Rang */}
                <span className="w-6 text-center text-xs font-black text-gray-400">#{f.rang}</span>

                {/* Delta */}
                <span className="w-3 text-center">
                  {f.rang_delta > 0 ? <TrendingUp className="w-3 h-3 text-green-500" /> :
                   f.rang_delta < 0 ? <TrendingDown className="w-3 h-3 text-red-500" /> :
                   <Minus className="w-3 h-3 text-gray-300" />}
                </span>

                {/* Name + Aktiv-Dot */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  {f.aktiv && <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />}
                  <span className="text-sm font-semibold truncate">{f.fahrer_name}</span>
                </div>

                {/* Score */}
                <div className={cn('text-base font-black tabular-nums', C.text)}>{f.score}</div>
              </div>

              {/* Score Bar */}
              <div className="pl-11">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                  <div
                    className={cn('h-full rounded-full transition-all', C.bar)}
                    style={{ width: `${f.score}%` }}
                  />
                </div>

                {/* KPI Mini-Row */}
                <div className="flex items-center gap-3 text-[10px] text-gray-500">
                  <span className="flex items-center gap-0.5">
                    <Route className="w-2.5 h-2.5" /> {f.touren_heute} Touren
                  </span>
                  {f.avg_lieferzeit_min && (
                    <span className="flex items-center gap-0.5">
                      <Clock className="w-2.5 h-2.5" /> Ø {f.avg_lieferzeit_min} Min
                    </span>
                  )}
                  {f.puenktlichkeit_pct && (
                    <span className="flex items-center gap-0.5">
                      <Gauge className="w-2.5 h-2.5" /> {f.puenktlichkeit_pct}% pünktl.
                    </span>
                  )}
                  {f.bewertung && (
                    <span className="flex items-center gap-0.5 text-yellow-600">
                      <Star className="w-2.5 h-2.5 fill-yellow-400 stroke-yellow-400" /> {f.bewertung.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t px-4 py-1.5 flex items-center gap-1 text-[10px] text-gray-400">
        <Gauge className="w-3 h-3" /> Update alle 60 Sek.
      </div>
    </div>
  );
}
