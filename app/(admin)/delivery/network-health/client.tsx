'use client';

import { useEffect, useState, useCallback } from 'react';
import type {
  NetworkHealthDashboard,
  NetworkHealthSnapshot,
  NetworkInsight,
  NetworkHealthTrendPoint,
  NetworkGrade,
} from '@/lib/delivery/network-health';

// ─── Typen ────────────────────────────────────────────────────────────────────

interface ApiResponse extends NetworkHealthDashboard {
  ok: boolean;
}

// ─── Grade-Hilfsfunktionen ───────────────────────────────────────────────────

const GRADE_LABEL: Record<NetworkGrade, string> = {
  excellent: 'Ausgezeichnet',
  good: 'Gut',
  fair: 'Ausreichend',
  poor: 'Schlecht',
  critical: 'Kritisch',
};

const GRADE_BG: Record<NetworkGrade, string> = {
  excellent: 'bg-emerald-100 text-emerald-800',
  good: 'bg-green-100 text-green-800',
  fair: 'bg-amber-100 text-amber-800',
  poor: 'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800',
};

const GRADE_STROKE: Record<NetworkGrade, string> = {
  excellent: '#10b981',
  good: '#22c55e',
  fair: '#f59e0b',
  poor: '#f97316',
  critical: '#ef4444',
};

// ─── SVG Arc-Gauge ────────────────────────────────────────────────────────────

function NetworkGaugeArc({ score, grade }: { score: number; grade: NetworkGrade }) {
  const r = 70;
  const cx = 90;
  const cy = 90;
  const startAngle = -210;
  const endAngle = 30;
  const totalAngle = endAngle - startAngle; // 240°

  function polarToXY(angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  function describeArc(start: number, end: number) {
    const s = polarToXY(start);
    const e = polarToXY(end);
    const large = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  const fillAngle = startAngle + (score / 100) * totalAngle;
  const color = GRADE_STROKE[grade];

  return (
    <svg viewBox="0 0 180 120" className="w-52 h-36">
      {/* Track */}
      <path
        d={describeArc(startAngle, endAngle)}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="12"
        strokeLinecap="round"
      />
      {/* Fill */}
      {score > 0 && (
        <path
          d={describeArc(startAngle, fillAngle)}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
        />
      )}
      {/* Score */}
      <text x={cx} y={cy + 10} textAnchor="middle" className="text-2xl font-bold" fontSize="28" fontWeight="700" fill={color}>
        {Math.round(score)}
      </text>
      <text x={cx} y={cy + 26} textAnchor="middle" fontSize="10" fill="#6b7280">
        / 100
      </text>
    </svg>
  );
}

// ─── KPI-Karte ────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Faktoren-Balken ─────────────────────────────────────────────────────────

function FactorBar({ insight }: { insight: NetworkInsight }) {
  const severityColor =
    insight.severity === 'ok'
      ? 'bg-emerald-500'
      : insight.severity === 'warn'
      ? 'bg-amber-400'
      : 'bg-red-500';

  const textColor =
    insight.severity === 'ok'
      ? 'text-emerald-700'
      : insight.severity === 'warn'
      ? 'text-amber-700'
      : 'text-red-700';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-700">{insight.label}</span>
        <span className={`font-bold text-xs ${textColor}`}>
          {insight.score.toFixed(1)} / {insight.maxScore}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${severityColor}`}
          style={{ width: `${insight.pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400">{insight.hint}</p>
    </div>
  );
}

// ─── Trend-Chart ─────────────────────────────────────────────────────────────

function TrendChart({ points }: { points: NetworkHealthTrendPoint[] }) {
  if (points.length === 0) {
    return (
      <div className="h-32 flex items-center justify-center text-sm text-gray-400">
        Noch keine Verlaufsdaten
      </div>
    );
  }

  const maxScore = 100;
  const h = 96;
  const w = 100;

  const lastPoints = points.slice(-48);
  const step = w / Math.max(lastPoints.length - 1, 1);

  const pts = lastPoints.map((p, i) => ({
    x: i * step,
    y: h - (p.avgScore / maxScore) * h,
    score: p.avgScore,
    hour: new Date(p.hour).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
  }));

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  function scoreColor(s: number) {
    if (s >= 85) return '#10b981';
    if (s >= 70) return '#22c55e';
    if (s >= 50) return '#f59e0b';
    if (s >= 30) return '#f97316';
    return '#ef4444';
  }

  return (
    <svg viewBox={`0 0 ${w} ${h + 8}`} className="w-full h-32" preserveAspectRatio="none">
      <defs>
        <linearGradient id="nw-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <path
        d={`${pathD} L ${pts[pts.length - 1].x} ${h} L 0 ${h} Z`}
        fill="url(#nw-grad)"
      />
      {/* Line */}
      <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinejoin="round" />
      {/* Score dots (every 6th) */}
      {pts.filter((_, i) => i % 6 === 0).map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2" fill={scoreColor(p.score)} />
      ))}
    </svg>
  );
}

// ─── Snapshot-Tabelle ────────────────────────────────────────────────────────

function SnapshotTable({ snaps }: { snaps: NetworkHealthSnapshot[] }) {
  if (snaps.length === 0) {
    return <p className="text-sm text-gray-400">Keine Snapshots vorhanden</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs text-left">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="pb-2 pr-4">Zeitpunkt</th>
            <th className="pb-2 pr-4">Score</th>
            <th className="pb-2 pr-4">Grade</th>
            <th className="pb-2 pr-4">On-Time</th>
            <th className="pb-2 pr-4">Rating</th>
            <th className="pb-2 pr-4">Auslastung</th>
            <th className="pb-2">Storno</th>
          </tr>
        </thead>
        <tbody>
          {snaps.map((s) => (
            <tr key={s.id} className="border-b last:border-0">
              <td className="py-1.5 pr-4 text-gray-600">
                {new Date(s.capturedAt).toLocaleString('de-DE', {
                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                })}
              </td>
              <td className={`py-1.5 pr-4 font-bold ${
                s.grade === 'excellent' ? 'text-emerald-600' :
                s.grade === 'good' ? 'text-green-600' :
                s.grade === 'fair' ? 'text-amber-600' :
                s.grade === 'poor' ? 'text-orange-600' : 'text-red-600'
              }`}>
                {Math.round(s.healthScore)}
              </td>
              <td className="py-1.5 pr-4">
                <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${GRADE_BG[s.grade]}`}>
                  {GRADE_LABEL[s.grade]}
                </span>
              </td>
              <td className="py-1.5 pr-4 text-gray-700">
                {s.onTimeRatePct !== null ? `${s.onTimeRatePct}%` : '–'}
              </td>
              <td className="py-1.5 pr-4 text-gray-700">
                {s.avgRating !== null ? `★ ${s.avgRating.toFixed(1)}` : '–'}
              </td>
              <td className="py-1.5 pr-4 text-gray-700">
                {s.driverUtilizationPct !== null ? `${s.driverUtilizationPct}%` : '–'}
              </td>
              <td className="py-1.5 text-gray-700">
                {s.cancellationRatePct !== null ? `${s.cancellationRatePct}%` : '–'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Haupt-Client-Komponente ─────────────────────────────────────────────────

export function NetworkHealthClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapping, setSnapping] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'trend' | 'history'>('overview');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/admin/network-health?location_id=${locationId}`);
      if (res.ok) setData(await res.json() as ApiResponse);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), 30_000);
    return () => clearInterval(id);
  }, [load]);

  const triggerSnapshot = async () => {
    setSnapping(true);
    try {
      await fetch(`/api/delivery/admin/network-health?location_id=${locationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snapshot' }),
      });
      await load();
    } finally {
      setSnapping(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-400 text-sm animate-pulse">
        Lade Netzwerk-Gesundheit…
      </div>
    );
  }

  const cur = data?.current ?? null;
  const insights = data?.insights ?? [];
  const trend7d = data?.trend7d ?? [];
  const history = data?.recentSnapshots ?? [];

  const weakest = [...insights].sort((a, b) => a.pct - b.pct).slice(0, 2);

  return (
    <div className="space-y-6">
      {/* ── Header: Gauge + Grade + KPIs ─────────────────────────── */}
      <div className="bg-white rounded-2xl border p-6">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          {/* Gauge */}
          <div className="flex flex-col items-center">
            {cur ? (
              <>
                <NetworkGaugeArc score={cur.healthScore} grade={cur.grade} />
                <span className={`mt-2 px-3 py-1 rounded-full text-sm font-semibold ${GRADE_BG[cur.grade]}`}>
                  {GRADE_LABEL[cur.grade]}
                </span>
                <p className="mt-1 text-xs text-gray-400">
                  {new Date(cur.capturedAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center w-52 h-36 text-gray-400 text-sm">
                Kein Snapshot vorhanden
              </div>
            )}
          </div>

          {/* KPI-Band */}
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-3">
            <KpiCard
              label="On-Time-Rate"
              value={cur?.onTimeRatePct !== null ? `${cur?.onTimeRatePct}%` : '–'}
              sub="letzte 24 h"
            />
            <KpiCard
              label="Ø Bewertung"
              value={cur?.avgRating !== null ? `★ ${cur?.avgRating?.toFixed(1)}` : '–'}
              sub="letzte 7 Tage"
            />
            <KpiCard
              label="Fahrer online"
              value={cur?.activeDrivers ?? 0}
              sub={`${cur?.pendingOrders ?? 0} offene Bestellungen`}
            />
            <KpiCard
              label="Dispatch-Wartezeit"
              value={cur?.avgDispatchWaitMin !== null ? `${cur?.avgDispatchWaitMin} Min` : '–'}
              sub="Ø bis Zuweisung"
            />
            <KpiCard
              label="Stornierungsrate"
              value={cur?.cancellationRatePct !== null ? `${cur?.cancellationRatePct}%` : '–'}
              sub="letzte 24 h"
            />
            <KpiCard
              label="Auslastung"
              value={cur?.driverUtilizationPct !== null ? `${cur?.driverUtilizationPct}%` : '–'}
              sub="aktive Touren / Fahrer"
            />
          </div>
        </div>

        {/* Snapshot-Button */}
        <div className="mt-4 flex items-center justify-between border-t pt-4">
          <p className="text-xs text-gray-400">
            Automatisches Update alle 30 Min · Live-Reload alle 30 s
          </p>
          <button
            onClick={triggerSnapshot}
            disabled={snapping}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {snapping ? 'Berechne…' : 'Jetzt Snapshot'}
          </button>
        </div>
      </div>

      {/* ── Schwachstellen-Banner ──────────────────────────────────── */}
      {weakest.filter((w) => w.severity !== 'ok').length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-amber-800 mb-2">Schwächste Faktoren</p>
          <div className="space-y-1">
            {weakest
              .filter((w) => w.severity !== 'ok')
              .map((w) => (
                <div key={w.factor} className="flex items-center gap-2 text-sm">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      w.severity === 'critical' ? 'bg-red-500' : 'bg-amber-400'
                    }`}
                  />
                  <span className="text-amber-900 font-medium">{w.label}:</span>
                  <span className="text-amber-700">{w.hint}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
        {(['overview', 'trend', 'history'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition ${
              activeTab === tab
                ? 'bg-white text-gray-900 shadow'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'overview' ? '7 Faktoren' : tab === 'trend' ? '7-Tage-Verlauf' : 'Verlauf'}
          </button>
        ))}
      </div>

      {/* ── Tab: 7 Faktoren ──────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="bg-white rounded-xl border p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-900">Faktoren-Aufschlüsselung</h3>
            <p className="text-xs text-gray-400">Gewichtung: 25 · 20 · 15 · 15 · 10 · 10 · 5</p>
          </div>
          {insights.length > 0 ? (
            insights.map((ins) => <FactorBar key={ins.factor} insight={ins} />)
          ) : (
            <p className="text-sm text-gray-400">Kein aktueller Snapshot — bitte Snapshot auslösen.</p>
          )}
          <div className="border-t pt-4">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Score-Formel</h4>
            <p className="text-xs text-gray-500">
              Gesamt-Score = Pünktlichkeit (0–25) + Zufriedenheit (0–20) + Auslastung (0–15) +
              Dispatch (0–15) + Stornierungen (0–10) + Kapazität (0–10) + Profitabilität (0–5)
            </p>
            <div className="mt-2 grid grid-cols-5 gap-1 text-xs text-center">
              {(
                [
                  ['≥ 85', 'Ausgezeichnet', 'text-emerald-600'],
                  ['≥ 70', 'Gut', 'text-green-600'],
                  ['≥ 50', 'Ausreichend', 'text-amber-600'],
                  ['≥ 30', 'Schlecht', 'text-orange-600'],
                  ['< 30', 'Kritisch', 'text-red-600'],
                ] as [string, string, string][]
              ).map(([range, label, cls]) => (
                <div key={range} className="border rounded p-1">
                  <p className={`font-bold ${cls}`}>{range}</p>
                  <p className="text-gray-400">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: 7-Tage-Verlauf ──────────────────────────────────── */}
      {activeTab === 'trend' && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">7-Tage Score-Verlauf</h3>
          <TrendChart points={trend7d} />
          {trend7d.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
              {(['excellent', 'good', 'fair', 'poor', 'critical'] as NetworkGrade[]).map((g) => (
                <div key={g} className="flex items-center gap-1.5">
                  <span
                    className="w-3 h-3 rounded-full"
                    style={{ background: GRADE_STROKE[g] }}
                  />
                  <span className="text-gray-500">{GRADE_LABEL[g]}</span>
                </div>
              ))}
            </div>
          )}
          {trend7d.length === 0 && (
            <p className="text-sm text-gray-400 text-center">
              Noch keine Verlaufsdaten — mindestens 1 Snapshot erforderlich.
            </p>
          )}
        </div>
      )}

      {/* ── Tab: Snapshot-Verlauf ────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-xl border p-6">
          <h3 className="font-semibold text-gray-900 mb-4">Letzte 20 Snapshots</h3>
          <SnapshotTable snaps={history} />
        </div>
      )}
    </div>
  );
}
