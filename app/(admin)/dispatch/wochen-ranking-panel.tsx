'use client';

import { useEffect, useState } from 'react';
import { Trophy, Medal, RefreshCw, Gift, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type RankingEntry = {
  driverId: string;
  driverName: string | null;
  initials: string;
  rank: number;
  compositeScore: number;
  grade: string;
  toursCompleted: number;
  onTimeRate: number | null;
  avgRating: number | null;
  isTop3: boolean;
};

type RankingDashboard = {
  weekStart?: string;
  weekEnd?: string;
  totalDrivers?: number;
  avgScore?: number;
  pendingRewards?: number;
  pendingRewardsEur?: number;
  topDriver?: { name: string | null; score: number; grade: string } | null;
  rankings?: RankingEntry[];
};

const GRADE_COLOR: Record<string, string> = {
  'S+': 'bg-amber-400 text-white',
  S: 'bg-amber-400 text-white',
  A: 'bg-matcha-500 text-white',
  B: 'bg-blue-500 text-white',
  C: 'bg-stone-400 text-white',
  D: 'bg-red-400 text-white',
};

const RANK_ICON = ['🥇', '🥈', '🥉'];

function fmt(d: string | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

export function DispatchWochenRankingPanel({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<RankingDashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(loc: string | null) {
    if (!loc) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/delivery/admin/driver-ranking?action=dashboard${loc ? `&location_id=${encodeURIComponent(loc)}` : ''}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(locationId);
    const iv = setInterval(() => load(locationId), 5 * 60_000);
    return () => clearInterval(iv);
  }, [locationId]);

  if (!data && !loading && !error) return null;

  const entries = (data?.rankings ?? []).slice(0, 5);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-stone-100 bg-amber-50">
        <Trophy className="h-4 w-4 text-amber-600 shrink-0" />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">Wochen-Ranking</span>
          {data?.weekStart && (
            <span className="ml-2 text-[10px] text-stone-500">
              {fmt(data.weekStart)} – {fmt(data.weekEnd)}
            </span>
          )}
        </div>
        <button
          onClick={() => load(locationId)}
          disabled={loading}
          className="rounded-full p-1 hover:bg-amber-100 text-stone-400 hover:text-stone-600 transition-colors"
          aria-label="Aktualisieren"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Summary row */}
      {data && (
        <div className="grid grid-cols-3 divide-x divide-stone-100 border-b border-stone-100 bg-stone-50">
          <div className="px-3 py-2 text-center">
            <div className="text-base font-black tabular-nums text-stone-800">{data.totalDrivers ?? 0}</div>
            <div className="text-[9px] font-semibold text-stone-500">Fahrer</div>
          </div>
          <div className="px-3 py-2 text-center">
            <div className="text-base font-black tabular-nums text-stone-800">
              {data.avgScore != null ? data.avgScore.toFixed(0) : '—'}
            </div>
            <div className="text-[9px] font-semibold text-stone-500">Ø Score</div>
          </div>
          <div className="px-3 py-2 text-center">
            {(data.pendingRewards ?? 0) > 0 ? (
              <>
                <div className="text-base font-black tabular-nums text-amber-600">{data.pendingRewards}</div>
                <div className="text-[9px] font-semibold text-stone-500 flex items-center justify-center gap-0.5">
                  <Gift className="h-2.5 w-2.5" />Prämien
                </div>
              </>
            ) : (
              <>
                <div className="text-base font-black tabular-nums text-matcha-600">—</div>
                <div className="text-[9px] font-semibold text-stone-500">Prämien</div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 text-xs text-red-500">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && !data && (
        <div className="px-4 py-4 space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-stone-100 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Ranking list */}
      {entries.length > 0 && (
        <div className="divide-y divide-stone-100">
          {entries.map((entry) => {
            const gradeColor = GRADE_COLOR[entry.grade] ?? 'bg-stone-300 text-white';
            const scorePct = Math.min(100, entry.compositeScore);
            return (
              <div key={entry.driverId} className={cn(
                'flex items-center gap-3 px-4 py-2.5',
                entry.isTop3 && 'bg-amber-50/40',
              )}>
                {/* Rank */}
                <div className="shrink-0 w-6 text-center text-base">
                  {entry.rank <= 3 ? RANK_ICON[entry.rank - 1] : (
                    <span className="text-xs font-black text-stone-400">#{entry.rank}</span>
                  )}
                </div>

                {/* Avatar */}
                <div className="shrink-0 h-8 w-8 rounded-full bg-matcha-100 text-matcha-700 flex items-center justify-center text-xs font-black">
                  {entry.initials}
                </div>

                {/* Name + progress */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-800 truncate">{entry.driverName ?? 'Unbekannt'}</span>
                    <span className={cn('shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-black', gradeColor)}>
                      {entry.grade}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        scorePct >= 85 ? 'bg-matcha-500' : scorePct >= 70 ? 'bg-amber-400' : 'bg-red-400',
                      )}
                      style={{ width: `${scorePct}%` }}
                    />
                  </div>
                </div>

                {/* Score + tours */}
                <div className="shrink-0 text-right">
                  <div className="text-sm font-black tabular-nums text-stone-800">{entry.compositeScore.toFixed(0)}</div>
                  <div className="text-[9px] text-stone-400">{entry.toursCompleted} Touren</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && entries.length === 0 && !error && (
        <div className="px-4 py-4 text-center text-xs text-stone-400">
          Noch keine Ranking-Daten für diese Woche
        </div>
      )}
    </div>
  );
}
