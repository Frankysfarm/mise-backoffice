'use client';

import { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, Star, Clock, Bike, Target, RefreshCw } from 'lucide-react';

interface LeaderboardEntry {
  rank: number;
  driverId: string;
  driverName: string | null;
  initials: string;
  toursCompleted: number;
  stopsCompleted: number;
  totalDistanceKm: number;
  activeMinutes: number;
  avgDeliveryMin: number | null;
  onTimeRate: number | null;
  avgRating: number | null;
  totalRatings: number;
  earningsEur: number;
  lastActiveDate: string;
  activeDays: number;
}

interface ScoreEntry {
  scoreRank: number;
  driverId: string;
  driverName: string | null;
  initials: string;
  compositeScore: number;
  grade: string;
  fPunctuality: number;
  fRating: number;
  fEfficiency: number;
  fReliability: number;
  fActivity: number;
  fVolume: number;
  dataPoints: number;
}

interface LeaderboardData {
  period: string;
  total: number;
  entries: LeaderboardEntry[];
}

interface ScoreData {
  period: string;
  total: number;
  entries: ScoreEntry[];
}

type Period = 'today' | 'week' | 'month';
type Tab = 'leaderboard' | 'score';

const PERIOD_LABELS: Record<Period, string> = {
  today: 'Heute',
  week: 'Diese Woche',
  month: 'Dieser Monat',
};

function rankColor(rank: number) {
  if (rank === 1) return 'bg-amber-100 text-amber-700 border-amber-300';
  if (rank === 2) return 'bg-slate-100 text-slate-600 border-slate-300';
  if (rank === 3) return 'bg-orange-50 text-orange-600 border-orange-200';
  return 'bg-muted text-muted-foreground border-border';
}

function onTimeColor(rate: number | null) {
  if (rate === null) return 'text-muted-foreground';
  if (rate >= 0.9) return 'text-matcha-700';
  if (rate >= 0.75) return 'text-amber-600';
  return 'text-red-600';
}

function gradeColor(grade: string) {
  switch (grade) {
    case 'A+': return 'bg-matcha-100 text-matcha-800 border-matcha-300';
    case 'A':  return 'bg-green-50 text-green-700 border-green-200';
    case 'B':  return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'C':  return 'bg-amber-50 text-amber-700 border-amber-200';
    default:   return 'bg-red-50 text-red-700 border-red-200';
  }
}

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-1.5">
      <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] tabular-nums text-muted-foreground w-6">{value.toFixed(0)}</span>
    </div>
  );
}

function CompositeScoreDial({ score }: { score: number }) {
  const pct = Math.round(score);
  const color = score >= 90 ? 'text-matcha-700' : score >= 75 ? 'text-green-600' : score >= 60 ? 'text-blue-600' : score >= 45 ? 'text-amber-600' : 'text-red-600';
  return (
    <div className="flex flex-col items-center">
      <span className={cn('text-lg font-black tabular-nums', color)}>{pct}</span>
      <div className="h-1 w-12 rounded-full bg-muted overflow-hidden mt-0.5">
        <div
          className={cn('h-full rounded-full', score >= 75 ? 'bg-matcha-600' : score >= 60 ? 'bg-blue-500' : score >= 45 ? 'bg-amber-500' : 'bg-red-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function DriverLeaderboardClient({ locationId }: { locationId: string }) {
  const [activeTab, setActiveTab] = useState<Tab>('leaderboard');
  const [period, setPeriod] = useState<Period>('week');
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);

  const loadLeaderboard = useCallback(() => {
    setLoading(true);
    setData(null);
    fetch(`/api/delivery/admin/driver-leaderboard?location_id=${locationId}&period=${period}&limit=20`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.entries) setData(d as LeaderboardData); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId, period]);

  const loadScores = useCallback(() => {
    setLoading(true);
    setScoreData(null);
    const p = period === 'today' ? 'week' : period;
    fetch(`/api/delivery/admin/driver-score?location_id=${locationId}&period=${p}&limit=20`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.entries) setScoreData(d as ScoreData); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [locationId, period]);

  useEffect(() => {
    if (activeTab === 'leaderboard') loadLeaderboard();
    else loadScores();
  }, [activeTab, loadLeaderboard, loadScores]);

  async function handleComputeScores() {
    setComputing(true);
    const p = period === 'today' ? 'week' : period;
    try {
      await fetch('/api/delivery/admin/driver-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, period: p }),
      });
      loadScores();
    } catch { /* noop */ }
    finally { setComputing(false); }
  }

  const scorePeriod = period === 'today' ? 'week' : period;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b">
        {([['leaderboard', 'Rohdaten-Rangliste'], ['score', 'Performance-Score']] as const).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-semibold border-b-2 transition -mb-px',
              activeTab === t
                ? 'border-matcha-700 text-matcha-700'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Zeitraum */}
      <div className="flex items-center gap-2 flex-wrap">
        {(Object.keys(PERIOD_LABELS) as Period[]).map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-semibold transition',
              period === p
                ? 'bg-matcha-700 text-white border-matcha-700'
                : 'bg-card border-border text-muted-foreground hover:bg-muted',
            )}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {activeTab === 'leaderboard' ? (data?.total ?? 0) : (scoreData?.total ?? 0)} Fahrer
        </span>
        {activeTab === 'score' && (
          <button
            onClick={handleComputeScores}
            disabled={computing}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold bg-card hover:bg-muted transition disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', computing && 'animate-spin')} />
            {computing ? 'Berechne…' : 'Scores berechnen'}
          </button>
        )}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted-foreground">Lade…</div>
      )}

      {/* ── Rohdaten-Rangliste ───────────────────────────────────────────────── */}
      {!loading && activeTab === 'leaderboard' && (
        <>
          {(!data || data.entries.length === 0) && (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Keine Fahrer-Daten für diesen Zeitraum.
            </div>
          )}
          {data && data.entries.length > 0 && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <Trophy className="h-4 w-4 text-matcha-700" />
                <span className="font-semibold text-sm">Rangliste · {PERIOD_LABELS[period]}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                      <th className="text-left px-4 py-2">#</th>
                      <th className="text-left px-4 py-2">Fahrer</th>
                      <th className="text-left px-4 py-2">Touren</th>
                      <th className="text-left px-4 py-2">Stopps</th>
                      <th className="text-left px-4 py-2">On-Time</th>
                      <th className="text-left px-4 py-2">Ø Lieferzeit</th>
                      <th className="text-left px-4 py-2">Bewertung</th>
                      <th className="text-left px-4 py-2">Km</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.entries.map(entry => (
                      <tr key={entry.driverId} className="border-t border-border hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black border', rankColor(entry.rank))}>
                            {entry.rank}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-matcha-100 text-matcha-800 flex items-center justify-center text-xs font-bold shrink-0">
                              {entry.initials}
                            </div>
                            <div>
                              <div className="text-sm font-medium">{entry.driverName ?? entry.driverId.slice(0, 8)}</div>
                              <div className="text-[11px] text-muted-foreground">{entry.activeDays} aktive Tage</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm tabular-nums font-medium">{entry.toursCompleted}</td>
                        <td className="px-4 py-3 text-sm tabular-nums">{entry.stopsCompleted}</td>
                        <td className="px-4 py-3">
                          {entry.onTimeRate !== null ? (
                            <span className={cn('text-sm font-bold', onTimeColor(entry.onTimeRate))}>
                              {Math.round(entry.onTimeRate * 100)}%
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm tabular-nums text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3 shrink-0" />
                            {entry.avgDeliveryMin !== null ? `${Math.round(entry.avgDeliveryMin)} Min` : '—'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {entry.avgRating !== null ? (
                            <div className="flex items-center gap-1">
                              <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                              <span className="text-sm font-medium">{entry.avgRating.toFixed(1)}</span>
                              <span className="text-[11px] text-muted-foreground">({entry.totalRatings})</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 text-sm tabular-nums text-muted-foreground">
                            <Bike className="h-3 w-3 shrink-0" />
                            {entry.totalDistanceKm.toFixed(1)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Performance-Score Rangliste ──────────────────────────────────────── */}
      {!loading && activeTab === 'score' && (
        <>
          {(!scoreData || scoreData.entries.length === 0) && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground text-sm">
              <Target className="h-8 w-8 opacity-30" />
              <span>Noch keine Scores berechnet.</span>
              <button
                onClick={handleComputeScores}
                disabled={computing}
                className="rounded-lg bg-matcha-700 text-white px-4 py-2 text-sm font-semibold hover:bg-matcha-800 transition disabled:opacity-50"
              >
                {computing ? 'Berechne…' : 'Jetzt berechnen'}
              </button>
            </div>
          )}
          {scoreData && scoreData.entries.length > 0 && (
            <div className="rounded-xl border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <Target className="h-4 w-4 text-matcha-700" />
                <span className="font-semibold text-sm">Performance-Score · {scorePeriod === 'week' ? 'Diese Woche' : 'Dieser Monat'}</span>
                <span className="ml-auto text-[11px] text-muted-foreground">0–100 Punkte</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
                      <th className="text-left px-4 py-2">#</th>
                      <th className="text-left px-4 py-2">Fahrer</th>
                      <th className="text-left px-4 py-2">Score</th>
                      <th className="text-left px-4 py-2">Note</th>
                      <th className="text-left px-4 py-2">Pünktlichkeit</th>
                      <th className="text-left px-4 py-2">Bewertung</th>
                      <th className="text-left px-4 py-2">Effizienz</th>
                      <th className="text-left px-4 py-2">Zuverlässigkeit</th>
                      <th className="text-left px-4 py-2">Aktivität</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scoreData.entries.map(entry => (
                      <tr key={entry.driverId} className="border-t border-border hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black border', rankColor(entry.scoreRank))}>
                            {entry.scoreRank}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-matcha-100 text-matcha-800 flex items-center justify-center text-xs font-bold shrink-0">
                              {entry.initials}
                            </div>
                            <div>
                              <div className="text-sm font-medium">{entry.driverName ?? entry.driverId.slice(0, 8)}</div>
                              <div className="text-[11px] text-muted-foreground">{entry.dataPoints} Tage Daten</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <CompositeScoreDial score={entry.compositeScore} />
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('inline-flex items-center justify-center px-2 py-0.5 rounded text-[11px] font-black border', gradeColor(entry.grade))}>
                            {entry.grade}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <ScoreBar value={entry.fPunctuality} max={30} color="bg-matcha-500" />
                        </td>
                        <td className="px-4 py-3">
                          <ScoreBar value={entry.fRating} max={25} color="bg-amber-400" />
                        </td>
                        <td className="px-4 py-3">
                          <ScoreBar value={entry.fEfficiency} max={15} color="bg-blue-500" />
                        </td>
                        <td className="px-4 py-3">
                          <ScoreBar value={entry.fReliability} max={15} color="bg-purple-500" />
                        </td>
                        <td className="px-4 py-3">
                          <ScoreBar value={entry.fActivity} max={10} color="bg-rose-400" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
