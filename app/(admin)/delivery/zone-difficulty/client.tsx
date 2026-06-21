'use client';

/**
 * ZoneDifficultyClient — Phase 356 + 357
 * Admin-Dashboard für Zone-Schwierigkeits-Analyse.
 * Phase 357: +Verlauf-Tab mit Recharts LineChart (30-Tage-Trend).
 */

import { useState, useEffect, useCallback } from 'react';
import { MapPin, RefreshCw, TrendingDown, BarChart2, AlertTriangle, CheckCircle, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ZoneCacheEntry {
  zone: string;
  avg_difficulty: number;
  avg_traffic: number;
  issue_rate_parking: number;
  issue_rate_nav: number;
  issue_rate_address: number;
  stop_count_modifier: number;
  detour_modifier: number;
  sample_count: number;
  computed_at: string;
}

interface HistoryRow {
  zone: string;
  snapshot_date: string;
  avg_difficulty: number;
}

interface ChartPoint {
  date: string;
  A?: number;
  B?: number;
  C?: number;
  D?: number;
}

const ZONE_LABELS: Record<string, string> = { A: 'Nah', B: 'Mittel', C: 'Weit', D: 'Sehr weit' };
const ZONE_COLORS_CSS: Record<string, { card: string; accent: string; bar: string }> = {
  A: { card: 'border-matcha-200 bg-matcha-50',  accent: 'text-matcha-700',  bar: 'bg-matcha-500' },
  B: { card: 'border-blue-200 bg-blue-50',      accent: 'text-blue-700',    bar: 'bg-blue-500' },
  C: { card: 'border-amber-200 bg-amber-50',    accent: 'text-amber-700',   bar: 'bg-amber-500' },
  D: { card: 'border-red-200 bg-red-50',        accent: 'text-red-700',     bar: 'bg-red-500' },
};
const ZONE_CHART_COLORS: Record<string, string> = {
  A: '#22c55e',
  B: '#3b82f6',
  C: '#f59e0b',
  D: '#ef4444',
};

function diffBar(value: number, max = 5, color = 'bg-matcha-500') {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${(value / max) * 100}%` }}
      />
    </div>
  );
}

function modColor(v: number) {
  if (v >= 0.95) return 'text-matcha-700';
  if (v >= 0.80) return 'text-amber-600';
  return 'text-red-600';
}

function buildChartData(rows: HistoryRow[]): ChartPoint[] {
  const byDate = new Map<string, ChartPoint>();
  for (const r of rows) {
    const label = r.snapshot_date.slice(5); // MM-DD
    if (!byDate.has(label)) byDate.set(label, { date: label });
    const pt = byDate.get(label)!;
    (pt as Record<string, unknown>)[r.zone] = Math.round(Number(r.avg_difficulty) * 10) / 10;
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

type TabKey = 'aktuell' | 'verlauf';

export function ZoneDifficultyClient() {
  const [activeTab, setActiveTab] = useState<TabKey>('aktuell');
  const [entries, setEntries] = useState<ZoneCacheEntry[]>([]);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [historyDays, setHistoryDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/admin/zone-difficulty?action=cache', { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json() as { cache?: ZoneCacheEntry[] };
      setEntries(json.cache ?? []);
      setLastRefresh(new Date());
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async (days: number) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/zone-difficulty?action=history&days=${days}`, { cache: 'no-store' });
      if (!res.ok) return;
      const json = await res.json() as { history?: HistoryRow[] };
      setChartData(buildChartData(json.history ?? []));
    } catch { /* ignore */ } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetchData]);

  useEffect(() => {
    if (activeTab === 'verlauf') fetchHistory(historyDays);
  }, [activeTab, historyDays, fetchHistory]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await fetch('/api/delivery/admin/zone-difficulty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refresh', days: 14 }),
      });
      await fetchData();
    } finally {
      setRefreshing(false);
    }
  };

  const hardZones = entries.filter((e) => e.avg_difficulty >= 3.5);
  const avgOverall = entries.length > 0
    ? entries.reduce((s, e) => s + e.avg_difficulty, 0) / entries.length
    : 0;

  const activeZones = Object.keys(ZONE_CHART_COLORS).filter((z) =>
    chartData.some((d) => (d as Record<string, unknown>)[z] !== undefined),
  );

  return (
    <div className="space-y-6">
      {/* Header KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-2xl font-black tabular-nums text-gray-800">{entries.length}</div>
          <div className="text-xs text-gray-500 mt-0.5">Zonen analysiert</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className={`text-2xl font-black tabular-nums ${avgOverall >= 3.5 ? 'text-amber-600' : 'text-matcha-600'}`}>
            {avgOverall > 0 ? avgOverall.toFixed(1) : '—'}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Ø Schwierigkeit</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className={`text-2xl font-black tabular-nums ${hardZones.length > 0 ? 'text-amber-600' : 'text-matcha-600'}`}>
            {hardZones.length}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Schwierige Zonen</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-2xl font-black tabular-nums text-blue-600">
            {entries.reduce((s, e) => s + e.sample_count, 0)}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Feedback-Einträge</div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 rounded-xl border border-gray-100 bg-gray-50 p-1 w-fit">
        {([['aktuell', 'Aktuell', BarChart2], ['verlauf', 'Verlauf 30 Tage', TrendingUp]] as const).map(([key, label, Icon]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as TabKey)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              activeTab === key
                ? 'bg-white shadow-sm text-gray-800'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Aktuell */}
      {activeTab === 'aktuell' && (
        <>
          {/* Alert */}
          {hardZones.length > 0 ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-800">
                  Dispatch angepasst für {hardZones.map((z) => `Zone ${z.zone}`).join(', ')}
                </p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Bundle-Kapazität und Detour-Toleranz wurden basierend auf Fahrer-Feedback reduziert.
                </p>
              </div>
            </div>
          ) : (
            !loading && entries.length > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-matcha-200 bg-matcha-50 p-4">
                <CheckCircle className="h-4 w-4 text-matcha-600 shrink-0" />
                <p className="text-sm text-matcha-700">Alle Zonen: normale Schwierigkeit. Keine Dispatch-Anpassungen aktiv.</p>
              </div>
            )
          )}

          {/* Zone Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {entries.map((e) => {
              const c = ZONE_COLORS_CSS[e.zone] ?? ZONE_COLORS_CSS.A;
              return (
                <div key={e.zone} className={`rounded-xl border p-4 ${c.card}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <MapPin className={`h-4 w-4 ${c.accent}`} />
                      <span className={`text-sm font-black ${c.accent}`}>Zone {e.zone}</span>
                      <span className="text-xs text-gray-500">{ZONE_LABELS[e.zone] ?? ''}</span>
                    </div>
                    <span className="text-[10px] text-gray-400">n={e.sample_count}</span>
                  </div>

                  <div className="space-y-2.5">
                    <div>
                      <div className="mb-1 flex justify-between text-[11px]">
                        <span className="text-gray-600">Ø Schwierigkeit</span>
                        <span className={`font-bold ${c.accent}`}>{e.avg_difficulty.toFixed(1)}/5</span>
                      </div>
                      {diffBar(e.avg_difficulty, 5, e.avg_difficulty >= 3.5 ? 'bg-amber-500' : e.avg_difficulty >= 4.5 ? 'bg-red-500' : c.bar)}
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-[11px]">
                        <span className="text-gray-600">Ø Verkehr</span>
                        <span className="font-bold text-gray-700">{e.avg_traffic.toFixed(1)}/5</span>
                      </div>
                      {diffBar(e.avg_traffic, 5, 'bg-blue-400')}
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {[
                      { label: 'Parken', value: e.issue_rate_parking },
                      { label: 'Navigation', value: e.issue_rate_nav },
                      { label: 'Adresse', value: e.issue_rate_address },
                    ].map((issue) => (
                      <div key={issue.label} className="rounded-lg bg-white/60 p-2 text-center">
                        <div className={`text-sm font-black tabular-nums ${issue.value > 20 ? 'text-red-600' : issue.value > 10 ? 'text-amber-600' : 'text-gray-600'}`}>
                          {issue.value.toFixed(0)}%
                        </div>
                        <div className="text-[9px] text-gray-500">{issue.label}</div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 flex gap-3 text-[10px]">
                    <div className="flex-1 rounded-md bg-white/70 p-2">
                      <div className="text-gray-500 mb-0.5">Bundle-Kap.</div>
                      <div className={`font-black tabular-nums ${modColor(e.stop_count_modifier)}`}>
                        {Math.round(e.stop_count_modifier * 100)}%
                      </div>
                    </div>
                    <div className="flex-1 rounded-md bg-white/70 p-2">
                      <div className="text-gray-500 mb-0.5">Detour-Tol.</div>
                      <div className={`font-black tabular-nums ${modColor(e.detour_modifier)}`}>
                        {Math.round(e.detour_modifier * 100)}%
                      </div>
                    </div>
                    <div className="flex-1 rounded-md bg-white/70 p-2">
                      <div className="text-gray-500 mb-0.5">Aktualisiert</div>
                      <div className="font-medium text-gray-600">
                        {new Date(e.computed_at).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {entries.length === 0 && !loading && (
            <div className="rounded-xl border border-dashed bg-white p-8 text-center">
              <BarChart2 className="mx-auto mb-2 h-8 w-8 text-gray-300" />
              <p className="text-sm text-gray-500">
                Noch kein Tour-Feedback für Zonen-Analyse. Wird automatisch nach den ersten Fahrer-Bewertungen befüllt.
              </p>
            </div>
          )}
        </>
      )}

      {/* Tab: Verlauf */}
      {activeTab === 'verlauf' && (
        <div className="space-y-4">
          {/* Zeitraum-Selektor */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Zeitraum:</span>
            {[14, 30, 60, 90].map((d) => (
              <button
                key={d}
                onClick={() => setHistoryDays(d)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                  historyDays === d
                    ? 'bg-blue-500 text-white'
                    : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                {d}T
              </button>
            ))}
          </div>

          {/* LineChart */}
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-1.5 mb-4">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-semibold text-gray-700">
                Ø Schwierigkeit pro Zone — {historyDays}-Tage-Trend
              </span>
            </div>

            {historyLoading ? (
              <div className="h-52 flex items-center justify-center">
                <BarChart2 className="w-8 h-8 text-gray-200 animate-pulse" />
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-center">
                <div>
                  <TrendingDown className="mx-auto mb-2 h-8 w-8 text-gray-200" />
                  <p className="text-sm text-gray-400">Noch keine historischen Daten.</p>
                  <p className="text-xs text-gray-400 mt-1">Täglich um 01:44 UTC werden Snapshots gespeichert.</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 5]}
                    ticks={[0, 1, 2, 3, 4, 5]}
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    tickLine={false}
                    axisLine={false}
                    label={{ value: 'Schwierigkeit', angle: -90, position: 'insideLeft', fontSize: 9, fill: '#d1d5db', offset: 16 }}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 11, padding: '6px 10px', borderRadius: 8, border: '1px solid #e5e7eb' }}
                    formatter={(v: number, name: string) => [`${v.toFixed(1)}/5`, `Zone ${name}`]}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={7}
                    wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
                    formatter={(v) => `Zone ${v}`}
                  />
                  {activeZones.map((z) => (
                    <Line
                      key={z}
                      type="monotone"
                      dataKey={z}
                      stroke={ZONE_CHART_COLORS[z]}
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Zone-Legende */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(ZONE_CHART_COLORS).map(([z, color]) => (
              <div key={z} className="flex items-center gap-2 rounded-lg border bg-white p-2.5 text-xs">
                <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <div>
                  <div className="font-semibold text-gray-700">Zone {z}</div>
                  <div className="text-gray-400">{ZONE_LABELS[z]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>
          Letzte Aktualisierung: {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          {' · '} Cron: stündlich · Snapshot: täglich 01:44 UTC
        </span>
        <button
          onClick={handleRefresh}
          disabled={refreshing || loading}
          className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Neu berechnen…' : 'Jetzt aktualisieren'}
        </button>
      </div>
    </div>
  );
}

export default ZoneDifficultyClient;
