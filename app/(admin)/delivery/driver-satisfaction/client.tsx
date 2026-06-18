'use client';

import { useState, useEffect, useCallback } from 'react';
import { Smile, RefreshCw, Star, TrendingUp, Users2, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  SatisfactionDashboard,
  SatisfactionLeaderboardRow,
  SatisfactionTier,
} from '@/lib/delivery/driver-satisfaction';

// ─── tier helpers ─────────────────────────────────────────────────────────────

const TIER_LABEL: Record<SatisfactionTier, string> = {
  excellent: 'Ausgezeichnet',
  good:      'Gut',
  fair:      'Mittel',
  poor:      'Schlecht',
};

const TIER_COLOR: Record<SatisfactionTier, string> = {
  excellent: 'bg-emerald-100 text-emerald-700',
  good:      'bg-lime-100 text-lime-700',
  fair:      'bg-amber-100 text-amber-700',
  poor:      'bg-red-100 text-red-700',
};

const TIER_DOT: Record<SatisfactionTier, string> = {
  excellent: 'bg-emerald-500',
  good:      'bg-lime-500',
  fair:      'bg-amber-400',
  poor:      'bg-red-600 animate-pulse',
};

const TIER_BAR: Record<SatisfactionTier, string> = {
  excellent: 'bg-emerald-500',
  good:      'bg-lime-500',
  fair:      'bg-amber-400',
  poor:      'bg-red-500',
};

// ─── components ───────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon, color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4 flex gap-4 items-start shadow-sm">
      <div className={cn('p-2 rounded-lg', color)}>{icon}</div>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="text-2xl font-bold text-slate-800 leading-tight">{value}</div>
        {sub && <div className="text-xs text-slate-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function ScoreBar({
  label, score, weight,
}: {
  label: string;
  score: number;
  weight: string;
}) {
  const color =
    score >= 85 ? 'bg-emerald-500' :
    score >= 70 ? 'bg-lime-500' :
    score >= 55 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 text-xs text-slate-500 shrink-0">
        {label} <span className="text-slate-300">({weight})</span>
      </div>
      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${score}%` }} />
      </div>
      <div className="w-8 text-xs font-medium text-slate-600 text-right">{score.toFixed(0)}</div>
    </div>
  );
}

function DriverCard({ driver }: { driver: SatisfactionLeaderboardRow }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      <div
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="w-6 text-center text-xs font-bold text-slate-400">
          #{driver.rankPosition}
        </div>
        <div className={cn('h-2 w-2 rounded-full shrink-0', TIER_DOT[driver.satisfactionTier])} />
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm text-slate-800 truncate">
            {driver.driverName ?? 'Fahrer'}
          </div>
          <div className="text-xs text-slate-400">
            {driver.vehicleType ?? '—'} · {driver.deliveries7d} Lieferungen (7d)
          </div>
        </div>
        <div className="text-lg font-bold text-slate-700">
          {driver.satisfactionScore.toFixed(0)}
        </div>
        <span className={cn('text-xs px-2 py-0.5 rounded-full', TIER_COLOR[driver.satisfactionTier])}>
          {TIER_LABEL[driver.satisfactionTier]}
        </span>
      </div>
      {expanded && (
        <div className="border-t border-slate-100 p-3 space-y-3 bg-slate-50">
          <div className="space-y-1.5">
            <ScoreBar label="Retention" score={driver.retentionComponent} weight="30%" />
            <ScoreBar label="Incentive"  score={driver.incentiveComponent} weight="25%" />
            <ScoreBar label="Bewertung"  score={driver.ratingComponent}    weight="25%" />
            <ScoreBar label="Pünktl."    score={driver.ontimeComponent}    weight="20%" />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
            <div>
              Incentive 7d: <b className="text-slate-700">€{driver.incentiveEur7d.toFixed(2)}</b>
            </div>
            <div>
              Ø Rating 30d: <b className="text-slate-700">
                {driver.avgRating30d != null ? `${driver.avgRating30d.toFixed(1)} ★` : '—'}
              </b>
            </div>
            <div>
              Pünktlichkeit 14d: <b className="text-slate-700">
                {(driver.ontimeRate14d * 100).toFixed(0)}%
              </b>
            </div>
            <div>
              Retention-Score: <b className="text-slate-700">
                {driver.retentionScoreRaw != null ? driver.retentionScoreRaw.toFixed(0) : '—'}
              </b>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export function DriverSatisfactionClient() {
  const [data, setData] = useState<SatisfactionDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapshotting, setSnapshotting] = useState(false);
  const [tab, setTab] = useState<'leaderboard' | 'trend'>('leaderboard');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/driver-satisfaction?action=dashboard');
      if (res.ok) setData(await res.json() as SatisfactionDashboard);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const handleSnapshot = async () => {
    setSnapshotting(true);
    await fetch('/api/delivery/admin/driver-satisfaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'snapshot' }),
    });
    setSnapshotting(false);
    await load();
  };

  const ov = data?.overview;
  const tierCounts = data?.tierCounts ?? { excellent: 0, good: 0, fair: 0, poor: 0 };
  const totalDrivers = ov?.totalDrivers ?? 0;

  if (loading && !data) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="animate-spin mx-auto mb-2 text-slate-400" size={20} />
        <p className="text-slate-400 text-sm">Lade Zufriedenheitsdaten…</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      {/* header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-100 rounded-lg">
            <Smile className="h-6 w-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Fahrer-Zufriedenheits-Score (Live)</h1>
            <p className="text-sm text-slate-500">
              4-Faktoren-Index · Retention 30% · Incentive 25% · Bewertung 25% · Pünktlichkeit 20%
            </p>
          </div>
        </div>
        <button
          onClick={handleSnapshot}
          disabled={snapshotting}
          className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50"
        >
          <RefreshCw size={14} className={cn(snapshotting && 'animate-spin')} />
          {snapshotting ? 'Berechne…' : 'Neu berechnen'}
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Ø Zufriedenheit"
          value={ov?.avgSatisfaction != null ? ov.avgSatisfaction.toFixed(0) : '—'}
          sub="Score 0–100"
          icon={<Star size={18} className="text-amber-600" />}
          color="bg-amber-50"
        />
        <KpiCard
          label="Ausgezeichnet"
          value={tierCounts.excellent}
          sub={`${totalDrivers > 0 ? ((tierCounts.excellent / totalDrivers) * 100).toFixed(0) : 0}% der Fahrer`}
          icon={<TrendingUp size={18} className="text-emerald-600" />}
          color="bg-emerald-50"
        />
        <KpiCard
          label="Schlecht"
          value={tierCounts.poor}
          sub="Benötigen Aufmerksamkeit"
          icon={<AlertTriangle size={18} className="text-red-600" />}
          color="bg-red-50"
        />
        <KpiCard
          label="Aktive Fahrer"
          value={totalDrivers}
          sub={`Stand: ${ov?.latestScoreDate ?? '—'}`}
          icon={<Users2 size={18} className="text-indigo-600" />}
          color="bg-indigo-50"
        />
      </div>

      {/* tier distribution bar */}
      {totalDrivers > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          <div className="text-sm font-medium text-slate-700 mb-3">Tier-Verteilung</div>
          <div className="flex rounded-full overflow-hidden h-4 w-full">
            {(['excellent', 'good', 'fair', 'poor'] as SatisfactionTier[]).map(tier => {
              const count = tierCounts[tier];
              const pct = (count / totalDrivers) * 100;
              if (pct === 0) return null;
              return (
                <div
                  key={tier}
                  style={{ width: `${pct}%` }}
                  title={`${TIER_LABEL[tier]}: ${count} (${pct.toFixed(0)}%)`}
                  className={TIER_BAR[tier]}
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-500">
            {(['excellent', 'good', 'fair', 'poor'] as SatisfactionTier[]).map(tier => (
              <div key={tier} className="flex items-center gap-1">
                <span className={cn('h-2 w-2 rounded-full inline-block', TIER_DOT[tier])} />
                {TIER_LABEL[tier]}: {tierCounts[tier]}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* tabs */}
      <div className="flex border-b border-slate-200 gap-1">
        {([
          { key: 'leaderboard' as const, label: 'Rangliste (Top 10)', count: (data?.leaderboard ?? []).length },
          { key: 'trend' as const, label: '7-Tage-Trend', count: null },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              tab === t.key
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >
            {t.label}
            {t.count !== null && t.count > 0 && (
              <span className="ml-1.5 bg-emerald-100 text-emerald-700 text-xs px-1.5 py-0.5 rounded-full">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* tab: leaderboard */}
      {tab === 'leaderboard' && (
        <div className="space-y-2">
          {(data?.leaderboard ?? []).length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Users2 size={32} className="mx-auto mb-2" />
              <p className="font-medium">Noch keine Bewertungen</p>
              <p className="text-sm mt-1">Klicke auf &quot;Neu berechnen&quot; um Scores zu berechnen.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-500 pb-1">
                Top {data?.leaderboard.length} Fahrer — nach Zufriedenheits-Score sortiert
              </p>
              {(data?.leaderboard ?? []).map(d => (
                <DriverCard key={d.id} driver={d} />
              ))}
            </>
          )}
        </div>
      )}

      {/* tab: trend */}
      {tab === 'trend' && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
          {(data?.trend7d ?? []).length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <TrendingUp size={28} className="mx-auto mb-2" />
              <p>Noch keine Verlaufsdaten vorhanden.</p>
            </div>
          ) : (
            <>
              <div className="text-sm font-medium text-slate-700 mb-4">
                Ø Zufriedenheits-Score — 7 Tage
              </div>
              {/* SVG line chart */}
              {(() => {
                const trend = data?.trend7d ?? [];
                const maxScore = Math.max(...trend.map(d => d.avgScore), 100);
                const minScore = Math.min(...trend.map(d => d.avgScore), 0);
                const range = maxScore - minScore || 1;
                const W = 480;
                const H = 80;
                const padding = 10;
                const points = trend.map((d, i) => {
                  const x = trend.length > 1
                    ? padding + (i / (trend.length - 1)) * (W - 2 * padding)
                    : W / 2;
                  const y = H - padding - ((d.avgScore - minScore) / range) * (H - 2 * padding);
                  return `${x},${y}`;
                }).join(' ');
                return (
                  <div>
                    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-24">
                      {trend.length > 1 && (
                        <polyline
                          points={points}
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2"
                          strokeLinejoin="round"
                        />
                      )}
                      {trend.map((d, i) => {
                        const x = trend.length > 1
                          ? padding + (i / (trend.length - 1)) * (W - 2 * padding)
                          : W / 2;
                        const y = H - padding - ((d.avgScore - minScore) / range) * (H - 2 * padding);
                        return (
                          <circle key={d.scoreDate} cx={x} cy={y} r={3} fill="#10b981" />
                        );
                      })}
                    </svg>
                    <div className="space-y-1.5 mt-2">
                      {trend.map(d => (
                        <div key={d.scoreDate} className="flex items-center gap-3">
                          <div className="w-24 text-xs text-slate-500 shrink-0">
                            {new Date(d.scoreDate).toLocaleDateString('de-DE', {
                              weekday: 'short', day: '2-digit', month: '2-digit',
                            })}
                          </div>
                          <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${d.avgScore}%` }}
                            />
                          </div>
                          <div className="w-10 text-xs font-medium text-slate-700 text-right">
                            {d.avgScore.toFixed(0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
}
