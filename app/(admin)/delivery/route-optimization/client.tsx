'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Route, RefreshCw, TrendingUp, Zap, MapPin, Clock, CheckCircle2,
  BarChart3, ChevronDown, ChevronUp, Play, Map,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface OptStats {
  total_optimizations: number;
  avg_improvement_km: number;
  avg_improvement_pct: number;
  best_improvement_km: number;
  best_improvement_pct: number;
  total_km_saved: number;
  google_tsp_count: number;
  two_opt_count: number;
  avg_stops: number;
  last_run_at: string | null;
}

interface HistoryRow {
  id: string;
  batch_id: string | null;
  stops_count: number;
  distance_before_km: number;
  distance_after_km: number;
  improvement_km: number;
  improvement_pct: number;
  algorithm: string;
  duration_ms: number;
  created_at: string;
  batch_state: string | null;
}

interface PendingBatch {
  id: string;
  state: string;
  stop_count: number;
  created_at: string;
}

interface Dashboard {
  stats: OptStats | null;
  history: HistoryRow[];
  pendingBatches: PendingBatch[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt1(n: number | null | undefined): string {
  if (n == null) return '–';
  return n.toFixed(1);
}

function fmtPct(n: number | null | undefined): string {
  if (n == null) return '–';
  return `${n.toFixed(1)} %`;
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}

function AlgoLabel({ algo }: { algo: string }) {
  const map: Record<string, { label: string; color: string }> = {
    google_tsp:       { label: 'Google TSP', color: 'text-blue-700 bg-blue-50 border-blue-200' },
    two_opt:          { label: '2-opt',       color: 'text-purple-700 bg-purple-50 border-purple-200' },
    nearest_neighbor: { label: 'NN-Heuristik', color: 'text-gray-700 bg-gray-50 border-gray-200' },
  };
  const m = map[algo] ?? { label: algo, color: 'text-gray-700 bg-gray-50 border-gray-200' };
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${m.color}`}>
      {m.label}
    </span>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  icon,
  label,
  value,
  sub,
  color = 'text-gray-800',
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-white rounded-xl border p-4 flex gap-3 items-start">
      <div className="mt-0.5 text-gray-400">{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className={`text-lg font-bold ${color}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function RouteOptimizationClient({ locationId }: { locationId: string }) {
  const [data, setData]       = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<'history' | 'pending'>('history');
  const [running, setRunning] = useState(false);
  const [toast, setToast]     = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/route-optimization?location_id=${locationId}`);
      if (res.ok) setData(await res.json() as Dashboard);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);

  async function optimizeAll() {
    setRunning(true);
    try {
      const res = await fetch('/api/delivery/admin/route-optimization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'optimize_all' }),
      });
      const json = await res.json() as { optimized?: number; totalKmSaved?: number };
      showToast(`${json.optimized ?? 0} Touren optimiert · ${(json.totalKmSaved ?? 0).toFixed(1)} km gespart`);
      await load();
    } finally {
      setRunning(false);
    }
  }

  async function optimizeBatch(batchId: string) {
    setRunning(true);
    try {
      const res = await fetch('/api/delivery/admin/route-optimization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'optimize_batch', batch_id: batchId }),
      });
      if (res.ok) {
        const json = await res.json() as { improvementKm?: number; improvementPct?: number };
        showToast(`Tour optimiert · ${(json.improvementKm ?? 0).toFixed(1)} km gespart (${(json.improvementPct ?? 0).toFixed(1)} %)`);
        await load();
      } else {
        const err = await res.json() as { error?: string };
        showToast(err.error ?? 'Fehler');
      }
    } finally {
      setRunning(false);
    }
  }

  const s = data?.stats;

  const googlePct = s
    ? s.total_optimizations > 0
      ? Math.round((s.google_tsp_count / s.total_optimizations) * 100)
      : 0
    : null;

  return (
    <div className="space-y-4">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-700 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm text-gray-600 border rounded-lg px-3 py-1.5 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Aktualisieren
          </button>
          <button
            onClick={() => void optimizeAll()}
            disabled={running || loading}
            className="flex items-center gap-1.5 text-sm bg-indigo-600 text-white rounded-lg px-3 py-1.5 hover:bg-indigo-700 disabled:opacity-50"
          >
            <Zap size={14} />
            {running ? 'Optimiert …' : 'Alle ausstehenden optimieren'}
          </button>
        </div>
        {s?.last_run_at && (
          <p className="text-xs text-gray-400">
            Letzter Lauf: {fmtTime(s.last_run_at)}
          </p>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Route size={18} />}
          label="Optimierungen (30 Tage)"
          value={s?.total_optimizations ?? '–'}
          sub={`Ø ${fmt1(s?.avg_stops)} Stopps/Tour`}
        />
        <KpiCard
          icon={<TrendingUp size={18} />}
          label="Ø Einsparung"
          value={`${fmt1(s?.avg_improvement_km)} km`}
          sub={`Ø ${fmtPct(s?.avg_improvement_pct)}`}
          color="text-green-700"
        />
        <KpiCard
          icon={<BarChart3 size={18} />}
          label="Gesamt gespart (30 T)"
          value={`${fmt1(s?.total_km_saved)} km`}
          sub={`Beste Tour: ${fmt1(s?.best_improvement_km)} km`}
          color="text-blue-700"
        />
        <KpiCard
          icon={<Map size={18} />}
          label="Google TSP-Anteil"
          value={googlePct != null ? `${googlePct} %` : '–'}
          sub={`2-opt: ${s?.two_opt_count ?? 0} Touren`}
          color="text-purple-700"
        />
      </div>

      {/* Pending banner */}
      {(data?.pendingBatches?.length ?? 0) > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-sm text-amber-800">
          <Clock size={16} />
          <span>
            <strong>{data!.pendingBatches.length}</strong> {data!.pendingBatches.length === 1 ? 'Tour wartet' : 'Touren warten'} auf Optimierung
          </span>
          <button
            onClick={() => setTab('pending')}
            className="ml-auto text-amber-700 underline text-xs"
          >
            Anzeigen
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b">
        {(['history', 'pending'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-indigo-600 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'history'
              ? `Letzte Optimierungen (${data?.history.length ?? 0})`
              : `Ausstehend (${data?.pendingBatches.length ?? 0})`}
          </button>
        ))}
      </div>

      {/* History tab */}
      {tab === 'history' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          {loading && <div className="p-8 text-center text-gray-400 text-sm">Lade …</div>}
          {!loading && (data?.history.length ?? 0) === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">
              Noch keine Optimierungen durchgeführt.
            </div>
          )}
          {!loading && (data?.history.length ?? 0) > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b bg-gray-50">
                  <th className="text-left px-4 py-2">Zeitpunkt</th>
                  <th className="text-center px-4 py-2">Stopps</th>
                  <th className="text-right px-4 py-2">Vorher (km)</th>
                  <th className="text-right px-4 py-2">Nachher (km)</th>
                  <th className="text-right px-4 py-2">Einsparung</th>
                  <th className="text-center px-4 py-2">Algorithmus</th>
                  <th className="text-right px-4 py-2">Dauer</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {data!.history.map((row) => (
                  <>
                    <tr
                      key={row.id}
                      className="border-b hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}
                    >
                      <td className="px-4 py-2 text-gray-700">{fmtTime(row.created_at)}</td>
                      <td className="px-4 py-2 text-center text-gray-600">{row.stops_count}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{row.distance_before_km.toFixed(1)}</td>
                      <td className="px-4 py-2 text-right text-gray-500">{row.distance_after_km.toFixed(1)}</td>
                      <td className="px-4 py-2 text-right">
                        {row.improvement_km > 0 ? (
                          <span className="text-green-700 font-medium">
                            −{row.improvement_km.toFixed(1)} km&nbsp;
                            <span className="text-xs text-green-600">({row.improvement_pct.toFixed(1)} %)</span>
                          </span>
                        ) : (
                          <span className="text-gray-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <AlgoLabel algo={row.algorithm} />
                      </td>
                      <td className="px-4 py-2 text-right text-gray-400 text-xs">{row.duration_ms} ms</td>
                      <td className="px-2 py-2 text-gray-400">
                        {expandedId === row.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </td>
                    </tr>
                    {expandedId === row.id && (
                      <tr key={`${row.id}-detail`} className="bg-gray-50 border-b">
                        <td colSpan={8} className="px-4 py-3 text-xs text-gray-600 space-y-1">
                          {row.batch_id && (
                            <p>
                              <span className="font-medium">Batch-ID: </span>
                              <code className="bg-white border rounded px-1">{row.batch_id.slice(0, 8)}…</code>
                              {row.batch_state && (
                                <span className="ml-2 text-gray-400">Status: {row.batch_state}</span>
                              )}
                            </p>
                          )}
                          <p>
                            <span className="font-medium">Algorithmus: </span>
                            {row.algorithm === 'google_tsp'
                              ? 'Google Directions API mit Waypoint-Optimierung (TSP)'
                              : row.algorithm === 'two_opt'
                              ? '2-opt Local Search (Nearest-Neighbor-Start, iterative Verbesserung)'
                              : 'Nearest-Neighbor-Heuristik (Fallback)'}
                          </p>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Pending tab */}
      {tab === 'pending' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          {(data?.pendingBatches.length ?? 0) === 0 && (
            <div className="p-8 text-center text-gray-400 text-sm">
              <CheckCircle2 size={24} className="mx-auto mb-2 text-green-500" />
              Alle Touren sind bereits optimiert.
            </div>
          )}
          {(data?.pendingBatches.length ?? 0) > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b bg-gray-50">
                  <th className="text-left px-4 py-2">Batch-ID</th>
                  <th className="text-center px-4 py-2">Stopps</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Erstellt</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {data!.pendingBatches.map((b) => (
                  <tr key={b.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <code className="text-xs bg-gray-100 rounded px-1">{b.id.slice(0, 8)}…</code>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <span className="flex items-center justify-center gap-1">
                        <MapPin size={12} className="text-gray-400" />
                        {b.stop_count}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-gray-600">{b.state}</td>
                    <td className="px-4 py-2 text-gray-500 text-xs">{fmtTime(b.created_at)}</td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => void optimizeBatch(b.id)}
                        disabled={running}
                        className="flex items-center gap-1 text-xs bg-indigo-600 text-white rounded px-2 py-1 hover:bg-indigo-700 disabled:opacity-50"
                      >
                        <Play size={11} />
                        Optimieren
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-800 space-y-1">
        <p className="font-semibold text-sm">So funktioniert die Optimierung</p>
        <p>
          <strong>Google TSP:</strong> Nutzt die Google Directions API mit Waypoint-Optimierung für
          exakte Straßendistanzen. Bestes Ergebnis, erfordert API-Kontingent.
        </p>
        <p>
          <strong>2-opt Local Search:</strong> Startet mit Nearest-Neighbor, verbessert dann iterativ
          durch Kanten-Tausch. Typisch 10–40 % Distanzeinsparung ohne externe API.
        </p>
        <p>
          <strong>Zeitfenster:</strong> ETA-Deadlines aus Kundenbestellungen werden als Soft-Constraints
          berücksichtigt — Überschreitungen erhöhen den Optimierungsscore.
        </p>
      </div>
    </div>
  );
}
