'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, Target, TrendingUp } from 'lucide-react';

type LeaderboardEntry = {
  rank: number;
  driverId: string;
  driverName: string | null;
  totalEurToday: number;
  confirmedEur: number;
  eventsToday: number;
};

type Dashboard = {
  totalPoolEurToday: number;
  approvedEurToday: number;
  pendingEurToday: number;
  activeDriversWithIncentives: number;
  totalEventsToday: number;
  topEarner: { driverName: string | null; bonusEur: number } | null;
  leaderboard: LeaderboardEntry[];
};

const RANK_COLOR = (rank: number) =>
  rank === 1 ? 'text-yellow-500' : rank === 2 ? 'text-slate-400' : rank === 3 ? 'text-amber-600' : 'text-muted-foreground';

const RANK_BG = (rank: number) =>
  rank === 1
    ? 'bg-yellow-500/10 border-yellow-500/20'
    : rank <= 3
    ? 'bg-muted/60 border-border'
    : 'bg-muted/30 border-transparent';

export function DispatchIncentiveMilestoneStrip({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    if (!locationId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(
          `/api/delivery/admin/driver-incentives?action=dashboard&location_id=${encodeURIComponent(locationId)}`,
        );
        if (!res.ok) return;
        const json = await res.json();
        if (!cancelled && json.ok) setData(json.dashboard);
      } catch { /* ignore */ }
    };

    load();
    const iv = setInterval(load, 120_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!data || data.leaderboard.length === 0) return null;

  return (
    <section className="rounded-xl border bg-card p-4 space-y-3">
      {/* Header + KPIs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-500" />
          <span className="text-sm font-semibold">Fahrer-Incentives Heute</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            <span>
              Pool:{' '}
              <span className="font-semibold text-foreground">
                {data.totalPoolEurToday.toFixed(2)} €
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1 text-emerald-600">
            <span className="font-semibold">{data.approvedEurToday.toFixed(2)} €</span>
            <span className="text-muted-foreground">genehmigt</span>
          </div>
          <div className="flex items-center gap-1 text-yellow-600">
            <span className="font-semibold">{data.pendingEurToday.toFixed(2)} €</span>
            <span className="text-muted-foreground">ausstehend</span>
          </div>
        </div>
      </div>

      {/* Leaderboard-Kacheln */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {data.leaderboard.slice(0, 8).map((entry) => (
          <div
            key={entry.driverId}
            className={cn('rounded-lg p-2.5 border space-y-1 transition-colors', RANK_BG(entry.rank))}
          >
            <div className="flex items-center gap-1.5">
              <span className={cn('text-xs font-bold tabular-nums', RANK_COLOR(entry.rank))}>
                #{entry.rank}
              </span>
              <span className="text-xs font-medium text-foreground truncate">
                {entry.driverName ?? '—'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{entry.eventsToday}× Bonus</span>
              <span className="text-xs font-bold text-emerald-600">
                +{entry.totalEurToday.toFixed(2)} €
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Target className="h-3 w-3" />
          <span>{data.activeDriversWithIncentives} Fahrer mit aktiven Boni</span>
        </div>
        {data.topEarner && (
          <div className="ml-auto flex items-center gap-1.5 text-yellow-600 font-medium">
            🏆 {data.topEarner.driverName}: +{data.topEarner.bonusEur.toFixed(2)} €
          </div>
        )}
      </div>
    </section>
  );
}
