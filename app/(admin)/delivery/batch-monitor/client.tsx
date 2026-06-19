'use client';

/**
 * BatchMonitorClient — Echtzeit-Batch-Gesundheits-Dashboard
 *
 * Zeigt:
 *  - 4 KPI-Karten: Aktive Touren / Stuck / ETA-Risiko / Health-Score
 *  - Aktive-Batch-Liste mit Fortschrittsbalken, Stuck-Badge, ETA-Risiko-Badge
 *  - 24h-Trend-Chart (Health-Score Verlauf)
 *  - 30s Auto-Refresh
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Bike,
  Car,
  MapPin,
  Timer,
  TrendingUp,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface StopDetail {
  stopId: string;
  orderId: string | null;
  stopType: string;
  state: string;
  etaMin: number | null;
  isOverdue: boolean;
}

interface BatchInfo {
  batchId: string;
  driverName: string | null;
  vehicle: string | null;
  state: string;
  ageMin: number;
  totalStops: number;
  completedStops: number;
  openStops: number;
  completionPct: number;
  isStuck: boolean;
  stuckMinutes: number | null;
  hasEtaRisk: boolean;
  stops: StopDetail[];
}

interface BatchHealthScan {
  activeBatches: number;
  stuckBatches: number;
  etaBreachRisk: number;
  avgCompletionPct: number | null;
  avgBatchAgeMin: number | null;
  totalOpenStops: number;
  totalDoneStops: number;
  healthScore: number;
  healthStatus: 'ok' | 'warning' | 'critical';
  batches: BatchInfo[];
}

interface TrendRow {
  snapshotAt: string;
  healthScore: number;
  activeBatches: number;
  stuckBatches: number;
}

interface Dashboard {
  current: BatchHealthScan | null;
  trend24h: TrendRow[];
  totalSnapshotsToday: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function healthColor(status: string) {
  if (status === 'critical') return 'text-red-600 bg-red-50 border-red-200';
  if (status === 'warning')  return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-matcha-700 bg-matcha-50 border-matcha-200';
}

function healthScoreColor(score: number) {
  if (score >= 80) return 'text-matcha-600';
  if (score >= 60) return 'text-amber-600';
  return 'text-red-600';
}

function ageLabel(min: number) {
  if (min < 60) return `${Math.round(min)} Min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h ${m}m`;
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon,
  color = 'text-gray-700',
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-gray-400">{icon}</span>
        <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</span>
      </div>
      <p className={`text-2xl font-black tabular-nums ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Batch Row ─────────────────────────────────────────────────────────────────

function BatchRow({ batch }: { batch: BatchInfo }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`rounded-xl border shadow-sm overflow-hidden ${
      batch.isStuck ? 'border-red-200 bg-red-50' :
      batch.hasEtaRisk ? 'border-amber-200 bg-amber-50' :
      'border-gray-100 bg-white'
    }`}>
      {/* Header row */}
      <button
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Vehicle */}
        {batch.vehicle === 'car'
          ? <Car className="w-4 h-4 text-gray-400 shrink-0" />
          : <Bike className="w-4 h-4 text-gray-400 shrink-0" />}

        {/* Driver */}
        <span className="text-sm font-semibold text-gray-800 min-w-0 truncate flex-1">
          {batch.driverName ?? 'Fahrer unbekannt'}
        </span>

        {/* Badges */}
        <div className="flex items-center gap-1.5 shrink-0">
          {batch.isStuck && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
              <AlertTriangle className="w-3 h-3" />
              Stuck {batch.stuckMinutes}m
            </span>
          )}
          {batch.hasEtaRisk && !batch.isStuck && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
              <Timer className="w-3 h-3" />
              ETA-Risiko
            </span>
          )}
          {!batch.isStuck && !batch.hasEtaRisk && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-matcha-100 text-matcha-700 text-[10px] font-bold">
              <CheckCircle2 className="w-3 h-3" />
              OK
            </span>
          )}
        </div>

        {/* Age */}
        <span className="text-[11px] text-gray-400 tabular-nums shrink-0">
          {ageLabel(batch.ageMin)}
        </span>

        {/* Expand toggle */}
        {expanded
          ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
      </button>

      {/* Progress bar */}
      <div className="px-4 pb-2">
        <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
          <span>{batch.completedStops}/{batch.totalStops} Stops</span>
          <span>{batch.completionPct}%</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              batch.isStuck ? 'bg-red-400' :
              batch.hasEtaRisk ? 'bg-amber-400' :
              'bg-matcha-500'
            }`}
            style={{ width: `${batch.completionPct}%` }}
          />
        </div>
      </div>

      {/* Expanded stop details */}
      {expanded && (
        <div className="px-4 pb-3 border-t border-gray-100 mt-1 pt-2 space-y-1">
          {batch.stops.map((stop) => (
            <div key={stop.stopId} className="flex items-center gap-2 text-[11px]">
              <MapPin className={`w-3 h-3 shrink-0 ${
                stop.state === 'delivered' ? 'text-matcha-500' :
                stop.isOverdue ? 'text-red-500' :
                'text-gray-400'
              }`} />
              <span className="text-gray-600 capitalize">{stop.stopType}</span>
              <span className={`ml-auto font-medium ${
                stop.state === 'delivered' ? 'text-matcha-600' :
                stop.isOverdue ? 'text-red-600' :
                'text-gray-500'
              }`}>
                {stop.state === 'delivered' ? '✓ Geliefert' :
                 stop.isOverdue ? '⚠ Überfällig' :
                 stop.state === 'arrived' ? '📍 Vor Ort' :
                 'Ausstehend'}
              </span>
            </div>
          ))}
          {batch.stops.length === 0 && (
            <p className="text-[11px] text-gray-400">Keine Stops geladen</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Trend Mini-Chart ──────────────────────────────────────────────────────────

function TrendChart({ rows }: { rows: TrendRow[] }) {
  if (rows.length < 2) {
    return (
      <p className="text-xs text-gray-400 text-center py-6">
        Noch zu wenig Verlaufsdaten (mind. 2 Snapshots)
      </p>
    );
  }

  const max = 100;
  const w = 600;
  const h = 80;

  const points = rows.map((r, i) => {
    const x = (i / (rows.length - 1)) * w;
    const y = h - (r.healthScore / max) * h;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;
  const fillD = `M ${points[0]} L ${points.join(' L ')} L ${w},${h} L 0,${h} Z`;

  const scoreColor = rows[rows.length - 1]?.healthScore >= 70 ? '#16a34a' :
    rows[rows.length - 1]?.healthScore >= 40 ? '#d97706' : '#dc2626';

  return (
    <div className="overflow-hidden">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-16" preserveAspectRatio="none">
        <defs>
          <linearGradient id="bm-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={scoreColor} stopOpacity={0.15} />
            <stop offset="100%" stopColor={scoreColor} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <path d={fillD} fill="url(#bm-grad)" />
        <path d={pathD} fill="none" stroke={scoreColor} strokeWidth="2" />
      </svg>
      <div className="flex justify-between text-[9px] text-gray-400 mt-0.5">
        <span>{new Date(rows[0].snapshotAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
        <span>24h</span>
        <span>{new Date(rows[rows.length - 1].snapshotAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export function BatchMonitorClient({ locationId }: { locationId: string }) {
  const [data, setData]       = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/batch-monitor?action=dashboard&location_id=${locationId}`,
        { cache: 'no-store' },
      );
      if (res.ok) {
        const json = await res.json() as Dashboard;
        setData(json);
      }
    } catch {
      // keep previous
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, [locationId]);

  useEffect(() => {
    void fetchData();
    intervalRef.current = setInterval(() => void fetchData(), 30_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = data?.current;
  const trend   = data?.trend24h ?? [];

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Activity className="w-4 h-4 text-matcha-500" />
          <span>
            {current
              ? `${current.activeBatches} aktive Tour${current.activeBatches !== 1 ? 'en' : ''}`
              : 'Lade…'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span>
            Aktualisiert {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={() => void fetchData()}
            disabled={loading}
            className="p-1 rounded text-gray-400 hover:text-matcha-600 transition-colors disabled:opacity-40"
            aria-label="Aktualisieren"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Health Status Banner */}
      {current && current.healthStatus !== 'ok' && (
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium ${healthColor(current.healthStatus)}`}>
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {current.healthStatus === 'critical'
            ? `Kritisch: ${current.stuckBatches} Tour${current.stuckBatches !== 1 ? 'en' : ''} feststeckend, ${current.etaBreachRisk} ETA-Risiko`
            : `Warnung: ${current.stuckBatches} Tour${current.stuckBatches !== 1 ? 'en' : ''} ohne Fortschritt`}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard
          label="Aktive Touren"
          value={current?.activeBatches ?? '—'}
          icon={<Activity className="w-4 h-4" />}
          color="text-gray-800"
          sub={current ? `${current.totalOpenStops} offene Stops` : undefined}
        />
        <KpiCard
          label="Stuck"
          value={current?.stuckBatches ?? '—'}
          icon={<AlertTriangle className="w-4 h-4" />}
          color={current?.stuckBatches ? 'text-red-600' : 'text-matcha-600'}
          sub={current?.stuckBatches ? 'Kein Fortschritt >15 Min' : 'Alle in Bewegung'}
        />
        <KpiCard
          label="ETA-Risiko"
          value={current?.etaBreachRisk ?? '—'}
          icon={<Timer className="w-4 h-4" />}
          color={current?.etaBreachRisk ? 'text-amber-600' : 'text-matcha-600'}
          sub={current?.etaBreachRisk ? 'ETA überschritten' : 'Alle pünktlich'}
        />
        <KpiCard
          label="Health-Score"
          value={current ? `${current.healthScore}` : '—'}
          icon={<TrendingUp className="w-4 h-4" />}
          color={current ? healthScoreColor(current.healthScore) : 'text-gray-600'}
          sub={current?.avgCompletionPct != null
            ? `Ø ${current.avgCompletionPct}% abgeschlossen`
            : undefined}
        />
      </div>

      {/* 24h Trend Chart */}
      {trend.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">Health-Score — 24h Verlauf</span>
          </div>
          <TrendChart rows={trend} />
        </div>
      )}

      {/* Active Batches */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-gray-400" />
          Aktive Touren
        </h2>
        {!current || current.batches.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
            <CheckCircle2 className="w-8 h-8 text-matcha-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Keine aktiven Touren</p>
            <p className="text-xs text-gray-400 mt-1">Alle Lieferungen abgeschlossen oder noch keine gestartet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Stuck first, then ETA risk, then OK */}
            {[
              ...current.batches.filter((b) => b.isStuck),
              ...current.batches.filter((b) => !b.isStuck && b.hasEtaRisk),
              ...current.batches.filter((b) => !b.isStuck && !b.hasEtaRisk),
            ].map((batch) => (
              <BatchRow key={batch.batchId} batch={batch} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
