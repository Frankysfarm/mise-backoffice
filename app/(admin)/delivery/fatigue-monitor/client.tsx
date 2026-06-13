'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  AlertTriangle, CheckCircle2, RefreshCw, Clock, Users,
  Zap, TrendingUp, Info, Activity, Heart, ShieldAlert,
  Coffee, Timer,
} from 'lucide-react';

// ─── Typen ────────────────────────────────────────────────────────────────────

type FatigueRiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface FatigueSnapshot {
  id: string;
  locationId: string;
  driverId: string;
  snapshotAt: string;
  shiftId: string | null;
  hoursOnShift: number;
  shiftDeliveries: number;
  deliveriesLast60min: number;
  deliveriesLast30min: number;
  avgDeliveryMinShift: number | null;
  avgDeliveryMinLast3: number | null;
  lastDeliveryAgoMin: number | null;
  longestBreakMin: number;
  breakCount: number;
  speedDriftPct: number;
  lateDeliveriesShift: number;
  lateRateShift: number;
  fatigueScore: number;
  riskLevel: FatigueRiskLevel;
}

interface FatigueAlert {
  id: string;
  locationId: string;
  driverId: string;
  triggeredAt: string;
  resolvedAt: string | null;
  riskLevel: FatigueRiskLevel;
  fatigueScore: number;
  triggerReason: string;
  actionTaken: string;
  notes: string | null;
}

interface DriverFatigueState {
  driverId: string;
  driverName: string;
  driverVehicle: string;
  driverState: string;
  snapshot: FatigueSnapshot | null;
  openAlert: FatigueAlert | null;
}

interface FatigueTrendBucket {
  hourBucket: string;
  avgFatigueScore: number;
  maxFatigueScore: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
}

interface FatigueAlertRow {
  id: string;
  driverId: string;
  driverName: string;
  riskLevel: FatigueRiskLevel;
  fatigueScore: number;
  triggerReason: string;
  actionTaken: string;
  triggeredAt: string;
  resolvedAt: string | null;
  minutesAgo: number;
}

interface FatigueAlertStats {
  openCount: number;
  alerts24h: number;
  alerts7d: number;
  criticalOpen: number;
  driversAtRisk: number;
  avgOpenScore: number | null;
}

interface FatigueDashboard {
  locationId: string;
  asOf: string;
  driversMonitored: number;
  driversAtRisk: number;
  criticalCount: number;
  avgFatigueScore: number;
  currentStates: DriverFatigueState[];
  trend24h: FatigueTrendBucket[];
  recentAlerts: FatigueAlertRow[];
  alertStats: FatigueAlertStats;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const RISK_META: Record<FatigueRiskLevel, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  low:      { label: 'OK',       color: 'text-emerald-700', bg: 'bg-emerald-50',  border: 'border-emerald-200', icon: <CheckCircle2 className="h-4 w-4" /> },
  medium:   { label: 'Mittel',   color: 'text-amber-700',   bg: 'bg-amber-50',    border: 'border-amber-200',   icon: <AlertTriangle className="h-4 w-4" /> },
  high:     { label: 'Hoch',     color: 'text-orange-700',  bg: 'bg-orange-50',   border: 'border-orange-200',  icon: <ShieldAlert className="h-4 w-4" /> },
  critical: { label: 'Kritisch', color: 'text-red-700',     bg: 'bg-red-50',      border: 'border-red-200',     icon: <AlertTriangle className="h-4 w-4" /> },
};

function ScoreBar({ score, risk }: { score: number; risk: FatigueRiskLevel }) {
  const colors: Record<FatigueRiskLevel, string> = {
    low:      'bg-emerald-500',
    medium:   'bg-amber-500',
    high:     'bg-orange-500',
    critical: 'bg-red-600',
  };
  return (
    <div className="w-full bg-zinc-200 rounded-full h-2 overflow-hidden">
      <div
        className={`h-2 rounded-full transition-all duration-500 ${colors[risk]}`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

function RiskBadge({ level }: { level: FatigueRiskLevel }) {
  const m = RISK_META[level];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border ${m.color} ${m.bg} ${m.border}`}>
      {m.icon}
      {m.label}
    </span>
  );
}

function formatTriggers(raw: string): string {
  return raw
    .split('|')
    .map((t) => {
      const map: Record<string, string> = {
        hours_exceeded_10:  '>10h Schicht',
        hours_exceeded_8:   '>8h Schicht',
        hours_exceeded_6:   '>6h Schicht',
        speed_drift_critical: 'Geschw. -40%+',
        speed_drift_high:   'Geschw. -25%+',
        late_rate_critical: 'Verspätungsrate 50%+',
        late_rate_high:     'Verspätungsrate 35%+',
        no_break_4h:        '4h ohne Pause',
        overload_60min:     '10+ Stops/Stunde',
        score_threshold:    'Score-Grenzwert',
        auto_resolved:      'Auto aufgelöst',
        manual_resolve:     'Manuell aufgelöst',
        break_recommended:  'Pause empfohlen',
        shift_ended:        'Schicht beendet',
        admin_notified:     'Admin benachrichtigt',
      };
      return map[t] ?? t;
    })
    .join(' · ');
}

// ─── Fahrer-Karte ─────────────────────────────────────────────────────────────

function DriverFatigueCard({
  state,
  onResolveAlert,
}: {
  state: DriverFatigueState;
  onResolveAlert: (alertId: string, action: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const snap = state.snapshot;
  if (!snap) return null;

  const m = RISK_META[snap.riskLevel];
  const vehicleLabel = state.driverVehicle === 'car' ? '🚗' : state.driverVehicle === 'bike' ? '🚲' : '🛵';

  return (
    <div className={`rounded-2xl border-2 ${m.border} ${m.bg} overflow-hidden`}>
      {/* Header */}
      <button
        className="w-full text-left px-4 py-3 flex items-center gap-3"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className={`shrink-0 h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm ${m.bg} border-2 ${m.border} ${m.color}`}>
          {state.driverName.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-zinc-900 text-sm">{vehicleLabel} {state.driverName}</span>
            <RiskBadge level={snap.riskLevel} />
            {state.openAlert && (
              <span className="text-xs font-semibold text-red-700 bg-red-100 px-1.5 py-0.5 rounded-full animate-pulse">
                Alert offen
              </span>
            )}
          </div>
          <div className="mt-1">
            <ScoreBar score={snap.fatigueScore} risk={snap.riskLevel} />
          </div>
          <div className="mt-1 flex items-center gap-3 text-xs text-zinc-500">
            <span>Score: <strong className={m.color}>{snap.fatigueScore}/100</strong></span>
            <span>{snap.hoursOnShift.toFixed(1)}h Schicht</span>
            <span>{snap.shiftDeliveries} Lieferungen</span>
          </div>
        </div>
        <div className="shrink-0 text-zinc-400 text-xs">{expanded ? '▲' : '▼'}</div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-zinc-200 px-4 py-3 space-y-3">
          {/* KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <KpiCell label="Geschw.-Drift" value={snap.speedDriftPct >= 0 ? `+${snap.speedDriftPct.toFixed(0)}%` : `${snap.speedDriftPct.toFixed(0)}%`} warn={snap.speedDriftPct >= 15} />
            <KpiCell label="Verspätungsrate" value={`${(snap.lateRateShift * 100).toFixed(0)}%`} warn={snap.lateRateShift >= 0.2} />
            <KpiCell label="Letzte Lieferung" value={snap.lastDeliveryAgoMin != null ? `${snap.lastDeliveryAgoMin} min` : '—'} />
            <KpiCell label="Längste Pause" value={`${snap.longestBreakMin} min`} warn={snap.longestBreakMin < 15 && snap.hoursOnShift >= 4} />
            <KpiCell label="Stops /60 min" value={String(snap.deliveriesLast60min)} warn={snap.deliveriesLast60min >= 7} />
            <KpiCell label="Ø Zeit Schicht" value={snap.avgDeliveryMinShift != null ? `${snap.avgDeliveryMinShift.toFixed(0)} min` : '—'} />
          </div>

          {/* Open alert */}
          {state.openAlert && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-2">
              <div className="text-xs font-bold text-red-700 flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5" />
                Offener Alert — {formatTriggers(state.openAlert.triggerReason)}
              </div>
              <div className="flex gap-2 flex-wrap">
                {(['break_recommended', 'shift_ended', 'admin_notified'] as const).map((act) => (
                  <button
                    key={act}
                    onClick={() => onResolveAlert(state.openAlert!.id, act)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-white border border-red-300 text-red-700 hover:bg-red-100 transition font-medium"
                  >
                    {formatTriggers(act)}
                  </button>
                ))}
                <button
                  onClick={() => onResolveAlert(state.openAlert!.id, 'manual_resolve')}
                  className="text-xs px-2.5 py-1 rounded-lg bg-white border border-zinc-300 text-zinc-600 hover:bg-zinc-100 transition"
                >
                  Schließen
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KpiCell({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg px-2.5 py-2 ${warn ? 'bg-amber-100 border border-amber-300' : 'bg-white border border-zinc-200'}`}>
      <div className="text-[10px] text-zinc-500 leading-none mb-0.5">{label}</div>
      <div className={`text-sm font-bold ${warn ? 'text-amber-800' : 'text-zinc-800'}`}>{value}</div>
    </div>
  );
}

// ─── Haupt-Komponente ─────────────────────────────────────────────────────────

export function FatigueMonitorClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<FatigueDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapshotting, setSnapshotting] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/admin/fatigue-monitor?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000); // 60s auto-refresh
    return () => clearInterval(iv);
  }, [load]);

  const triggerSnapshot = async () => {
    setSnapshotting(true);
    try {
      await fetch('/api/delivery/admin/fatigue-monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'snapshot' }),
      });
      await load();
    } finally {
      setSnapshotting(false);
    }
  };

  const resolveAlert = async (alertId: string, actionTaken: string) => {
    await fetch('/api/delivery/admin/fatigue-monitor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolve', alert_id: alertId, action_taken: actionTaken }),
    });
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-zinc-400">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Lade Fatigue-Monitor…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border-2 border-zinc-200 p-8 text-center text-zinc-400">
        Keine Daten verfügbar — starte einen Snapshot.
      </div>
    );
  }

  const s = data.alertStats;
  const overallRisk: FatigueRiskLevel =
    data.criticalCount > 0 ? 'critical'
    : data.driversAtRisk >= 2 ? 'high'
    : data.driversAtRisk > 0 ? 'medium'
    : 'low';
  const overallMeta = RISK_META[overallRisk];

  // Sort drivers: critical first, then high, medium, low
  const riskOrder: FatigueRiskLevel[] = ['critical', 'high', 'medium', 'low'];
  const sorted = [...data.currentStates].sort((a, b) => {
    const ra = riskOrder.indexOf(a.snapshot?.riskLevel ?? 'low');
    const rb = riskOrder.indexOf(b.snapshot?.riskLevel ?? 'low');
    return ra - rb;
  });

  return (
    <div className="space-y-6">
      {/* Status Hero */}
      <div className={`rounded-2xl border-2 ${overallMeta.border} ${overallMeta.bg} px-5 py-4 flex items-center gap-4`}>
        <div className={`h-14 w-14 rounded-full flex items-center justify-center ${overallMeta.bg} border-2 ${overallMeta.border} ${overallMeta.color} ${overallRisk === 'critical' ? 'animate-pulse' : ''}`}>
          <Heart className="h-7 w-7" />
        </div>
        <div className="flex-1">
          <div className={`text-lg font-black ${overallMeta.color}`}>
            System-Status: {overallMeta.label}
          </div>
          <div className="text-sm text-zinc-600">
            {data.driversMonitored} Fahrer überwacht · {data.driversAtRisk} mit erhöhtem Risiko
            {data.criticalCount > 0 && (
              <span className="ml-2 text-red-700 font-bold animate-pulse">{data.criticalCount}× Kritisch!</span>
            )}
          </div>
        </div>
        <button
          onClick={triggerSnapshot}
          disabled={snapshotting}
          className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl bg-white border-2 border-zinc-200 text-zinc-700 hover:bg-zinc-50 transition text-sm font-semibold disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${snapshotting ? 'animate-spin' : ''}`} />
          Jetzt scannen
        </button>
      </div>

      {/* KPI Karten */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard icon={<Users className="h-5 w-5 text-zinc-500" />} label="Fahrer online" value={data.driversMonitored} />
        <StatCard icon={<Activity className="h-5 w-5 text-amber-500" />} label="Fahrer mit Risiko" value={data.driversAtRisk} warn={data.driversAtRisk > 0} />
        <StatCard icon={<ShieldAlert className="h-5 w-5 text-red-500" />} label="Kritische Alerts" value={s.criticalOpen} warn={s.criticalOpen > 0} />
        <StatCard icon={<Zap className="h-5 w-5 text-zinc-500" />} label="Ø Fatigue-Score" value={`${data.avgFatigueScore}/100`} warn={data.avgFatigueScore >= 40} />
      </div>

      {/* Fahrer-Cards */}
      <div className="space-y-2">
        <h3 className="font-bold text-zinc-900 flex items-center gap-2">
          <Users className="h-4 w-4 text-zinc-500" />
          Aktive Fahrer ({sorted.length})
        </h3>
        {sorted.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-zinc-200 p-8 text-center text-zinc-400 text-sm">
            Keine Online-Fahrer — kein Fatigue-Risiko
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((state) => (
              <DriverFatigueCard
                key={state.driverId}
                state={state}
                onResolveAlert={resolveAlert}
              />
            ))}
          </div>
        )}
      </div>

      {/* 24h Trend */}
      {data.trend24h.length > 0 && (
        <div className="rounded-2xl border-2 border-zinc-200 bg-white p-4 space-y-3">
          <h3 className="font-bold text-zinc-900 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-zinc-500" />
            24h Trend
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-500">
                  <th className="text-left pb-1 pr-3 font-semibold">Stunde</th>
                  <th className="text-right pb-1 pr-3 font-semibold">Ø Score</th>
                  <th className="text-right pb-1 pr-3 font-semibold">Max</th>
                  <th className="text-right pb-1 pr-3 font-semibold text-red-600">Kritisch</th>
                  <th className="text-right pb-1 font-semibold text-orange-600">Hoch</th>
                </tr>
              </thead>
              <tbody>
                {data.trend24h.slice(0, 12).map((b) => {
                  const h = new Date(b.hourBucket).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' });
                  const risk = b.avgFatigueScore >= 55 ? 'high' : b.avgFatigueScore >= 30 ? 'medium' : 'low';
                  const m2 = RISK_META[risk];
                  return (
                    <tr key={b.hourBucket} className="border-t border-zinc-100">
                      <td className="py-1.5 pr-3 font-medium text-zinc-700">{h}</td>
                      <td className={`text-right pr-3 font-bold ${m2.color}`}>{b.avgFatigueScore.toFixed(0)}</td>
                      <td className="text-right pr-3 text-zinc-500">{b.maxFatigueScore}</td>
                      <td className="text-right pr-3 text-red-600 font-semibold">{b.criticalCount || '—'}</td>
                      <td className="text-right text-orange-600 font-semibold">{b.highCount || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Letzte Alerts */}
      {data.recentAlerts.length > 0 && (
        <div className="rounded-2xl border-2 border-zinc-200 bg-white p-4 space-y-3">
          <h3 className="font-bold text-zinc-900 flex items-center gap-2">
            <Timer className="h-4 w-4 text-zinc-500" />
            Letzte Alerts
          </h3>
          <div className="space-y-2">
            {data.recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`rounded-xl border px-3 py-2.5 flex items-start gap-3 ${alert.resolvedAt ? 'bg-zinc-50 border-zinc-200 opacity-60' : `${RISK_META[alert.riskLevel].bg} ${RISK_META[alert.riskLevel].border}`}`}
              >
                <div className="shrink-0 mt-0.5">
                  <RiskBadge level={alert.riskLevel} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-zinc-900">{alert.driverName}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {formatTriggers(alert.triggerReason)}
                    {alert.resolvedAt && (
                      <span className="ml-2 text-emerald-600 font-medium">✓ {formatTriggers(alert.actionTaken)}</span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-xs text-zinc-400">
                  {alert.minutesAgo < 60
                    ? `${alert.minutesAgo} min`
                    : `${Math.round(alert.minutesAgo / 60)}h`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="rounded-2xl border-2 border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 space-y-1">
        <div className="font-bold flex items-center gap-1.5">
          <Info className="h-4 w-4" />
          Wie wird der Fatigue-Score berechnet?
        </div>
        <ul className="list-disc pl-4 space-y-0.5 text-xs">
          <li><strong>Schichtdauer (40 Pkt.)</strong>: &gt;6h = 20 Pkt., &gt;8h = 30 Pkt., &gt;10h = 40 Pkt.</li>
          <li><strong>Geschwindigkeits-Drift (20 Pkt.)</strong>: Aktuelle Ø-Lieferzeit vs. Schichtbeginn</li>
          <li><strong>Verspätungsrate (20 Pkt.)</strong>: Anteil Lieferungen nach ETA-Fenster</li>
          <li><strong>Pause-Defizit (15 Pkt.)</strong>: Keine Pause &gt;15 min nach 4h Arbeit</li>
          <li><strong>Überlastung (5 Pkt.)</strong>: &ge;10 Stops in der letzten Stunde</li>
        </ul>
        <div className="mt-1 text-xs font-semibold">
          <Coffee className="inline h-3.5 w-3.5 mr-0.5" />
          Empfehlung: ab Score 55 (Hoch) aktiv auf Pause ansprechen. Ab 75 (Kritisch): Schicht beenden.
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  warn = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  warn?: boolean;
}) {
  return (
    <div className={`rounded-2xl border-2 px-4 py-3 ${warn ? 'border-amber-300 bg-amber-50' : 'border-zinc-200 bg-white'}`}>
      <div className="flex items-center gap-2 mb-1">{icon}<span className="text-xs text-zinc-500">{label}</span></div>
      <div className={`text-2xl font-black ${warn ? 'text-amber-800' : 'text-zinc-900'}`}>{value}</div>
    </div>
  );
}
