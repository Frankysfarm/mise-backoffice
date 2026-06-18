'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import type { BenchmarkDashboard, BenchmarkRankRow, BenchmarkTrendRow, BestPracticeExport } from '@/lib/delivery/benchmarking';

const REFRESH_INTERVAL = 300; // 5 min

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gradeColor(grade: string) {
  if (grade === 'A') return 'text-emerald-400';
  if (grade === 'B') return 'text-lime-400';
  if (grade === 'C') return 'text-amber-400';
  if (grade === 'D') return 'text-orange-400';
  return 'text-red-400';
}

function gradeBg(grade: string) {
  if (grade === 'A') return 'bg-emerald-500/10 border-emerald-500/20';
  if (grade === 'B') return 'bg-lime-500/10 border-lime-500/20';
  if (grade === 'C') return 'bg-amber-500/10 border-amber-500/20';
  if (grade === 'D') return 'bg-orange-500/10 border-orange-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

function scoreColor(s: number) {
  if (s >= 85) return 'text-emerald-400';
  if (s >= 70) return 'text-lime-400';
  if (s >= 55) return 'text-amber-400';
  if (s >= 40) return 'text-orange-400';
  return 'text-red-400';
}

function scoreBg(s: number) {
  if (s >= 85) return 'bg-emerald-500';
  if (s >= 70) return 'bg-lime-400';
  if (s >= 55) return 'bg-amber-400';
  if (s >= 40) return 'bg-orange-400';
  return 'bg-red-500';
}

function rankBadge(rank: number) {
  if (rank === 1) return <span className="text-xl">🥇</span>;
  if (rank === 2) return <span className="text-xl">🥈</span>;
  if (rank === 3) return <span className="text-xl">🥉</span>;
  return <span className="text-sm font-bold text-gray-500">#{rank}</span>;
}

function fmt(v: number | null, decimals = 1, suffix = '') {
  if (v === null || v === undefined) return <span className="text-gray-500">—</span>;
  return <>{v.toFixed(decimals)}{suffix}</>;
}

const DIM_LABELS: Record<string, string> = {
  quality:    'Qualität',
  sla:        'SLA',
  carbon:     'CO₂',
  throughput: 'Durchsatz',
  efficiency: 'Effizienz',
};

const DIM_WEIGHTS: Record<string, string> = {
  quality:    '35%',
  sla:        '25%',
  carbon:     '10%',
  throughput: '20%',
  efficiency: '10%',
};

// ─── Sparkline ────────────────────────────────────────────────────────────────

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return <span className="text-gray-600 text-xs">–</span>;
  const w = 120;
  const h = 32;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * (h - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#34d399" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#34d399" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polyline
        points={pts}
        fill="none"
        stroke="#34d399"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── DimBar ───────────────────────────────────────────────────────────────────

function DimBar({ label, weight, score, weakest }: { label: string; weight: string; score: number; weakest: boolean }) {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between mb-0.5">
        <span className={`text-xs ${weakest ? 'text-amber-400 font-semibold' : 'text-gray-400'}`}>
          {label} <span className="text-gray-600">({weight})</span>
          {weakest && <span className="ml-1 text-amber-400">⚠</span>}
        </span>
        <span className={`text-xs font-mono font-semibold ${scoreColor(score)}`}>{score.toFixed(1)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${scoreBg(score)}`}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// ─── KpiCard ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-0.5">{sub}</div>}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = 'overview' | 'ranking' | 'trend' | 'best-practice';

interface Props {
  locationId: string;
  initial: BenchmarkDashboard | null;
}

export function BenchmarkingClient({ locationId, initial }: Props) {
  const [data, setData] = useState<BenchmarkDashboard | null>(initial);
  const [loading, setLoading] = useState(initial === null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [exportData, setExportData] = useState<BestPracticeExport | null>(initial?.bestPractice ?? null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/admin/benchmarking?location_id=${locationId}`);
      if (!res.ok) {
        const j = await res.json() as { error?: string };
        setError(j.error ?? 'Fehler beim Laden');
        return;
      }
      const d = await res.json() as BenchmarkDashboard;
      setData(d);
      setExportData(d.bestPractice);
      setError(null);
    } catch {
      setError('Netzwerkfehler');
    } finally {
      setLoading(false);
      setCountdown(REFRESH_INTERVAL);
    }
  }, [locationId]);

  useEffect(() => {
    if (!initial) load();
    intervalRef.current = setInterval(load, REFRESH_INTERVAL * 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [load, initial]);

  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const triggerSnapshot = async () => {
    setSnapshotLoading(true);
    try {
      await fetch('/api/delivery/admin/benchmarking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snapshot', location_id: locationId }),
      });
      await load();
    } finally {
      setSnapshotLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm animate-pulse">
        Lade Benchmark-Daten…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-6 text-red-400 text-sm">
        {error}
      </div>
    );
  }

  const today = data?.today ?? null;
  const yesterday = data?.yesterday ?? null;
  const trend: BenchmarkTrendRow[] = data?.trend ?? [];
  const ranking: BenchmarkRankRow[] = data?.ranking ?? [];
  const trendScores = [...trend].reverse().map((r) => r.overallScore);

  const scoreChange = today && yesterday
    ? Math.round((today.overallScore - yesterday.overallScore) * 10) / 10
    : null;

  const TABS: { id: Tab; label: string }[] = [
    { id: 'overview',      label: 'Übersicht' },
    { id: 'ranking',       label: `Ranking (${ranking.length})` },
    { id: 'trend',         label: '30-Tage Trend' },
    { id: 'best-practice', label: 'Best Practice' },
  ];

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Benchmark-Analyse</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Multi-dimensionaler Standort-Vergleich · {ranking.length} Standort{ranking.length !== 1 ? 'e' : ''}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-600">Refresh in {countdown}s</span>
          <button
            onClick={triggerSnapshot}
            disabled={snapshotLoading}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-gray-300 transition disabled:opacity-40"
          >
            {snapshotLoading ? 'Berechne…' : 'Jetzt berechnen'}
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard
          label="Score heute"
          value={
            today
              ? <span className={scoreColor(today.overallScore)}>{today.overallScore.toFixed(1)}</span>
              : <span className="text-gray-500">—</span>
          }
          sub={today ? `Note ${today.grade}${scoreChange !== null ? ` · ${scoreChange >= 0 ? '+' : ''}${scoreChange}` : ''}` : 'Kein Snapshot'}
        />
        <KpiCard
          label="Rang"
          value={
            today?.locationRank != null
              ? <span className="text-white">#{today.locationRank}</span>
              : <span className="text-gray-500">—</span>
          }
          sub={today?.totalLocations != null ? `von ${today.totalLocations} Standorten` : undefined}
        />
        <KpiCard
          label="7-Tage-Ø"
          value={
            data?.weeklyAvg
              ? <span className={scoreColor(data.weeklyAvg)}>{data.weeklyAvg.toFixed(1)}</span>
              : <span className="text-gray-500">—</span>
          }
          sub="Composite Score"
        />
        <KpiCard
          label="Schwächste Dimension"
          value={
            today?.weakestDimension
              ? <span className="text-amber-400 text-base">{DIM_LABELS[today.weakestDimension] ?? today.weakestDimension}</span>
              : <span className="text-gray-500">—</span>
          }
          sub="Verbesserungspotential"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm rounded-t-lg transition ${
              tab === t.id
                ? 'bg-white/10 text-white font-medium'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Dimension Bars */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Dimension-Scores</h3>
            {today ? (
              <>
                <DimBar label="Qualität"   weight="35%" score={today.qualityScore}    weakest={today.weakestDimension === 'quality'} />
                <DimBar label="SLA"        weight="25%" score={today.slaScore}         weakest={today.weakestDimension === 'sla'} />
                <DimBar label="Durchsatz"  weight="20%" score={today.throughputScore}  weakest={today.weakestDimension === 'throughput'} />
                <DimBar label="CO₂"        weight="10%" score={today.carbonScore}      weakest={today.weakestDimension === 'carbon'} />
                <DimBar label="Effizienz"  weight="10%" score={today.efficiencyScore}  weakest={today.weakestDimension === 'efficiency'} />
              </>
            ) : (
              <p className="text-gray-500 text-sm">Kein Snapshot für heute.</p>
            )}
          </div>

          {/* Raw Metrics */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Rohdaten gestern</h3>
            {today ? (
              <table className="w-full text-sm">
                <tbody className="divide-y divide-white/5">
                  {[
                    ['Gesamtbestellungen', today.totalOrders, ''],
                    ['Abgeschlossen', today.completedDeliveries, ''],
                    ['Pünktlich (≤45min)', today.onTimeDeliveries, ''],
                    ['Ø Lieferzeit', today.avgDeliveryMin, ' min'],
                    ['SLA-Breaches', today.slaBreachCount, ''],
                    ['Ø Fahrerstunden', today.activeDriverHours, ' h'],
                    ['Gesamt-km', today.totalDistanceKm, ' km'],
                    ['Öko-Tour-Anteil', today.ecoTourPct, '%'],
                  ].map(([label, val, suffix]) => (
                    <tr key={String(label)}>
                      <td className="py-1.5 text-gray-400">{label}</td>
                      <td className="py-1.5 text-right font-mono text-gray-200">
                        {val === null || val === undefined
                          ? <span className="text-gray-600">—</span>
                          : <>{typeof val === 'number' ? val.toFixed(typeof suffix === 'string' && suffix === '%' ? 1 : 0) : val}{suffix}</>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-500 text-sm">Kein Snapshot für heute.</p>
            )}
          </div>

          {/* Sparkline */}
          {trendScores.length >= 2 && (
            <div className="bg-white/5 border border-white/10 rounded-xl p-5 md:col-span-2">
              <h3 className="text-sm font-semibold text-white mb-3">Score-Verlauf (30 Tage)</h3>
              <Sparkline data={trendScores} />
              <div className="flex justify-between text-xs text-gray-600 mt-1">
                <span>{trend[trend.length - 1]?.benchDate}</span>
                <span>{trend[0]?.benchDate}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Ranking Tab */}
      {tab === 'ranking' && (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-left text-gray-500 font-medium">Rang</th>
                <th className="px-4 py-3 text-left text-gray-500 font-medium">Standort</th>
                <th className="px-4 py-3 text-right text-gray-500 font-medium">Score</th>
                <th className="px-4 py-3 text-right text-gray-500 font-medium hidden sm:table-cell">Qualität</th>
                <th className="px-4 py-3 text-right text-gray-500 font-medium hidden md:table-cell">SLA</th>
                <th className="px-4 py-3 text-right text-gray-500 font-medium hidden md:table-cell">Durchsatz</th>
                <th className="px-4 py-3 text-right text-gray-500 font-medium hidden lg:table-cell">CO₂</th>
                <th className="px-4 py-3 text-right text-gray-500 font-medium hidden lg:table-cell">Effizienz</th>
                <th className="px-4 py-3 text-right text-gray-500 font-medium">Note</th>
                <th className="px-4 py-3 text-right text-gray-500 font-medium hidden sm:table-cell">Schwäche</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {ranking.map((row) => (
                <tr
                  key={row.locationId}
                  className={`transition-colors ${row.locationId === locationId ? 'bg-blue-500/5' : 'hover:bg-white/3'}`}
                >
                  <td className="px-4 py-3">{rankBadge(row.liveRank)}</td>
                  <td className="px-4 py-3 text-white font-medium">
                    {row.locationName}
                    {row.locationId === locationId && <span className="ml-2 text-xs text-blue-400">(Ihr Standort)</span>}
                  </td>
                  <td className={`px-4 py-3 text-right font-mono font-semibold ${scoreColor(row.overallScore)}`}>
                    {row.overallScore.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300 hidden sm:table-cell">
                    {fmt(row.qualityScore)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300 hidden md:table-cell">
                    {fmt(row.slaScore)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300 hidden md:table-cell">
                    {fmt(row.throughputScore)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300 hidden lg:table-cell">
                    {fmt(row.carbonScore)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300 hidden lg:table-cell">
                    {fmt(row.efficiencyScore)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className={`inline-block px-2 py-0.5 rounded font-bold text-xs border ${gradeBg(row.grade)} ${gradeColor(row.grade)}`}>
                      {row.grade}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs hidden sm:table-cell">
                    {row.weakestDimension ? DIM_LABELS[row.weakestDimension] ?? row.weakestDimension : '—'}
                  </td>
                </tr>
              ))}
              {ranking.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500 text-sm">
                    Noch keine Benchmark-Daten. Klicken Sie auf „Jetzt berechnen".
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Trend Tab */}
      {tab === 'trend' && (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10">
                <th className="px-4 py-3 text-left text-gray-500 font-medium">Datum</th>
                <th className="px-4 py-3 text-right text-gray-500 font-medium">Score</th>
                <th className="px-4 py-3 text-right text-gray-500 font-medium">Note</th>
                <th className="px-4 py-3 text-right text-gray-500 font-medium hidden sm:table-cell">Rang</th>
                <th className="px-4 py-3 text-right text-gray-500 font-medium hidden md:table-cell">Bestellungen</th>
                <th className="px-4 py-3 text-right text-gray-500 font-medium hidden md:table-cell">Ø Lieferzeit</th>
                <th className="px-4 py-3 text-right text-gray-500 font-medium hidden lg:table-cell">Qualität</th>
                <th className="px-4 py-3 text-right text-gray-500 font-medium hidden lg:table-cell">SLA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {trend.map((row) => (
                <tr key={row.benchDate} className="hover:bg-white/3">
                  <td className="px-4 py-2.5 text-gray-400">{row.benchDate}</td>
                  <td className={`px-4 py-2.5 text-right font-mono font-semibold ${scoreColor(row.overallScore)}`}>
                    {row.overallScore.toFixed(1)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className={`inline-block px-2 py-0.5 rounded font-bold text-xs border ${gradeBg(row.grade)} ${gradeColor(row.grade)}`}>
                      {row.grade}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-400 hidden sm:table-cell">
                    {row.locationRank != null ? `#${row.locationRank}/${row.totalLocations}` : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-300 hidden md:table-cell">
                    {row.totalOrders}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-300 hidden md:table-cell">
                    {fmt(row.avgDeliveryMin, 1, ' min')}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-300 hidden lg:table-cell">
                    {fmt(row.qualityScore)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-gray-300 hidden lg:table-cell">
                    {fmt(row.slaScore)}
                  </td>
                </tr>
              ))}
              {trend.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500 text-sm">
                    Noch keine historischen Daten vorhanden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Best Practice Tab */}
      {tab === 'best-practice' && (
        <div className="space-y-4">
          {exportData ? (
            <>
              <div className={`rounded-xl border p-5 ${gradeBg(exportData.snapshot.grade)}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Best-Practice-Standort (#1)</div>
                    <div className="text-lg font-bold text-white">{exportData.locationName}</div>
                    <div className="text-sm text-gray-400 mt-0.5">
                      Score: <span className={`font-semibold ${scoreColor(exportData.snapshot.overallScore)}`}>
                        {exportData.snapshot.overallScore.toFixed(1)}
                      </span>
                      {' '}·{' '}
                      <span className={`font-bold ${gradeColor(exportData.snapshot.grade)}`}>
                        Note {exportData.snapshot.grade}
                      </span>
                    </div>
                  </div>
                  <div className="text-4xl">{rankBadge(1)}</div>
                </div>
              </div>

              {/* Dimension comparison */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Dimensions-Vergleich</h3>
                <div className="space-y-3">
                  {exportData.insights.map((ins) => (
                    <div key={ins.dimension}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-400">
                          {DIM_LABELS[ins.dimension] ?? ins.dimension}
                          <span className="text-gray-600 ml-1">({DIM_WEIGHTS[ins.dimension] ?? '—'})</span>
                        </span>
                        <span className={`text-xs font-mono font-semibold ${scoreColor(ins.score)}`}>
                          {ins.score.toFixed(1)}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${scoreBg(ins.score)}`}
                          style={{ width: `${ins.score}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{ins.tip}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Export JSON */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-3">Export (JSON)</h3>
                <pre className="text-xs text-gray-400 bg-black/20 rounded-lg p-3 overflow-x-auto max-h-48">
                  {JSON.stringify(exportData, null, 2)}
                </pre>
                <button
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `benchmark-best-practice-${exportData.locationName}-${exportData.exportedAt.slice(0, 10)}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="mt-3 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-gray-300 transition"
                >
                  JSON herunterladen
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-xl bg-white/5 border border-white/10 p-8 text-center text-gray-500 text-sm">
              Noch keine Benchmark-Daten für einen Vergleich. Klicken Sie auf „Jetzt berechnen".
            </div>
          )}
        </div>
      )}
    </div>
  );
}
