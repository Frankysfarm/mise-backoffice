'use client';
import { useEffect, useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, BarChart, Bar,
} from 'recharts';
import {
  Star, TrendingUp, TrendingDown, Users, AlertTriangle,
  CheckCircle, RefreshCw, BarChart2, Calendar,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopDriver {
  driverId: string;
  driverName: string | null;
  avgRating: number;
  feedbackCount: number;
}

interface MonthEntry {
  month: string;
  periodStart: string;
  avgCustomerRating: number;
  avgDifficulty: number;
  avgTraffic: number;
  avgOverallScore: number;
  totalFeedbacks: number;
  parkingIssueRate: number;
  navIssueRate: number;
  addressIssueRate: number;
  customerIssueRate: number;
  activeDrivers: number;
}

interface Dashboard {
  kpis: {
    avgCustomerRatingThisWeek: number;
    avgCustomerRatingLastWeek: number;
    ratingTrend: number;
    totalFeedbacksThisWeek: number;
    avgDifficultyThisWeek: number;
    activeDriversWithFeedback: number;
    topRatedDriverName: string | null;
    topRatedScore: number | null;
  };
  monthlyTrend: MonthEntry[];
  topDrivers: TopDriver[];
  bottomDrivers: TopDriver[];
}

function KpiCard({ label, value, sub, color }: {
  label: string;
  value: string;
  sub?: string;
  color?: 'emerald' | 'amber' | 'red' | 'indigo';
}) {
  const tc = color === 'emerald' ? 'text-emerald-600' :
             color === 'amber'   ? 'text-amber-600' :
             color === 'red'     ? 'text-red-500' :
             color === 'indigo'  ? 'text-indigo-600' : 'text-slate-800';
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold', tc)}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function StarBadge({ rating }: { rating: number }) {
  const color = rating >= 4.5 ? 'text-emerald-600' : rating >= 3.5 ? 'text-amber-600' : 'text-red-500';
  return <span className={cn('font-bold', color)}>{rating > 0 ? `${rating.toFixed(1)}★` : '—'}</span>;
}

const TABS = ['Übersicht', 'Monatstrend', 'Fahrer-Rangliste'] as const;
type Tab = typeof TABS[number];

export function TourFeedbackAnalyticsClient() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [tab, setTab] = useState<Tab>('Übersicht');
  const [months, setMonths] = useState(3);
  const [loading, setLoading] = useState(true);
  const [aggregating, setAggregating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  const load = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const [dashRes, trendRes] = await Promise.all([
        fetch('/api/delivery/admin/tour-feedback-analytics?action=dashboard'),
        fetch(`/api/delivery/admin/tour-feedback-analytics?action=report&months=${months}`),
      ]);
      if (!dashRes.ok) return;
      const dash = await dashRes.json() as Dashboard;
      if (trendRes.ok) {
        const trendData = await trendRes.json() as { trend?: MonthEntry[] };
        dash.monthlyTrend = trendData.trend ?? dash.monthlyTrend;
      }
      setData(dash);
      setLastRefresh(new Date().toLocaleTimeString('de-DE'));
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const aggregate = async () => {
    setAggregating(true);
    try {
      await fetch('/api/delivery/admin/tour-feedback-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'aggregate', period_type: 'week' }),
      });
      await fetch('/api/delivery/admin/tour-feedback-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'aggregate', period_type: 'month' }),
      });
      await load(true);
    } catch { /* ignore */ } finally {
      setAggregating(false);
    }
  };

  useEffect(() => { load(); }, [months]);

  if (loading) return <div className="p-8 text-slate-400">Lade Feedback-Analytics…</div>;
  if (!data) return <div className="p-8 text-slate-400">Keine Daten verfügbar.</div>;

  const { kpis, monthlyTrend, topDrivers, bottomDrivers } = data;

  const chartData = monthlyTrend.map((e) => ({
    name: e.month,
    Zufriedenheit: e.avgCustomerRating,
    Schwierigkeit: e.avgDifficulty,
    GesamtScore:   e.avgOverallScore,
    Feedbacks:     e.totalFeedbacks,
  }));

  const issueData = monthlyTrend.map((e) => ({
    name: e.month,
    Parken: e.parkingIssueRate,
    Navigation: e.navIssueRate,
    Adresse: e.addressIssueRate,
    Kunde: e.customerIssueRate,
  }));

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Feedback Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Wöchentliche & monatliche Aggregation der Tour-Fahrer-Bewertungen
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs text-slate-400">Aktualisiert: {lastRefresh}</span>
          )}
          <button
            onClick={aggregate}
            disabled={aggregating}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            <BarChart2 className={cn('h-3.5 w-3.5', aggregating && 'animate-spin')} />
            {aggregating ? 'Aggregiere…' : 'Aggregieren'}
          </button>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            Aktualisieren
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Ø Zufriedenheit (Woche)"
          value={kpis.avgCustomerRatingThisWeek > 0 ? `${kpis.avgCustomerRatingThisWeek.toFixed(1)}★` : '—'}
          sub={kpis.ratingTrend !== 0 ? `${kpis.ratingTrend > 0 ? '+' : ''}${kpis.ratingTrend.toFixed(1)} vs. Vorwoche` : undefined}
          color={kpis.avgCustomerRatingThisWeek >= 4.5 ? 'emerald' : kpis.avgCustomerRatingThisWeek >= 3.5 ? 'amber' : 'red'}
        />
        <KpiCard
          label="Bewertungen diese Woche"
          value={kpis.totalFeedbacksThisWeek.toString()}
          sub="Tour-Feedbacks"
        />
        <KpiCard
          label="Ø Schwierigkeit"
          value={kpis.avgDifficultyThisWeek > 0 ? `${kpis.avgDifficultyThisWeek.toFixed(1)}/5` : '—'}
          sub="diese Woche"
          color={kpis.avgDifficultyThisWeek >= 4 ? 'red' : kpis.avgDifficultyThisWeek >= 3 ? 'amber' : 'emerald'}
        />
        <KpiCard
          label="Fahrer mit Feedback"
          value={kpis.activeDriversWithFeedback.toString()}
          sub={kpis.topRatedDriverName ? `Top: ${kpis.topRatedDriverName}` : undefined}
          color="indigo"
        />
      </div>

      {/* Alert banner */}
      {kpis.avgCustomerRatingThisWeek > 0 && kpis.avgCustomerRatingThisWeek < 3.5 && (
        <div className="flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-sm text-red-700">
            Kundenzufriedenheit unter 3.5 — sofortige Maßnahmen empfohlen. Fahrer-Coaching und Route-Optimierung prüfen.
          </p>
        </div>
      )}
      {kpis.avgCustomerRatingThisWeek >= 4.5 && (
        <div className="flex items-center gap-3 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
          <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
          <p className="text-sm text-emerald-700">
            Exzellente Kundenzufriedenheit {kpis.avgCustomerRatingThisWeek.toFixed(1)}★ — Team leistet hervorragende Arbeit.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition',
              tab === t ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700',
            )}
          >{t}</button>
        ))}
      </div>

      {/* Tab: Übersicht */}
      {tab === 'Übersicht' && (
        <div className="space-y-4">
          {chartData.length > 0 ? (
            <div className="rounded-xl border bg-white p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-slate-700">Zufriedenheits-Trend</p>
                <select
                  value={months}
                  onChange={(e) => setMonths(Number(e.target.value))}
                  className="text-xs border rounded-lg px-2 py-1"
                >
                  <option value={3}>3 Monate</option>
                  <option value={6}>6 Monate</option>
                  <option value={12}>12 Monate</option>
                </select>
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gRating" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gDiff" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: unknown, name: unknown) => {
                      const n = typeof value === 'number' ? value : undefined;
                      return [n != null ? n.toFixed(2) : '—', String(name)];
                    }}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="Zufriedenheit" stroke="#f59e0b" strokeWidth={2} fill="url(#gRating)" dot={{ r: 3 }} />
                  <Area type="monotone" dataKey="Schwierigkeit" stroke="#ef4444" strokeWidth={1.5} fill="url(#gDiff)" dot={{ r: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="rounded-xl border bg-slate-50 p-8 text-center text-slate-400 text-sm">
              Noch keine Monats-Aggregate verfügbar. Bitte Aggregieren klicken.
            </div>
          )}
        </div>
      )}

      {/* Tab: Monatstrend */}
      {tab === 'Monatstrend' && (
        <div className="space-y-4">
          {issueData.length > 0 ? (
            <div className="rounded-xl border bg-white p-4">
              <p className="text-sm font-semibold text-slate-700 mb-3">Issue-Raten nach Typ (%)</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={issueData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(value: unknown, name: unknown) => {
                      const n = typeof value === 'number' ? value : undefined;
                      return [n != null ? `${n.toFixed(1)}%` : '—', String(name)];
                    }}
                  />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="Parken" fill="#6366f1" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Navigation" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Adresse" fill="#10b981" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="Kunde" fill="#ef4444" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : null}

          {/* Monthly table */}
          {monthlyTrend.length > 0 && (
            <div className="rounded-xl border bg-white overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    {['Monat', 'Zufriedenheit', 'Feedbacks', 'Fahrer', 'Schwierigkeit', 'Verkehr'].map((h) => (
                      <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-slate-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...monthlyTrend].reverse().map((e) => (
                    <tr key={e.month} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-xs font-medium text-slate-700">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3 w-3 text-slate-400" />{e.month}
                        </div>
                      </td>
                      <td className="px-3 py-2"><StarBadge rating={e.avgCustomerRating} /></td>
                      <td className="px-3 py-2 text-xs text-slate-600">{e.totalFeedbacks}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{e.activeDrivers}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{e.avgDifficulty > 0 ? `${e.avgDifficulty.toFixed(1)}/5` : '—'}</td>
                      <td className="px-3 py-2 text-xs text-slate-600">{e.avgTraffic > 0 ? `${e.avgTraffic.toFixed(1)}/5` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Fahrer-Rangliste */}
      {tab === 'Fahrer-Rangliste' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-white overflow-hidden">
            <div className="px-4 py-3 bg-emerald-50 border-b">
              <p className="text-sm font-semibold text-emerald-700 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" /> Top Fahrer (Zufriedenheit)
              </p>
            </div>
            {topDrivers.length === 0 ? (
              <p className="p-4 text-sm text-slate-400">Noch keine Daten.</p>
            ) : (
              <div className="divide-y">
                {topDrivers.map((d, i) => (
                  <div key={d.driverId} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-sm font-bold text-slate-400 w-5">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {d.driverName ?? d.driverId.slice(0, 8)}
                      </p>
                      <p className="text-xs text-slate-400">{d.feedbackCount} Bewertungen</p>
                    </div>
                    <StarBadge rating={d.avgRating} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border bg-white overflow-hidden">
            <div className="px-4 py-3 bg-red-50 border-b">
              <p className="text-sm font-semibold text-red-700 flex items-center gap-1.5">
                <TrendingDown className="h-4 w-4" /> Coaching-Bedarf
              </p>
            </div>
            {bottomDrivers.length === 0 ? (
              <p className="p-4 text-sm text-slate-400">Noch keine Daten.</p>
            ) : (
              <div className="divide-y">
                {bottomDrivers.map((d, i) => (
                  <div key={d.driverId} className="flex items-center gap-3 px-4 py-3">
                    <Users className="h-3.5 w-3.5 text-slate-300 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {d.driverName ?? d.driverId.slice(0, 8)}
                      </p>
                      <p className="text-xs text-slate-400">{d.feedbackCount} Bewertungen</p>
                    </div>
                    <StarBadge rating={d.avgRating} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

