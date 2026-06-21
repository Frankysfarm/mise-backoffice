'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, AreaChart, Area,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, RefreshCw, Camera, BarChart3, History, MessageSquare } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type ScoreGrade = 'A+' | 'A' | 'B' | 'C' | 'D';

interface LeaderboardEntry {
  scoreRank: number;
  driverId: string;
  driverName: string | null;
  initials: string;
  compositeScore: number;
  grade: ScoreGrade;
  fPunctuality: number;
  fRating: number;
  fEfficiency: number;
  fReliability: number;
  fActivity: number;
  fVolume: number;
  fFeedback: number;
  dataPoints: number;
  periodStart: string;
}

interface HistoryRow {
  id: string;
  driverId: string;
  periodStart: string;
  compositeScore: number;
  grade: ScoreGrade;
  fFeedback: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const GRADE_COLORS: Record<ScoreGrade, string> = {
  'A+': 'bg-emerald-100 text-emerald-800',
  'A':  'bg-green-100 text-green-800',
  'B':  'bg-blue-100 text-blue-800',
  'C':  'bg-amber-100 text-amber-800',
  'D':  'bg-red-100 text-red-800',
};

const DRIVER_LINE_COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#a855f7'];

function GradeBadge({ grade }: { grade: ScoreGrade }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${GRADE_COLORS[grade]}`}>
      {grade}
    </span>
  );
}

function FactorBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="space-y-0.5">
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{label}</span>
        <span>{value.toFixed(1)}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-1">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold font-display">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

// ─── Tab Button ──────────────────────────────────────────────────────────────

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active ? 'bg-matcha-600 text-white' : 'text-muted-foreground hover:bg-muted'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function DriverScoreClient({ employeeId }: { employeeId: string }) {
  void employeeId;

  const [tab, setTab] = useState<'leaderboard' | 'history' | 'feedback'>('leaderboard');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [weeks, setWeeks] = useState(8);
  const [loading, setLoading] = useState(false);
  const [recomputing, setRecomputing] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [period] = useState<'week' | 'month'>('week');

  // Resolve locationId once
  useEffect(() => {
    fetch('/api/delivery/admin/driver-score?action=leaderboard&period=week&limit=1')
      .then(r => r.json())
      .then(d => {
        if (d.entries?.[0]?.locationId) setLocationId(d.entries[0].locationId);
      })
      .catch(() => {});
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/driver-score?action=leaderboard&period=${period}&limit=20`);
      const d = await res.json();
      setEntries(d.entries ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [period]);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/driver-score?action=history&weeks=${weeks}`);
      const d = await res.json();
      setHistoryRows(d.rows ?? []);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [weeks]);

  useEffect(() => {
    if (tab === 'leaderboard' || tab === 'feedback') fetchLeaderboard();
    if (tab === 'history') fetchHistory();
  }, [tab, fetchLeaderboard, fetchHistory]);

  // KPIs
  const avgScore = entries.length > 0
    ? (entries.reduce((s: number, e: LeaderboardEntry) => s + e.compositeScore, 0) / entries.length).toFixed(1)
    : '–';
  const topScore = entries.length > 0 ? Math.max(...entries.map((e: LeaderboardEntry) => e.compositeScore)).toFixed(1) : '–';
  const feedbackRate = entries.length > 0
    ? Math.round((entries.filter((e: LeaderboardEntry) => e.fFeedback > 0).length / entries.length) * 100) + '%'
    : '–';

  // History chart data: top 5 drivers by latest score
  const top5Ids = [...entries].sort((a: LeaderboardEntry, b: LeaderboardEntry) => b.compositeScore - a.compositeScore).slice(0, 5).map((e: LeaderboardEntry) => e.driverId);
  const weekSet: string[] = (Array.from(new Set(historyRows.map((r: HistoryRow) => r.periodStart))) as string[]).sort();
  const chartData = weekSet.map((week: string) => {
    const pt: Record<string, number | string> = { week: week.slice(5) };
    for (const id of top5Ids) {
      const row = historyRows.find((r: HistoryRow) => r.driverId === id && r.periodStart === week);
      if (row) pt[id] = row.compositeScore;
    }
    return pt;
  });

  // Trend: compare last 2 weeks avg
  const lastTwo = weekSet.slice(-2);
  let trendLabel = 'Stabil';
  let TrendIcon = Minus;
  if (lastTwo.length === 2) {
    const w1Rows = historyRows.filter((r: HistoryRow) => r.periodStart === lastTwo[0]);
    const w2Rows = historyRows.filter((r: HistoryRow) => r.periodStart === lastTwo[1]);
    const avg1 = w1Rows.length > 0 ? w1Rows.reduce((s: number, r: HistoryRow) => s + r.compositeScore, 0) / w1Rows.length : 0;
    const avg2 = w2Rows.length > 0 ? w2Rows.reduce((s: number, r: HistoryRow) => s + r.compositeScore, 0) / w2Rows.length : 0;
    if (avg2 > avg1 + 1) { trendLabel = `+${(avg2 - avg1).toFixed(1)}`; TrendIcon = TrendingUp; }
    else if (avg2 < avg1 - 1) { trendLabel = `${(avg2 - avg1).toFixed(1)}`; TrendIcon = TrendingDown; }
  }

  const handleRecompute = async () => {
    if (!locationId || recomputing) return;
    setRecomputing(true);
    try {
      await fetch('/api/delivery/admin/driver-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, period, action: 'recompute' }),
      });
      await fetchLeaderboard();
    } catch { /* ignore */ } finally {
      setRecomputing(false);
    }
  };

  const handleSnapshot = async () => {
    if (!locationId || snapshotting) return;
    setSnapshotting(true);
    try {
      await fetch('/api/delivery/admin/driver-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, action: 'snapshot' }),
      });
    } catch { /* ignore */ } finally {
      setSnapshotting(false);
    }
  };

  const feedbackSorted = [...entries].sort((a, b) => b.fFeedback - a.fFeedback).filter(e => e.fFeedback > 0 || e.compositeScore > 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 pb-24">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold">Fahrer Score-Verlauf</h1>
          <p className="mt-1 text-sm text-muted-foreground">Wöchentlicher Composite-Score + Feedback-Integration</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSnapshot}
            disabled={snapshotting || !locationId}
            className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
          >
            {snapshotting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            Snapshot
          </button>
          <button
            onClick={handleRecompute}
            disabled={recomputing || !locationId}
            className="flex items-center gap-2 rounded-lg bg-matcha-600 px-3 py-2 text-sm font-medium text-white hover:bg-matcha-700 disabled:opacity-50"
          >
            {recomputing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Neu berechnen
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Ø Team-Score" value={avgScore} sub="diese Woche" icon={<BarChart3 className="h-3.5 w-3.5" />} />
        <KpiCard label="Top-Score" value={topScore} sub="bester Fahrer" icon={<TrendingUp className="h-3.5 w-3.5" />} />
        <KpiCard label="Feedback-Rate" value={feedbackRate} sub="mit tour_feedback" icon={<MessageSquare className="h-3.5 w-3.5" />} />
        <KpiCard label="Trend" value={trendLabel} sub="vs. Vorwoche" icon={<TrendIcon className="h-3.5 w-3.5" />} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <TabButton active={tab === 'leaderboard'} onClick={() => setTab('leaderboard')} icon={<BarChart3 className="h-4 w-4" />} label="Rangliste" />
        <TabButton active={tab === 'history'} onClick={() => setTab('history')} icon={<History className="h-4 w-4" />} label="Score-Verlauf" />
        <TabButton active={tab === 'feedback'} onClick={() => setTab('feedback')} icon={<MessageSquare className="h-4 w-4" />} label="Feedback-Integration" />
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* ── Tab: Rangliste ── */}
      {!loading && tab === 'leaderboard' && (
        <div className="space-y-3">
          {entries.length === 0 && (
            <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
              Keine Score-Daten verfügbar. Bitte Scores neu berechnen.
            </div>
          )}
          {entries.slice(0, 10).map((e: LeaderboardEntry) => (
            <div key={e.driverId} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-matcha-100 font-display text-sm font-bold text-matcha-700">
                  {e.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground">#{e.scoreRank}</span>
                    <span className="font-medium truncate">{e.driverName ?? e.driverId.slice(0, 8)}</span>
                    <GradeBadge grade={e.grade} />
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{e.dataPoints} Datenpunkte · ab {e.periodStart}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold font-display">{e.compositeScore.toFixed(1)}</div>
                  <div className="text-[10px] text-muted-foreground">/ 100</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-4">
                <FactorBar label="Pünktlichkeit" value={e.fPunctuality} max={30} color="bg-green-500" />
                <FactorBar label="Bewertung" value={e.fRating} max={25} color="bg-blue-500" />
                <FactorBar label="Effizienz" value={e.fEfficiency} max={15} color="bg-violet-500" />
                <FactorBar label="Zuverlässigkeit" value={e.fReliability} max={15} color="bg-amber-500" />
                <FactorBar label="Aktivität" value={e.fActivity} max={10} color="bg-cyan-500" />
                <FactorBar label="Volumen" value={e.fVolume} max={5} color="bg-rose-500" />
                <FactorBar label="Feedback" value={e.fFeedback} max={5} color="bg-emerald-500" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: Score-Verlauf ── */}
      {!loading && tab === 'history' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">Zeitraum:</span>
            {([4, 8, 12] as const).map(w => (
              <button
                key={w}
                onClick={() => setWeeks(w)}
                className={`rounded-lg px-3 py-1 text-sm font-medium transition-colors ${
                  weeks === w ? 'bg-matcha-600 text-white' : 'border hover:bg-muted'
                }`}
              >
                {w} Wochen
              </button>
            ))}
          </div>

          {chartData.length === 0 ? (
            <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
              Noch keine History-Daten. Bitte zuerst einen Snapshot speichern.
            </div>
          ) : (
            <div className="rounded-xl border bg-card p-4">
              <h3 className="mb-4 text-sm font-semibold">Score-Verlauf Top-5 Fahrer</h3>
              <ResponsiveContainer width="100%" height={320}>
                <LineChart data={chartData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: number) => `${value.toFixed(1)}`} />
                  <Legend />
                  {top5Ids.map((id: string, i: number) => {
                    const entry = entries.find((e: LeaderboardEntry) => e.driverId === id);
                    const name = entry?.driverName ?? id.slice(0, 8);
                    return (
                      <Line
                        key={id}
                        type="monotone"
                        dataKey={id}
                        name={name}
                        stroke={DRIVER_LINE_COLORS[i % DRIVER_LINE_COLORS.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Feedback-Integration ── */}
      {!loading && tab === 'feedback' && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Fahrer sortiert nach Feedback-Score (tour_feedback.customer_rating Integration).
            Fahrer ohne Feedback-Daten erscheinen am Ende.
          </p>
          {feedbackSorted.length === 0 && (
            <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
              Keine Daten verfügbar.
            </div>
          )}
          {feedbackSorted.map((e) => (
            <div key={e.driverId} className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-display text-sm font-bold text-emerald-700">
                  {e.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{e.driverName ?? e.driverId.slice(0, 8)}</span>
                    <GradeBadge grade={e.grade} />
                  </div>
                  <div className="mt-1.5 space-y-1">
                    <FactorBar label="Feedback-Score" value={e.fFeedback} max={5} color="bg-emerald-500" />
                    <FactorBar label="Gesamt-Score" value={e.compositeScore} max={100} color="bg-matcha-500" />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-sm font-bold">{e.fFeedback.toFixed(2)}</div>
                  <div className="text-[10px] text-muted-foreground">/ 5</div>
                  {e.fFeedback === 0 && (
                    <div className="mt-1 text-[10px] text-muted-foreground italic">kein Feedback</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
