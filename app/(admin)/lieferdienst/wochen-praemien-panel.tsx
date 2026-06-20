'use client';

import { useEffect, useState } from 'react';
import { Gift, Trophy, CheckCircle2, Clock, XCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

type RewardEntry = {
  id: string;
  driverName: string | null;
  initials: string;
  rank: number;
  bonusEur: number;
  status: 'pending' | 'approved' | 'paid' | 'rejected';
  weekStart: string;
};

type RankingDashboard = {
  weekStart?: string;
  weekEnd?: string;
  totalDrivers?: number;
  avgScore?: number;
  pendingRewards?: number;
  pendingRewardsEur?: number;
  topDriver?: { name: string | null; score: number; grade: string } | null;
  pendingRewardsList?: RewardEntry[];
};

const STATUS_CONFIG = {
  pending:  { label: 'Ausstehend', icon: Clock,        color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  approved: { label: 'Genehmigt',  icon: CheckCircle2, color: 'text-matcha-600', bg: 'bg-matcha-50', border: 'border-matcha-200' },
  paid:     { label: 'Ausgezahlt', icon: CheckCircle2, color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  rejected: { label: 'Abgelehnt',  icon: XCircle,      color: 'text-red-500',    bg: 'bg-red-50',    border: 'border-red-200' },
};

const RANK_MEDAL = ['🥇', '🥈', '🥉'];

function fmt(d: string | undefined): string {
  if (!d) return '';
  return new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

export function LieferdienstWochenPraemienPanel({ locationId }: { locationId: string }) {
  const [data, setData] = useState<RankingDashboard | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/driver-ranking?action=dashboard&location_id=${encodeURIComponent(locationId)}`);
      if (!res.ok) return;
      const json = await res.json();
      setData(json);
    } catch { /* noop */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 5 * 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data && !loading) return null;

  const rewards = data?.pendingRewardsList ?? [];
  const hasPending = (data?.pendingRewards ?? 0) > 0;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className={cn('flex items-center gap-2 px-4 py-3 border-b', hasPending ? 'bg-amber-50 border-amber-100' : 'bg-stone-50 border-stone-100')}>
        <Gift className={cn('h-4 w-4 shrink-0', hasPending ? 'text-amber-600' : 'text-stone-400')} />
        <div className="flex-1 min-w-0">
          <span className="text-xs font-bold text-stone-700 uppercase tracking-wider">Wochen-Prämien</span>
          {data?.weekStart && (
            <span className="ml-2 text-[10px] text-stone-500">{fmt(data.weekStart)} – {fmt(data.weekEnd)}</span>
          )}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-full p-1 hover:bg-stone-100 text-stone-400"
          aria-label="Aktualisieren"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* KPI bar */}
      {data && (
        <div className="grid grid-cols-3 divide-x divide-stone-100 border-b border-stone-100">
          <div className="px-3 py-2.5 text-center">
            <div className="text-base font-black tabular-nums text-stone-800">{data.totalDrivers ?? 0}</div>
            <div className="text-[9px] font-semibold text-stone-500">Fahrer</div>
          </div>
          <div className="px-3 py-2.5 text-center">
            <div className={cn('text-base font-black tabular-nums', hasPending ? 'text-amber-600' : 'text-stone-400')}>
              {data.pendingRewards ?? 0}
            </div>
            <div className="text-[9px] font-semibold text-stone-500">Ausstehend</div>
          </div>
          <div className="px-3 py-2.5 text-center">
            <div className={cn('text-base font-black tabular-nums', hasPending ? 'text-amber-600' : 'text-stone-400')}>
              {data.pendingRewardsEur != null ? `${data.pendingRewardsEur.toFixed(0)} €` : '—'}
            </div>
            <div className="text-[9px] font-semibold text-stone-500">Prämien-€</div>
          </div>
        </div>
      )}

      {/* Top driver spotlight */}
      {data?.topDriver && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50/50 border-b border-amber-100/60">
          <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-stone-700">Bester Fahrer diese Woche</div>
            <div className="text-sm font-black text-stone-800 truncate">{data.topDriver.name ?? 'Unbekannt'}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-lg font-black tabular-nums text-amber-600">{data.topDriver.score.toFixed(0)}</div>
            <div className="text-[9px] text-stone-400">Score</div>
          </div>
          <div className="shrink-0 rounded-full bg-amber-400 text-white text-xs font-black px-2 py-0.5">
            {data.topDriver.grade}
          </div>
        </div>
      )}

      {/* Pending rewards list */}
      {rewards.length > 0 ? (
        <div className="divide-y divide-stone-100">
          {rewards.map((r) => {
            const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending;
            const Icon = cfg.icon;
            return (
              <div key={r.id} className={cn('flex items-center gap-3 px-4 py-2.5', cfg.bg)}>
                <div className="shrink-0 text-base">{r.rank <= 3 ? RANK_MEDAL[r.rank - 1] : `#${r.rank}`}</div>
                <div className="shrink-0 h-8 w-8 rounded-full bg-white border border-stone-200 flex items-center justify-center text-xs font-black text-stone-600">
                  {r.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-bold text-stone-800 truncate">{r.driverName ?? 'Unbekannt'}</div>
                  <div className={cn('text-[10px] flex items-center gap-1', cfg.color)}>
                    <Icon className="h-2.5 w-2.5" />
                    {cfg.label}
                  </div>
                </div>
                <div className="shrink-0 font-black text-sm tabular-nums text-stone-800">
                  +{r.bonusEur.toFixed(0)} €
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        !loading && data && (
          <div className="px-4 py-5 text-center text-xs text-stone-400">
            Keine ausstehenden Prämien diese Woche
          </div>
        )
      )}

      {loading && !data && (
        <div className="px-4 py-4 space-y-2">
          {[1, 2].map(i => <div key={i} className="h-12 bg-stone-100 rounded-xl animate-pulse" />)}
        </div>
      )}
    </div>
  );
}
