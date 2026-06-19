'use client';

import { useEffect, useState, useCallback } from 'react';
import type { LocationHealthDashboard, LocationHealthSnapshot, HealthTrendRow } from '@/lib/delivery/location-health-score';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  RefreshCw, Clock, Users, XCircle, Star, TrendingUp, TrendingDown, Minus,
  HeartPulse, AlertCircle, CheckCircle,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const REFRESH_INTERVAL = 300;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gradeColor(g: string) {
  if (g === 'A+') return 'text-emerald-300';
  if (g === 'A')  return 'text-emerald-400';
  if (g === 'B+') return 'text-lime-400';
  if (g === 'B')  return 'text-lime-500';
  if (g === 'C')  return 'text-amber-400';
  if (g === 'D')  return 'text-orange-400';
  return 'text-red-400';
}

function gradeBg(g: string) {
  if (g === 'A+' || g === 'A') return 'bg-emerald-500/10 border-emerald-500/30';
  if (g === 'B+' || g === 'B') return 'bg-lime-500/10 border-lime-500/20';
  if (g === 'C')  return 'bg-amber-500/10 border-amber-500/20';
  if (g === 'D')  return 'bg-orange-500/10 border-orange-500/20';
  return 'bg-red-500/10 border-red-500/20';
}

function scoreColor(s: number) {
  if (s >= 80) return 'text-emerald-400';
  if (s >= 65) return 'text-lime-400';
  if (s >= 50) return 'text-amber-400';
  if (s >= 35) return 'text-orange-400';
  return 'text-red-400';
}

function scoreBg(s: number) {
  if (s >= 80) return 'bg-emerald-500';
  if (s >= 65) return 'bg-lime-400';
  if (s >= 50) return 'bg-amber-400';
  if (s >= 35) return 'bg-orange-400';
  return 'bg-red-500';
}

function scoreStroke(s: number) {
  if (s >= 80) return '#10b981';
  if (s >= 65) return '#a3e635';
  if (s >= 50) return '#f59e0b';
  if (s >= 35) return '#f97316';
  return '#ef4444';
}

function fmt(v: number | null | undefined, dec = 1, suffix = '') {
  if (v == null) return <span className="text-gray-500">—</span>;
  return <>{v.toFixed(dec)}{suffix}</>;
}

function fmtDate(d: string) {
  return d.slice(5); // MM-DD
}

// ─── Score Arc ────────────────────────────────────────────────────────────────

function ScoreArc({ score }: { score: number }) {
  const R = 52; const CX = 64; const CY = 64;
  const startAngle = -210; const sweep = 240;
  const pct = Math.min(1, score / 100);
  const toRad = (d: number) => (d * Math.PI) / 180;
  const arcPt = (deg: number) => ({
    x: CX + R * Math.cos(toRad(deg)),
    y: CY + R * Math.sin(toRad(deg)),
  });
  const s = arcPt(startAngle);
  const e = arcPt(startAngle + sweep);
  const a = arcPt(startAngle + sweep * pct);
  const la = sweep * pct > 180 ? 1 : 0;
  const trackD = `M ${s.x} ${s.y} A ${R} ${R} 0 1 1 ${e.x} ${e.y}`;
  const fillD  = pct < 0.001 ? '' : `M ${s.x} ${s.y} A ${R} ${R} 0 ${la} 1 ${a.x} ${a.y}`;
  const color  = scoreStroke(score);
  return (
    <svg width={128} height={128} className="mx-auto">
      <path d={trackD} fill="none" stroke="#1f2937" strokeWidth={10} strokeLinecap="round" />
      {fillD && <path d={fillD} fill="none" stroke={color} strokeWidth={10} strokeLinecap="round" />}
      <text x={CX} y={CY - 4} textAnchor="middle" className="fill-white font-bold" fontSize={22}>{score}</text>
      <text x={CX} y={CY + 14} textAnchor="middle" className="fill-gray-400" fontSize={10}>/ 100</text>
    </svg>
  );
}

// ─── Dimension Bar ────────────────────────────────────────────────────────────

function DimBar({ label, score, weight, raw }: { label: string; score: number; weight: string; raw: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-gray-300 font-medium">{label}</span>
        <span className="text-gray-500">{weight}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${scoreBg(score)}`}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className={`text-xs font-bold w-10 text-right ${scoreColor(score)}`}>{score}</span>
        <span className="text-xs text-gray-500 w-20 text-right">{raw}</span>
      </div>
    </div>
  );
}

// ─── Trend Icon ───────────────────────────────────────────────────────────────

function TrendIcon({ trend, delta }: { trend: string; delta: number }) {
  if (trend === 'up')   return <span className="flex items-center gap-1 text-emerald-400 text-xs"><TrendingUp className="h-3 w-3" />+{delta}</span>;
  if (trend === 'down') return <span className="flex items-center gap-1 text-red-400 text-xs"><TrendingDown className="h-3 w-3" />{delta}</span>;
  return <span className="flex items-center gap-1 text-gray-500 text-xs"><Minus className="h-3 w-3" />stabil</span>;
}

// ─── Main Client ─────────────────────────────────────────────────────────────

type Tab = 'overview' | 'trend' | 'ranking';

export function LocationHealthClient() {
  const [dashboard, setDashboard] = useState<LocationHealthDashboard | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [snapping,  setSnapping]  = useState(false);
  const [tab,       setTab]       = useState<Tab>('overview');
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch('/api/delivery/admin/location-health?action=dashboard');
      const data = await res.json() as LocationHealthDashboard;
      setDashboard(data);
    } finally {
      setLoading(false);
      setCountdown(REFRESH_INTERVAL);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const iv = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) { void load(); return REFRESH_INTERVAL; }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [load]);

  const handleSnapshot = async () => {
    setSnapping(true);
    try {
      await fetch('/api/delivery/admin/location-health', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snapshot' }),
      });
      await load();
    } finally {
      setSnapping(false);
    }
  };

  const latest = dashboard?.latest ?? null;

  return (
    <div className="space-y-4">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(['overview', 'trend', 'ranking'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                tab === t
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              {t === 'overview' ? 'Übersicht' : t === 'trend' ? 'Verlauf' : 'Ranking'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Refresh in {countdown}s</span>
          <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="sm" variant="outline" onClick={() => void handleSnapshot()} disabled={snapping}>
            {snapping ? 'Snapshotten…' : 'Jetzt snapshooten'}
          </Button>
        </div>
      </div>

      {/* ── KPI-Karten ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          icon={<HeartPulse className="h-5 w-5 text-indigo-400" />}
          label="Gesundheits-Score"
          value={latest?.overallScore != null ? `${latest.overallScore}` : '—'}
          sub={latest ? <span className={`text-sm font-bold ${gradeColor(latest.grade)}`}>Note {latest.grade}</span> : undefined}
          loading={loading}
        />
        <KpiCard
          icon={<Clock className="h-5 w-5 text-emerald-400" />}
          label="Pünktlichkeit"
          value={latest?.onTimeRatePct != null ? `${latest.onTimeRatePct.toFixed(1)}%` : '—'}
          sub={latest ? `${latest.onTimeCount} / ${latest.totalDeliveries} Lieferungen` : undefined}
          loading={loading}
        />
        <KpiCard
          icon={<XCircle className="h-5 w-5 text-red-400" />}
          label="Stornoquote"
          value={latest?.cancelRatePct != null ? `${latest.cancelRatePct.toFixed(1)}%` : '—'}
          sub={latest ? `${latest.cancelCount} Stornierungen` : undefined}
          loading={loading}
        />
        <KpiCard
          icon={<Star className="h-5 w-5 text-amber-400" />}
          label="Kundenbewertung"
          value={latest?.avgRating != null ? `${latest.avgRating.toFixed(2)} ★` : '—'}
          sub={latest ? `${latest.ratedOrders} Bewertungen` : undefined}
          loading={loading}
        />
      </div>

      {/* ── Tab: Übersicht ─────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Score-Gauge + Dimensionen */}
          <Card className="bg-gray-900 border-gray-800 p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Gesamt</p>
                {latest ? (
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-3xl font-bold ${scoreColor(latest.overallScore)}`}>
                      {latest.overallScore}
                    </span>
                    <span className={`px-2 py-0.5 rounded border text-sm font-bold ${gradeBg(latest.grade)} ${gradeColor(latest.grade)}`}>
                      {latest.grade}
                    </span>
                    <TrendIcon trend={latest.trend} delta={latest.scoreDelta} />
                  </div>
                ) : (
                  <span className="text-gray-500 text-sm">Noch kein Snapshot</span>
                )}
              </div>
              {latest && <ScoreArc score={latest.overallScore} />}
            </div>

            {latest && (
              <div className="space-y-3 pt-2 border-t border-gray-800">
                <DimBar
                  label="Pünktlichkeit"
                  score={latest.onTimeScore}
                  weight="40%"
                  raw={latest.onTimeRatePct != null ? `${latest.onTimeRatePct.toFixed(1)}%` : '—'}
                />
                <DimBar
                  label="Fahrerverfügbarkeit"
                  score={latest.driverScore}
                  weight="25%"
                  raw={`${latest.driversOnline} / ${latest.driversNeeded} Fahrer`}
                />
                <DimBar
                  label="Stornoquote (inv.)"
                  score={latest.cancelScore}
                  weight="20%"
                  raw={latest.cancelRatePct != null ? `${latest.cancelRatePct.toFixed(1)}%` : '—'}
                />
                <DimBar
                  label="Kundenzufriedenheit"
                  score={latest.ratingScore}
                  weight="15%"
                  raw={latest.avgRating != null ? `${latest.avgRating.toFixed(2)} ★` : '—'}
                />
              </div>
            )}

            {latest && (
              <p className="text-xs text-gray-500">
                Snapshot: {latest.scoreDate} · {latest.snappedAt ? new Date(latest.snappedAt).toLocaleTimeString('de') : '—'}
              </p>
            )}
          </Card>

          {/* Empfehlungen */}
          <Card className="bg-gray-900 border-gray-800 p-6 space-y-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold">Empfehlungen</p>
            {!dashboard ? (
              <p className="text-gray-500 text-sm">Lade…</p>
            ) : (dashboard.recommendations ?? []).map((rec, i) => (
              <div key={i} className="flex items-start gap-2">
                {rec.includes('grünen') ? (
                  <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                )}
                <p className="text-sm text-gray-300">{rec}</p>
              </div>
            ))}

            {/* Fahrer-Karte */}
            {latest && (
              <div className="mt-4 pt-4 border-t border-gray-800 grid grid-cols-2 gap-3">
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Fahrer online</p>
                  <p className={`text-xl font-bold mt-1 ${latest.driversOnline >= latest.driversNeeded ? 'text-emerald-400' : 'text-red-400'}`}>
                    {latest.driversOnline}
                  </p>
                  <p className="text-xs text-gray-500">Bedarf: {latest.driversNeeded}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Bestellungen (Tag)</p>
                  <p className="text-xl font-bold mt-1 text-white">{latest.totalOrders}</p>
                  <p className="text-xs text-gray-500">{latest.totalDeliveries} Lieferungen</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── Tab: Verlauf ───────────────────────────────────────────── */}
      {tab === 'trend' && (
        <TrendTab trend={dashboard?.trend ?? []} loading={loading} />
      )}

      {/* ── Tab: Ranking ───────────────────────────────────────────── */}
      {tab === 'ranking' && (
        <RankingTab ranking={dashboard?.ranking ?? []} loading={loading} />
      )}
    </div>
  );
}

// ─── KPI-Karte ───────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, sub, loading,
}: {
  icon: React.ReactNode; label: string;
  value: string; sub?: React.ReactNode; loading: boolean;
}) {
  return (
    <Card className="bg-gray-900 border-gray-800 p-4">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-gray-400 uppercase tracking-wide">{label}</span>
      </div>
      {loading ? (
        <div className="h-7 bg-gray-800 rounded animate-pulse w-20" />
      ) : (
        <p className="text-2xl font-bold text-white">{value}</p>
      )}
      {sub && !loading && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </Card>
  );
}

// ─── Trend-Tab ───────────────────────────────────────────────────────────────

function TrendTab({ trend, loading }: { trend: HealthTrendRow[]; loading: boolean }) {
  if (loading) return <Card className="bg-gray-900 border-gray-800 p-6 h-48 animate-pulse" />;
  if (trend.length === 0) return (
    <Card className="bg-gray-900 border-gray-800 p-6">
      <p className="text-gray-500 text-sm text-center">Noch keine Verlaufsdaten. Snapshot täglich um 03:15 UTC.</p>
    </Card>
  );

  const chartData = trend.map(r => ({
    date:    fmtDate(r.scoreDate),
    Gesamt:  r.overallScore,
    Pünktlichkeit: r.onTimeScore,
    Fahrer:  r.driverScore,
    Storno:  r.cancelScore,
    Rating:  r.ratingScore,
  }));

  return (
    <Card className="bg-gray-900 border-gray-800 p-6 space-y-4">
      <p className="text-sm font-medium text-gray-300">Score-Verlauf (30 Tage)</p>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} />
          <YAxis domain={[0, 100]} tick={{ fill: '#6b7280', fontSize: 10 }} />
          <Tooltip
            contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 6 }}
            labelStyle={{ color: '#9ca3af', fontSize: 11 }}
            itemStyle={{ fontSize: 12 }}
          />
          <Line type="monotone" dataKey="Gesamt"  stroke="#6366f1" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="Pünktlichkeit" stroke="#10b981" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          <Line type="monotone" dataKey="Fahrer"  stroke="#3b82f6" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          <Line type="monotone" dataKey="Storno"  stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
          <Line type="monotone" dataKey="Rating"  stroke="#a855f7" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
        </LineChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-4 justify-center text-xs text-gray-500">
        {[
          { color: '#6366f1', label: 'Gesamt' },
          { color: '#10b981', label: 'Pünktlichkeit (40%)' },
          { color: '#3b82f6', label: 'Fahrer (25%)' },
          { color: '#f59e0b', label: 'Storno (20%)' },
          { color: '#a855f7', label: 'Rating (15%)' },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 rounded" style={{ background: color }} />
            {label}
          </span>
        ))}
      </div>
    </Card>
  );
}

// ─── Ranking-Tab ─────────────────────────────────────────────────────────────

function RankingTab({
  ranking, loading,
}: {
  ranking: LocationHealthDashboard['ranking'];
  loading: boolean;
}) {
  if (loading) return <Card className="bg-gray-900 border-gray-800 p-6 h-48 animate-pulse" />;
  if (ranking.length === 0) return (
    <Card className="bg-gray-900 border-gray-800 p-6">
      <p className="text-gray-500 text-sm text-center">Keine Ranking-Daten verfügbar.</p>
    </Card>
  );

  return (
    <Card className="bg-gray-900 border-gray-800 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-left">
            <th className="px-4 py-3 text-xs text-gray-500 font-medium w-12">#</th>
            <th className="px-4 py-3 text-xs text-gray-500 font-medium">Standort</th>
            <th className="px-4 py-3 text-xs text-gray-500 font-medium text-right">Score</th>
            <th className="px-4 py-3 text-xs text-gray-500 font-medium text-center">Note</th>
            <th className="px-4 py-3 text-xs text-gray-500 font-medium text-right">Trend</th>
          </tr>
        </thead>
        <tbody>
          {ranking.map((loc) => (
            <tr key={loc.locationId} className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
              <td className="px-4 py-3">
                <span className="text-gray-400 font-mono text-xs">
                  {loc.healthRank === 1 ? '🥇' : loc.healthRank === 2 ? '🥈' : loc.healthRank === 3 ? '🥉' : `#${loc.healthRank}`}
                </span>
              </td>
              <td className="px-4 py-3 text-gray-200">{loc.locationName}</td>
              <td className="px-4 py-3 text-right">
                <span className={`font-bold ${scoreColor(loc.overallScore)}`}>{loc.overallScore}</span>
              </td>
              <td className="px-4 py-3 text-center">
                <span className={`px-2 py-0.5 rounded text-xs font-bold border ${gradeBg(loc.grade)} ${gradeColor(loc.grade)}`}>
                  {loc.grade}
                </span>
              </td>
              <td className="px-4 py-3 text-right">
                <TrendIcon trend={loc.trend} delta={loc.scoreDelta} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
