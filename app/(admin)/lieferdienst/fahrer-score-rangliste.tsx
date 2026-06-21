'use client';

/**
 * LieferdienstFahrerScoreRangliste — Phase 357
 *
 * Top-5 Fahrer-Score-Rangliste (wöchentlicher Composite Score).
 * Kompaktes Leaderboard für den Lieferdienst-Überblick.
 * Pollt alle 10 Minuten.
 */

import { useEffect, useState, useCallback } from 'react';
import { Trophy, Star } from 'lucide-react';

interface ScoreEntry {
  scoreRank: number;
  driverName: string | null;
  initials: string;
  compositeScore: number;
  grade: string;
}

function gradeBadge(grade: string): string {
  switch (grade) {
    case 'A+': return 'bg-matcha-100 text-matcha-700';
    case 'A':  return 'bg-matcha-50 text-matcha-600';
    case 'B':  return 'bg-blue-50 text-blue-600';
    case 'C':  return 'bg-amber-50 text-amber-600';
    default:   return 'bg-red-50 text-red-600';
  }
}

function rankBadge(rank: number): string {
  if (rank === 1) return 'bg-yellow-100 text-yellow-700';
  if (rank === 2) return 'bg-gray-100 text-gray-600';
  if (rank === 3) return 'bg-orange-100 text-orange-600';
  return 'bg-gray-50 text-gray-500';
}

export function LieferdienstFahrerScoreRangliste({ locationId }: { locationId?: string | null }) {
  const [entries, setEntries] = useState<ScoreEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const url = locationId
        ? `/api/delivery/admin/driver-score?period=week&limit=5&location_id=${locationId}`
        : '/api/delivery/admin/driver-score?period=week&limit=5';
      const res = await fetch(url, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json() as { entries?: ScoreEntry[] };
      setEntries(json.entries ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 10 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetchData]);

  if (loading || entries.length === 0) return null;

  return (
    <div className="w-full rounded-xl border border-gray-100 bg-white shadow-sm px-4 py-3">
      <div className="flex items-center gap-1.5 mb-3">
        <Trophy className="w-3.5 h-3.5 text-amber-500" />
        <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wider">
          Fahrer-Rangliste (Woche)
        </span>
      </div>

      <div className="space-y-1.5">
        {entries.map((e) => (
          <div key={e.scoreRank} className="flex items-center gap-2 py-0.5">
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${rankBadge(e.scoreRank)}`}>
              {e.scoreRank}
            </span>

            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 ${gradeBadge(e.grade)}`}>
              {e.initials.slice(0, 2)}
            </div>

            <span className="flex-1 text-[11px] font-medium text-gray-700 truncate">
              {e.driverName ?? 'Fahrer'}
            </span>

            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden shrink-0">
              <div
                className={`h-full rounded-full ${
                  e.compositeScore >= 85 ? 'bg-matcha-500' :
                  e.compositeScore >= 70 ? 'bg-amber-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, e.compositeScore)}%` }}
              />
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[11px] font-black tabular-nums text-gray-700">
                {Math.round(e.compositeScore)}
              </span>
              <span className={`text-[9px] font-bold px-1 rounded ${gradeBadge(e.grade)}`}>
                {e.grade}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 pt-2 border-t border-gray-50 flex items-center gap-1">
        <Star className="w-2.5 h-2.5 text-gray-300" />
        <span className="text-[9px] text-gray-400">Composite Score: Pünktlichkeit · Rating · Effizienz · Zuverlässigkeit</span>
      </div>
    </div>
  );
}

export default LieferdienstFahrerScoreRangliste;
