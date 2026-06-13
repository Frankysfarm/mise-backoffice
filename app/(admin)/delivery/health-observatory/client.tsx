'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, RefreshCw, Shield, TrendingDown } from 'lucide-react';
import type { ObservatoryDashboard, TrendBucket, IsolationAuditResult } from '@/lib/delivery/health-observatory';

// ──────────────────────────────────────────────────────────────
// Hilfs-Funktionen
// ──────────────────────────────────────────────────────────────

function gradeColor(grade: string): string {
  if (grade === 'A') return 'text-green-600 bg-green-50 ring-green-200';
  if (grade === 'B') return 'text-blue-600 bg-blue-50 ring-blue-200';
  if (grade === 'C') return 'text-amber-600 bg-amber-50 ring-amber-200';
  return 'text-red-600 bg-red-50 ring-red-200';
}

function scoreBar(score: number): string {
  if (score >= 90) return 'bg-green-500';
  if (score >= 75) return 'bg-blue-500';
  if (score >= 55) return 'bg-amber-500';
  return 'bg-red-500';
}

function fmt(ts: string | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

// ──────────────────────────────────────────────────────────────
// Sparkline (24h Health-Score)
// ──────────────────────────────────────────────────────────────

function TrendSparkline({ buckets }: { buckets: TrendBucket[] }) {
  if (buckets.length < 2) {
    return <p className="text-xs text-zinc-400 italic">Noch zu wenig Daten für Trend</p>;
  }

  const W = 320;
  const H = 60;
  const scores = buckets.map((b) => b.avg_health_score);
  const minS = Math.max(0, Math.min(...scores) - 5);
  const maxS = Math.min(100, Math.max(...scores) + 5);
  const range = maxS - minS || 1;

  const pts = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * W;
    const y = H - ((s - minS) / range) * H;
    return `${x},${y}`;
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-14" preserveAspectRatio="none">
      <polyline
        points={pts.join(' ')}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Referenzlinie 75 (Note B) */}
      <line
        x1="0" y1={H - ((75 - minS) / range) * H}
        x2={W} y2={H - ((75 - minS) / range) * H}
        stroke="#d1d5db" strokeDasharray="4 2" strokeWidth="1"
      />
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────
// Audit-Tabelle
// ──────────────────────────────────────────────────────────────

function AuditTable({ results }: { results: IsolationAuditResult[] }) {
  if (!results.length) {
    return (
      <p className="text-sm text-zinc-500 italic py-4 text-center">
        Noch kein Audit durchgeführt. Klicke „Audit starten".
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-100 text-zinc-400 font-medium text-left">
            <th className="py-2 pr-4">Tabelle</th>
            <th className="py-2 pr-4 text-right">Gesamt</th>
            <th className="py-2 pr-4 text-right">Verwaiste Zeilen</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2">Notiz</th>
          </tr>
        </thead>
        <tbody>
          {results.map((r) => (
            <tr key={r.id} className="border-b border-zinc-50 hover:bg-zinc-50">
              <td className="py-2 pr-4 font-mono font-medium text-zinc-700">{r.table_name}</td>
              <td className="py-2 pr-4 text-right tabular-nums text-zinc-500">
                {r.total_rows.toLocaleString('de-DE')}
              </td>
              <td className="py-2 pr-4 text-right tabular-nums">
                <span className={r.orphaned_rows > 0 ? 'text-red-600 font-semibold' : 'text-zinc-400'}>
                  {r.orphaned_rows.toLocaleString('de-DE')}
                </span>
              </td>
              <td className="py-2 pr-4">
                {r.severity === 'ok' && (
                  <span className="inline-flex items-center gap-1 text-green-600">
                    <CheckCircle className="w-3 h-3" /> OK
                  </span>
                )}
                {r.severity === 'warning' && (
                  <span className="inline-flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="w-3 h-3" /> Warnung
                  </span>
                )}
                {r.severity === 'critical' && (
                  <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                    <AlertTriangle className="w-3 h-3" /> Kritisch
                  </span>
                )}
              </td>
              <td className="py-2 text-zinc-400">{r.notes ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Score-Aufschlüsselung
// ──────────────────────────────────────────────────────────────

function ScoreBreakdown({ dashboard }: { dashboard: ObservatoryDashboard }) {
  const { score_breakdown } = dashboard;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-zinc-500 w-24">Basispunkte</span>
        <span className="font-semibold text-green-600">+{score_breakdown.base}</span>
      </div>
      {score_breakdown.deductions.map((d, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          <span className="text-zinc-500 flex-1 truncate">{d.reason}</span>
          <span className="font-semibold text-red-500 tabular-nums">{d.points}</span>
        </div>
      ))}
      <div className="border-t border-zinc-200 pt-2 flex items-center gap-2 text-sm font-semibold">
        <span className="text-zinc-700 flex-1">Ergebnis</span>
        <span className={score_breakdown.final >= 75 ? 'text-blue-600' : 'text-amber-600'}>
          {score_breakdown.final} / 100
        </span>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Haupt-Komponente
// ──────────────────────────────────────────────────────────────

export function ObservatoryClient({ locationId }: { locationId: string }) {
  const [dashboard, setDashboard] = useState<ObservatoryDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(false);
  const [snapshotLoading, setSnapshotLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/health-observatory?location_id=${locationId}&action=dashboard`);
      if (res.ok) {
        setDashboard(await res.json() as ObservatoryDashboard);
        setLastRefresh(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);

  // Auto-Refresh alle 60s
  useEffect(() => {
    const t = setInterval(() => { void load(); }, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const takeSnapshot = async () => {
    setSnapshotLoading(true);
    try {
      await fetch(`/api/delivery/admin/health-observatory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, action: 'snapshot' }),
      });
      await load();
    } finally {
      setSnapshotLoading(false);
    }
  };

  const runAudit = async () => {
    setAuditLoading(true);
    try {
      await fetch(`/api/delivery/admin/health-observatory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, action: 'audit' }),
      });
      await load();
    } finally {
      setAuditLoading(false);
    }
  };

  if (loading && !dashboard) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-400">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Lade System-Health…
      </div>
    );
  }

  const snap = dashboard?.latest_snapshot;
  const grade = dashboard?.grade;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-400">
          {lastRefresh ? `Aktualisiert: ${lastRefresh.toLocaleTimeString('de-DE')} · Auto-Refresh 60s` : ''}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => void takeSnapshot()}
            disabled={snapshotLoading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50"
          >
            <Activity className="w-3.5 h-3.5" />
            {snapshotLoading ? 'Läuft…' : 'Snapshot jetzt'}
          </button>
          <button
            onClick={() => void runAudit()}
            disabled={auditLoading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50"
          >
            <Shield className="w-3.5 h-3.5" />
            {auditLoading ? 'Audit läuft…' : 'Audit starten'}
          </button>
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-zinc-900 text-white hover:bg-zinc-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Health-Score Hero */}
      {grade && (
        <div className={`rounded-xl ring-1 p-6 flex flex-col sm:flex-row items-center gap-6 ${gradeColor(grade.grade)}`}>
          <div className="text-center">
            <div className="text-6xl font-black tabular-nums">{grade.score}</div>
            <div className="text-sm font-medium mt-1 opacity-70">von 100 Punkten</div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="text-4xl font-black">{grade.grade}</span>
              <div>
                <div className="font-semibold text-lg">{grade.label}</div>
                <div className="text-sm opacity-70">
                  System-Gesundheit · {fmt(snap?.snapshot_at ?? null)}
                </div>
              </div>
            </div>
            <div className="mt-3 h-2 rounded-full bg-black/10 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${scoreBar(grade.score)}`}
                style={{ width: `${grade.score}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* KPI-Karten */}
      {snap && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Fahrer online', value: snap.drivers_online, sub: `${snap.drivers_active} aktiv` },
            { label: 'Pending Orders', value: snap.pending_orders, sub: 'gesamt offen' },
            { label: 'Aktive Touren', value: snap.active_tours, sub: 'unterwegs / abgeholt' },
            { label: 'Dispatch-Queue', value: snap.dispatch_queue, sub: 'ohne Fahrer', alert: snap.dispatch_queue > 5 },
            { label: 'Offene Alarme', value: snap.open_alerts, sub: 'ungelöst', alert: snap.open_alerts > 0 },
            {
              label: 'ETA-Genauigkeit',
              value: snap.eta_accuracy_pct !== null ? `${snap.eta_accuracy_pct}%` : '—',
              sub: 'letzte 50 Liefer.',
              alert: snap.eta_accuracy_pct !== null && snap.eta_accuracy_pct < 85,
            },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className={`rounded-lg border p-3 text-center ${kpi.alert ? 'border-red-200 bg-red-50' : 'border-zinc-200 bg-white'}`}
            >
              <div className={`text-2xl font-bold tabular-nums ${kpi.alert ? 'text-red-600' : 'text-zinc-900'}`}>
                {kpi.value}
              </div>
              <div className="text-xs font-medium text-zinc-600 mt-0.5">{kpi.label}</div>
              <div className="text-[10px] text-zinc-400">{kpi.sub}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score-Aufschlüsselung */}
        {dashboard && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-zinc-800 mb-4">Score-Aufschlüsselung</h2>
            <ScoreBreakdown dashboard={dashboard} />
          </div>
        )}

        {/* 24h-Trend */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-zinc-800 mb-1">
            24h Health-Score-Trend
          </h2>
          <p className="text-xs text-zinc-400 mb-3">Stündliche Durchschnitte — Referenzlinie bei 75 (Note B)</p>
          {dashboard?.trend_24h?.length ? (
            <TrendSparkline buckets={dashboard.trend_24h} />
          ) : (
            <div className="flex items-center gap-2 text-zinc-400 text-sm py-6 justify-center">
              <TrendingDown className="w-4 h-4" />
              Noch keine Trend-Daten (braucht mehrere Snapshots)
            </div>
          )}
          {dashboard?.trend_24h?.length ? (
            <div className="mt-2 flex justify-between text-[10px] text-zinc-400">
              <span>{fmt(dashboard.trend_24h[0]?.hour_bucket ?? null)}</span>
              <span>{dashboard.trend_24h.length} Stunden-Buckets</span>
              <span>{fmt(dashboard.trend_24h[dashboard.trend_24h.length - 1]?.hour_bucket ?? null)}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Isolations-Audit */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-800 flex items-center gap-2">
              <Shield className="w-4 h-4 text-zinc-500" />
              Multi-Tenant-Isolations-Audit
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5">
              Prüft 10 Kern-Tabellen auf fehlende location_id (verwaiste Zeilen)
              {dashboard?.last_audit_at ? ` · Letzter Audit: ${fmt(dashboard.last_audit_at)}` : ' · Noch nicht gelaufen'}
            </p>
          </div>
          {dashboard?.audit_results.length ? (
            <div className="flex gap-2">
              {dashboard.audit_results.filter((r) => r.severity === 'critical').length > 0 && (
                <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700 font-medium">
                  {dashboard.audit_results.filter((r) => r.severity === 'critical').length} Kritisch
                </span>
              )}
              {dashboard.audit_results.filter((r) => r.severity === 'warning').length > 0 && (
                <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium">
                  {dashboard.audit_results.filter((r) => r.severity === 'warning').length} Warnung
                </span>
              )}
              {dashboard.audit_results.every((r) => r.severity === 'ok') && (
                <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Alle OK
                </span>
              )}
            </div>
          ) : null}
        </div>
        <AuditTable results={dashboard?.audit_results ?? []} />
      </div>
    </div>
  );
}
