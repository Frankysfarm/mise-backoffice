'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, RefreshCw,
  TrendingUp, TrendingDown, Users, Clock, Zap, XCircle,
  BarChart2, Info,
} from 'lucide-react';

// ─── Typen ────────────────────────────────────────────────────────────────────

type FlowAnomalyType =
  | 'none'
  | 'volume_spike'
  | 'volume_drop'
  | 'cancellation_surge'
  | 'failure_cluster'
  | 'driver_shortage';

type FlowSeverity = 'low' | 'medium' | 'high' | 'critical';

interface FlowSnapshot {
  id: string;
  location_id: string;
  snapshot_at: string;
  orders_last_5min: number;
  orders_last_15min: number;
  orders_last_60min: number;
  cancellations_last_30min: number;
  failed_deliveries_30min: number;
  drivers_online: number;
  avg_eta_min: number | null;
  expected_per_5min: number;
  z_score: number;
  anomaly_type: FlowAnomalyType;
}

interface FlowAnomalyEvent {
  id: string;
  detected_at: string;
  resolved_at: string | null;
  anomaly_type: FlowAnomalyType;
  severity: FlowSeverity;
  z_score: number | null;
  metrics: Record<string, unknown>;
  auto_action: string;
  notes: string | null;
  is_active: boolean;
  minutes_ago: number;
}

interface FlowTrendBucket {
  hour_bucket: string;
  avg_orders_5min: number;
  avg_expected: number;
  avg_z_score: number;
  max_z_score: number;
  total_orders_in_hour: number;
  anomaly_count: number;
  snapshot_count: number;
}

interface FlowDashboard {
  location_id: string;
  generated_at: string;
  latest_snapshot: FlowSnapshot | null;
  current_status: FlowAnomalyType;
  active_anomaly_count: number;
  anomalies_24h: number;
  recent_anomalies: FlowAnomalyEvent[];
  trend_24h: FlowTrendBucket[];
  total_snapshots_24h: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ANOMALY_META: Record<FlowAnomalyType, {
  label: string;
  color: string;
  bg: string;
  border: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  none: {
    label: 'Normal', color: 'text-green-700', bg: 'bg-green-50',
    border: 'border-green-200', Icon: CheckCircle2,
  },
  volume_spike: {
    label: 'Bestellungs-Spike', color: 'text-blue-700', bg: 'bg-blue-50',
    border: 'border-blue-200', Icon: TrendingUp,
  },
  volume_drop: {
    label: 'Bestellungs-Einbruch', color: 'text-amber-700', bg: 'bg-amber-50',
    border: 'border-amber-200', Icon: TrendingDown,
  },
  cancellation_surge: {
    label: 'Stornowelle', color: 'text-orange-700', bg: 'bg-orange-50',
    border: 'border-orange-200', Icon: XCircle,
  },
  failure_cluster: {
    label: 'Fehllieferungen-Cluster', color: 'text-red-700', bg: 'bg-red-50',
    border: 'border-red-200', Icon: AlertTriangle,
  },
  driver_shortage: {
    label: 'Fahrermangel', color: 'text-red-800', bg: 'bg-red-100',
    border: 'border-red-300', Icon: Users,
  },
};

const SEVERITY_BADGE: Record<FlowSeverity, string> = {
  low:      'bg-gray-100 text-gray-700',
  medium:   'bg-amber-100 text-amber-800',
  high:     'bg-orange-100 text-orange-800',
  critical: 'bg-red-100 text-red-800 font-semibold',
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function fmtHour(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function zColor(z: number): string {
  const abs = Math.abs(z);
  if (abs >= 3.5) return 'text-red-600 font-bold';
  if (abs >= 2.5) return 'text-orange-600 font-semibold';
  if (abs >= 1.5) return 'text-amber-600';
  return 'text-gray-500';
}

// ─── Komponenten ──────────────────────────────────────────────────────────────

function StatusHero({ status, snap }: { status: FlowAnomalyType; snap: FlowSnapshot | null }) {
  const meta = ANOMALY_META[status];
  const { Icon } = meta;
  const isAnomaly = status !== 'none';

  return (
    <div className={`rounded-xl border-2 p-5 flex items-center gap-4 ${meta.bg} ${meta.border}`}>
      <div className={`p-3 rounded-full ${isAnomaly ? 'animate-pulse' : ''} ${meta.bg}`}>
        <Icon className={`w-8 h-8 ${meta.color}`} />
      </div>
      <div className="flex-1">
        <p className="text-sm text-gray-500 font-medium">Aktueller Bestellfluss-Status</p>
        <p className={`text-2xl font-bold ${meta.color}`}>{meta.label}</p>
        {snap && (
          <p className="text-xs text-gray-400 mt-0.5">
            Snapshot um {fmtTime(snap.snapshot_at)} · Z-Score: {snap.z_score.toFixed(2)}
          </p>
        )}
      </div>
      {isAnomaly && (
        <div className="text-right">
          <span className={`text-xs px-2 py-1 rounded-full ${SEVERITY_BADGE[classifySeverity(status, snap?.z_score ?? 0)]}`}>
            {classifySeverity(status, snap?.z_score ?? 0).toUpperCase()}
          </span>
        </div>
      )}
    </div>
  );
}

function classifySeverity(type: FlowAnomalyType, z: number): FlowSeverity {
  if (type === 'none') return 'low';
  if (type === 'driver_shortage') return 'critical';
  if (type === 'failure_cluster') return Math.abs(z) > 3 ? 'critical' : 'high';
  if (type === 'cancellation_surge') return Math.abs(z) > 3 ? 'high' : 'medium';
  const absZ = Math.abs(z);
  if (absZ >= 4) return 'critical';
  if (absZ >= 3.5) return 'high';
  if (absZ >= 2.5) return 'medium';
  return 'low';
}

function KpiCard({
  label, value, sub, icon: Icon, colorClass,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${colorClass ?? 'text-gray-400'}`} />
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${colorClass ?? 'text-gray-800'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function TrendChart({ buckets }: { buckets: FlowTrendBucket[] }) {
  if (!buckets.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1.5">
          <BarChart2 className="w-4 h-4 text-blue-500" /> 24h-Bestellfluss
        </p>
        <p className="text-xs text-gray-400 py-6 text-center">
          Noch keine Snapshot-Daten — erster Snapshot ausstehend.
        </p>
      </div>
    );
  }

  const maxOrders = Math.max(...buckets.map(b => b.total_orders_in_hour), 1);
  const maxExpected = Math.max(...buckets.map(b => b.avg_expected * 12), 0.1); // per hour
  const scale = Math.max(maxOrders, maxExpected);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
        <BarChart2 className="w-4 h-4 text-blue-500" /> 24h-Bestellfluss (stündlich)
      </p>
      <div className="flex items-end gap-0.5 h-32">
        {buckets.map((b, i) => {
          const actualH = Math.round((b.total_orders_in_hour / scale) * 100);
          const expectedH = Math.round((b.avg_expected * 12 / scale) * 100);
          const hasAnomaly = b.anomaly_count > 0;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5 group relative">
              {/* Expected line */}
              <div
                className="w-full border-t-2 border-dashed border-gray-300 absolute"
                style={{ bottom: `${Math.min(expectedH, 96)}%` }}
              />
              {/* Actual bar */}
              <div
                className={`w-full rounded-t transition-all ${
                  hasAnomaly ? 'bg-red-400' : 'bg-blue-400'
                }`}
                style={{ height: `${Math.max(actualH, 2)}%` }}
              />
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                {fmtHour(b.hour_bucket)}: {b.total_orders_in_hour} Bestell.
                {hasAnomaly ? ` ⚠ ${b.anomaly_count} Anomalie(n)` : ''}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 bg-blue-400 rounded-sm inline-block" /> Ist-Bestellungen
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 border-t-2 border-dashed border-gray-300 inline-block" /> Historischer Ø
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 bg-red-400 rounded-sm inline-block" /> Mit Anomalie
        </span>
      </div>
    </div>
  );
}

function AnomalyRow({ event }: { event: FlowAnomalyEvent }) {
  const [open, setOpen] = useState(false);
  const meta = ANOMALY_META[event.anomaly_type];
  const { Icon } = meta;

  return (
    <div className={`border rounded-lg overflow-hidden ${event.is_active ? meta.border : 'border-gray-200'}`}>
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Icon className={`w-4 h-4 flex-shrink-0 ${meta.color}`} />
        <div className="flex-1 min-w-0">
          <span className={`text-sm font-medium ${meta.color}`}>{meta.label}</span>
          <span className="ml-2 text-xs text-gray-400">{fmtTime(event.detected_at)}</span>
          {event.minutes_ago < 60 && (
            <span className="ml-1 text-xs text-gray-400">
              (vor {event.minutes_ago} Min)
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-1.5 py-0.5 rounded-full ${SEVERITY_BADGE[event.severity]}`}>
            {event.severity}
          </span>
          {event.is_active
            ? <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            : <span className="w-2 h-2 rounded-full bg-gray-300" />
          }
        </div>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-0 bg-gray-50 border-t border-gray-100 text-xs space-y-2">
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div>
              <span className="text-gray-500">Z-Score:</span>
              <span className={`ml-1 font-mono ${zColor(event.z_score ?? 0)}`}>
                {event.z_score != null ? event.z_score.toFixed(2) : '—'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Auto-Aktion:</span>
              <span className="ml-1 text-gray-700">
                {event.auto_action === 'incident_created' ? 'Incident erstellt' :
                 event.auto_action === 'alert_created'   ? 'Alert erstellt' :
                 'Keine'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Bestellungen (5/15/60 Min):</span>
              <span className="ml-1 text-gray-700">
                {(event.metrics.orders_last_5min as number) ?? 0} /
                {(event.metrics.orders_last_15min as number) ?? 0} /
                {(event.metrics.orders_last_60min as number) ?? 0}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Fahrer online:</span>
              <span className="ml-1 text-gray-700">
                {(event.metrics.drivers_online as number) ?? 0}
              </span>
            </div>
            {(event.metrics.cancellations_last_30min as number) > 0 && (
              <div>
                <span className="text-gray-500">Stornierungen (30 Min):</span>
                <span className="ml-1 text-red-600 font-semibold">
                  {event.metrics.cancellations_last_30min as number}
                </span>
              </div>
            )}
            {(event.metrics.failed_deliveries_30min as number) > 0 && (
              <div>
                <span className="text-gray-500">Fehllieferungen (30 Min):</span>
                <span className="ml-1 text-red-600 font-semibold">
                  {event.metrics.failed_deliveries_30min as number}
                </span>
              </div>
            )}
          </div>
          {event.resolved_at && (
            <p className="text-green-600">
              ✓ Aufgelöst um {fmtTime(event.resolved_at)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Haupt-Client ─────────────────────────────────────────────────────────────

export function FlowIntelligenceClient({ locationId }: { locationId: string }) {
  const [dashboard, setDashboard] = useState<FlowDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapshotting, setSnapshotting] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/admin/flow-intelligence?location_id=${locationId}`);
      if (res.ok) {
        const data = await res.json() as FlowDashboard;
        setDashboard(data);
        setLastRefresh(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void fetchDashboard();
    const id = setInterval(() => void fetchDashboard(), 60_000);
    return () => clearInterval(id);
  }, [fetchDashboard]);

  const handleSnapshot = async () => {
    setSnapshotting(true);
    try {
      await fetch(`/api/delivery/admin/flow-intelligence?location_id=${locationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snapshot' }),
      });
      await fetchDashboard();
    } finally {
      setSnapshotting(false);
    }
  };

  const handleResolve = async () => {
    setResolving(true);
    try {
      await fetch(`/api/delivery/admin/flow-intelligence?location_id=${locationId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve' }),
      });
      await fetchDashboard();
    } finally {
      setResolving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400 gap-2">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span>Lade Bestellfluss-Daten…</span>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="text-center py-16 text-gray-400">
        Keine Daten verfügbar.
      </div>
    );
  }

  const snap = dashboard.latest_snapshot;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          Aktualisiert: {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          <span className="text-gray-300">·</span>
          {dashboard.total_snapshots_24h} Snapshots (24h)
        </div>
        <div className="flex gap-2">
          {dashboard.active_anomaly_count > 0 && (
            <button
              onClick={handleResolve}
              disabled={resolving}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {resolving ? 'Auflösen…' : 'Alle auflösen'}
            </button>
          )}
          <button
            onClick={() => void fetchDashboard()}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={handleSnapshot}
            disabled={snapshotting}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <Activity className="w-3.5 h-3.5" />
            {snapshotting ? 'Snapshot läuft…' : 'Snapshot jetzt'}
          </button>
        </div>
      </div>

      {/* Status-Hero */}
      <StatusHero status={dashboard.current_status} snap={snap} />

      {/* KPI-Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Bestellungen (letzte 5 Min)"
          value={snap?.orders_last_5min ?? '—'}
          sub={snap ? `Erwartet: ${snap.expected_per_5min.toFixed(1)}` : undefined}
          icon={TrendingUp}
          colorClass="text-blue-600"
        />
        <KpiCard
          label="Bestellungen (letzte 60 Min)"
          value={snap?.orders_last_60min ?? '—'}
          sub="Gesamtstunde"
          icon={BarChart2}
          colorClass="text-indigo-600"
        />
        <KpiCard
          label="Stornierungen (30 Min)"
          value={snap?.cancellations_last_30min ?? '—'}
          sub={snap && snap.orders_last_15min > 0
            ? `${((snap.cancellations_last_30min / snap.orders_last_15min) * 100).toFixed(0)} %`
            : undefined}
          icon={XCircle}
          colorClass={snap && snap.cancellations_last_30min > 2 ? 'text-red-600' : 'text-gray-500'}
        />
        <KpiCard
          label="Fahrer online"
          value={snap?.drivers_online ?? '—'}
          sub={snap?.avg_eta_min != null ? `Ø ETA ${snap.avg_eta_min} Min` : 'Keine aktiven Touren'}
          icon={Users}
          colorClass={snap?.drivers_online === 0 ? 'text-red-600' : 'text-green-600'}
        />
      </div>

      {/* Anomalie-Zähler-Band */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className={`w-5 h-5 ${dashboard.active_anomaly_count > 0 ? 'text-red-500' : 'text-gray-300'}`} />
          <div>
            <p className="text-sm font-semibold text-gray-700">
              {dashboard.active_anomaly_count} aktive Anomalie{dashboard.active_anomaly_count !== 1 ? 'n' : ''}
            </p>
            <p className="text-xs text-gray-400">{dashboard.anomalies_24h} insgesamt letzte 24h</p>
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3">
          <Zap className={`w-5 h-5 ${snap ? zColor(snap.z_score) : 'text-gray-300'}`} />
          <div>
            <p className="text-sm font-semibold text-gray-700">
              Z-Score: {snap ? snap.z_score.toFixed(2) : '—'}
            </p>
            <p className="text-xs text-gray-400">
              Abweichung vom historischen Ø
              {snap && Math.abs(snap.z_score) >= 2.5 ? ' — signifikant!' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* 24h-Trend-Chart */}
      <TrendChart buckets={dashboard.trend_24h} />

      {/* Anomalie-Log */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <AlertTriangle className="w-4 h-4 text-orange-500" />
          Anomalie-Log (letzte 48h)
        </p>
        {dashboard.recent_anomalies.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-green-400" />
            <p className="text-sm">Keine Anomalien in den letzten 48 Stunden. Alles im grünen Bereich.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {dashboard.recent_anomalies.map(event => (
              <AnomalyRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>

      {/* Info-Box */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-800 mb-2 flex items-center gap-1.5">
          <Info className="w-4 h-4" /> So funktioniert die Anomalie-Erkennung
        </p>
        <ul className="text-xs text-blue-700 space-y-1">
          <li>
            <strong>Z-Score ≥ 2,5</strong>: Bestellvolumen weicht signifikant vom
            4-Wochen-Ø (gleicher Wochentag + Stunde) ab → Spike oder Einbruch
          </li>
          <li>
            <strong>Stornowelle</strong>: Stornierungsrate &gt; 25 % der Bestellungen der
            letzten 30 Min
          </li>
          <li>
            <strong>Fehllieferungen-Cluster</strong>: &gt; 20 % der Lieferungen der letzten
            30 Min als fehlgeschlagen gemeldet
          </li>
          <li>
            <strong>Fahrermangel</strong>: Keine Fahrer online obwohl Bestellungen vorhanden
          </li>
          <li>
            <strong>Automatische Incidents</strong>: Bei Severity high/critical wird ein
            Incident-Eintrag für das Admin-Team erstellt
          </li>
          <li>
            <strong>Snapshots</strong>: Alle 5 Minuten via Cron — manuell mit „Snapshot jetzt"
          </li>
        </ul>
      </div>
    </div>
  );
}
