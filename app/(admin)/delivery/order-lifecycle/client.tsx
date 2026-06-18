'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, GitBranch, Clock, AlertTriangle, CheckCircle2, TrendingUp, ChefHat, Truck, Timer, Activity } from 'lucide-react';
import type { LifecycleDashboard, LifecycleStageStats, LifecycleHourRow, LifecycleTrendDay } from '@/lib/delivery/order-lifecycle';

const REFRESH_INTERVAL = 300_000; // 5 min

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMin(v: number | null): string {
  if (v == null) return '—';
  if (v < 1) return '<1 Min';
  return `${v.toFixed(1)} Min`;
}

function fmtPct(v: number | null): string {
  if (v == null) return '—';
  return `${v.toFixed(1)}%`;
}

function onTimeBg(pct: number | null): string {
  if (pct == null) return 'text-gray-400';
  if (pct >= 90) return 'text-emerald-400';
  if (pct >= 75) return 'text-amber-400';
  return 'text-red-400';
}

function totalMinColor(v: number | null): string {
  if (v == null) return 'text-gray-400';
  if (v <= 28) return 'text-emerald-400';
  if (v <= 38) return 'text-amber-400';
  return 'text-red-400';
}

function stageBg(color: string): string {
  const map: Record<string, string> = {
    'bg-purple-500':  'bg-purple-500/10 border-purple-500/30 text-purple-300',
    'bg-amber-500':   'bg-amber-500/10  border-amber-500/30  text-amber-300',
    'bg-blue-500':    'bg-blue-500/10   border-blue-500/30   text-blue-300',
    'bg-emerald-500': 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
  };
  return map[color] ?? 'bg-gray-800 border-gray-700 text-gray-300';
}

const STAGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'Dispatch-Wartezeit': Timer,
  'Küchen-Zubereitung': ChefHat,
  'Abholwartezeit':     Clock,
  'Fahrzeit':           Truck,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-white'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function StageFunnelBar({ stages }: { stages: LifecycleStageStats[] }) {
  const nonNull = stages.filter((s) => s.avgMin != null);
  if (nonNull.length === 0) {
    return <p className="text-gray-500 text-sm">Noch keine Daten vorhanden.</p>;
  }

  return (
    <div className="space-y-4">
      {/* Stacked bar */}
      <div className="flex h-6 rounded-full overflow-hidden gap-px">
        {stages.map((s) => (
          <div
            key={s.label}
            className={s.color}
            style={{ width: `${s.pct}%` }}
            title={`${s.label}: ${fmtMin(s.avgMin)} (${s.pct}%)`}
          />
        ))}
      </div>

      {/* Legend rows */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {stages.map((s) => {
          const Icon = STAGE_ICONS[s.label] ?? Activity;
          const classes = stageBg(s.color);
          return (
            <div key={s.label} className={`border rounded-lg p-3 flex items-center gap-3 ${classes}`}>
              <Icon className="h-4 w-4 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{s.label}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-base font-bold">{fmtMin(s.avgMin)}</span>
                  <span className="text-xs opacity-60">{s.pct}% der Gesamtzeit</span>
                </div>
              </div>
              {/* Mini bar */}
              <div className="w-16 h-1.5 bg-black/30 rounded-full overflow-hidden flex-shrink-0">
                <div className={`h-full rounded-full ${s.color}`} style={{ width: `${s.pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HourTable({ rows }: { rows: LifecycleHourRow[] }) {
  if (rows.length === 0) {
    return <p className="text-gray-500 text-sm">Noch keine Stundenauswertung vorhanden.</p>;
  }

  const maxTotal = Math.max(...rows.map((r) => r.avgTotalMin ?? 0), 1);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs border-b border-gray-800">
            <th className="text-left py-2 pr-4 font-normal">Uhrzeit</th>
            <th className="text-right py-2 px-2 font-normal">Bestellungen</th>
            <th className="text-right py-2 px-2 font-normal">Dispatch</th>
            <th className="text-right py-2 px-2 font-normal">Küche</th>
            <th className="text-right py-2 px-2 font-normal">Abholwart.</th>
            <th className="text-right py-2 px-2 font-normal">Fahrzeit</th>
            <th className="text-right py-2 pl-2 font-normal">Gesamt</th>
            <th className="py-2 pl-2 w-28"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {rows.map((r) => {
            const barPct = r.avgTotalMin != null ? Math.round((r.avgTotalMin / maxTotal) * 100) : 0;
            const color = r.avgTotalMin == null ? 'bg-gray-700'
              : r.avgTotalMin <= 28 ? 'bg-emerald-500'
              : r.avgTotalMin <= 38 ? 'bg-amber-500'
              : 'bg-red-500';
            return (
              <tr key={r.hourOfDay} className="hover:bg-gray-800/30">
                <td className="py-1.5 pr-4 text-gray-300 font-mono">
                  {String(r.hourOfDay).padStart(2, '0')}:00
                </td>
                <td className="text-right px-2 text-gray-400">{r.orderCount}</td>
                <td className="text-right px-2 text-purple-300">{fmtMin(r.avgDispatchWaitMin)}</td>
                <td className="text-right px-2 text-amber-300">{fmtMin(r.avgKitchenPrepMin)}</td>
                <td className="text-right px-2 text-blue-300">{fmtMin(r.avgPickupWaitMin)}</td>
                <td className="text-right px-2 text-emerald-300">{fmtMin(r.avgDriveMin)}</td>
                <td className={`text-right pl-2 font-semibold ${totalMinColor(r.avgTotalMin)}`}>
                  {fmtMin(r.avgTotalMin)}
                </td>
                <td className="pl-2">
                  <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden w-full">
                    <div className={`h-full rounded-full ${color}`} style={{ width: `${barPct}%` }} />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TrendTable({ rows }: { rows: LifecycleTrendDay[] }) {
  if (rows.length === 0) {
    return <p className="text-gray-500 text-sm">Noch keine 7-Tage-Daten vorhanden.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 text-xs border-b border-gray-800">
            <th className="text-left py-2 pr-4 font-normal">Tag</th>
            <th className="text-right py-2 px-2 font-normal">Bestellungen</th>
            <th className="text-right py-2 px-2 font-normal">Ø Gesamtzeit</th>
            <th className="text-right py-2 pl-2 font-normal">Pünktlichkeit</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800/50">
          {rows.map((r) => (
            <tr key={r.dayStr} className="hover:bg-gray-800/30">
              <td className="py-1.5 pr-4 text-gray-300">{r.dayStr}</td>
              <td className="text-right px-2 text-gray-400">{r.orderCount}</td>
              <td className={`text-right px-2 font-semibold ${totalMinColor(r.avgTotalMin)}`}>
                {fmtMin(r.avgTotalMin)}
              </td>
              <td className={`text-right pl-2 font-semibold ${onTimeBg(r.onTimePct)}`}>
                {fmtPct(r.onTimePct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Client ──────────────────────────────────────────────────────────────

type Props = {
  locationId: string;
  initial: LifecycleDashboard | null;
};

export function OrderLifecycleClient({ locationId, initial }: Props) {
  const [data, setData] = useState<LifecycleDashboard | null>(initial);
  const [loading, setLoading] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [activeTab, setActiveTab] = useState<'funnel' | 'hours' | 'trend'>('funnel');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/order-lifecycle?location_id=${locationId}`);
      const json = await res.json() as LifecycleDashboard & { ok: boolean };
      if (json.ok) setData(json);
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    const t = setInterval(load, REFRESH_INTERVAL);
    return () => clearInterval(t);
  }, [load]);

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      const res = await fetch('/api/delivery/admin/order-lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rebuild' }),
      });
      const json = await res.json() as { ok: boolean; snapped?: number };
      if (json.ok) {
        showToast(`${json.snapped ?? 0} Snapshots erstellt`, true);
        await load();
      } else {
        showToast('Fehler beim Rebuild', false);
      }
    } finally {
      setRebuilding(false);
    }
  };

  const summary = data?.summary;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6 space-y-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg
          ${toast.ok ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <GitBranch className="h-6 w-6 text-purple-400" />
          <div>
            <h1 className="text-xl font-bold">Order Lifecycle Funnel</h1>
            <p className="text-sm text-gray-400">
              4-Stufen-Analyse: Dispatch-Wartezeit → Küche → Abholwart. → Fahrzeit
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRebuild}
            disabled={rebuilding}
            className="flex items-center gap-1.5 bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
          >
            <Activity className={`h-3.5 w-3.5 ${rebuilding ? 'animate-spin' : ''}`} />
            {rebuilding ? 'Analysiere…' : 'Neu analysieren'}
          </button>
          <button
            onClick={load}
            disabled={loading}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard
          label="Analysierte Bestellungen"
          value={summary?.totalOrders != null ? String(summary.totalOrders) : '—'}
          sub="letzte 30 Tage"
        />
        <KpiCard
          label="Ø Gesamtlieferzeit"
          value={fmtMin(summary?.avgTotalMin ?? null)}
          sub="von Bestellung bis Tür"
          color={totalMinColor(summary?.avgTotalMin ?? null)}
        />
        <KpiCard
          label="Pünktlichkeitsrate"
          value={fmtPct(summary?.onTimePct ?? null)}
          sub="innerhalb ETA-Fenster"
          color={onTimeBg(summary?.onTimePct ?? null)}
        />
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Bottleneck</p>
          {summary?.bottleneckStage ? (
            <>
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-bold text-amber-300">{summary.bottleneckStage}</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">längste Durchschnittsstufe</p>
            </>
          ) : (
            <p className="text-gray-500 text-sm">—</p>
          )}
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Status</p>
          {data?.lastSnappedAt ? (
            <>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span className="text-xs text-emerald-300 font-medium">Aktiv</span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {new Date(data.lastSnappedAt).toLocaleString('de-DE', { timeZone: 'Europe/Berlin', hour: '2-digit', minute: '2-digit' })} Uhr
              </p>
            </>
          ) : (
            <p className="text-gray-500 text-sm">Noch keine Daten</p>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-gray-800">
        {([
          { key: 'funnel', label: 'Stufen-Funnel', Icon: GitBranch },
          { key: 'hours',  label: 'Stunden-Analyse', Icon: Clock },
          { key: 'trend',  label: '7-Tage-Trend', Icon: TrendingUp },
        ] as const).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px
              ${activeTab === key
                ? 'border-purple-500 text-purple-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'}`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'funnel' && (
        <div className="space-y-4">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
            <h2 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-purple-400" />
              Durchschnittliche Stufenzeiten (letzte 30 Tage)
            </h2>
            <StageFunnelBar stages={data?.stages ?? []} />
          </div>

          {/* Stage detail cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-purple-900/20 border border-purple-700/30 rounded-lg p-3 text-center">
              <Timer className="h-5 w-5 text-purple-400 mx-auto mb-1" />
              <p className="text-xs text-purple-300 mb-1">Dispatch-Wartezeit</p>
              <p className="text-xl font-bold text-purple-200">{fmtMin(summary?.avgDispatchWaitMin ?? null)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Bestellung → Küche informiert</p>
            </div>
            <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-3 text-center">
              <ChefHat className="h-5 w-5 text-amber-400 mx-auto mb-1" />
              <p className="text-xs text-amber-300 mb-1">Küchen-Zubereitung</p>
              <p className="text-xl font-bold text-amber-200">{fmtMin(summary?.avgKitchenPrepMin ?? null)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Küche informiert → fertig</p>
            </div>
            <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-3 text-center">
              <Clock className="h-5 w-5 text-blue-400 mx-auto mb-1" />
              <p className="text-xs text-blue-300 mb-1">Abholwartezeit</p>
              <p className="text-xl font-bold text-blue-200">{fmtMin(summary?.avgPickupWaitMin ?? null)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Fertig → Fahrer holt ab</p>
            </div>
            <div className="bg-emerald-900/20 border border-emerald-700/30 rounded-lg p-3 text-center">
              <Truck className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
              <p className="text-xs text-emerald-300 mb-1">Fahrzeit</p>
              <p className="text-xl font-bold text-emerald-200">{fmtMin(summary?.avgDriveMin ?? null)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Abholung → Lieferung</p>
            </div>
          </div>

          {/* Bottleneck recommendation */}
          {summary?.bottleneckStage && (
            <div className="bg-amber-900/10 border border-amber-700/30 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-300">Bottleneck erkannt: {summary.bottleneckStage}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {summary.bottleneckStage === 'Dispatch-Wartezeit' && 'Die Zeit von Bestelleingang bis Küchen-Benachrichtigung ist überdurchschnittlich lang. Prüfen Sie die Auto-Dispatch-Konfiguration.'}
                  {summary.bottleneckStage === 'Küchen-Zubereitung' && 'Die Küche braucht im Schnitt am längsten. Erwägen Sie Schicht-Aufstockung in Stoßzeiten oder Menü-Vereinfachungen.'}
                  {summary.bottleneckStage === 'Abholwartezeit' && 'Fahrer warten lange auf fertige Bestellungen. Koordinieren Sie Küchentiming mit der Fahrer-Ankunft besser.'}
                  {summary.bottleneckStage === 'Fahrzeit' && 'Die Fahrtdauer ist die größte Komponente. Prüfen Sie Zonen-Zuschnitt und Bündelungs-Effizienz.'}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'hours' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-400" />
            Stunden-Analyse — Ø Stufenzeiten je Tageszeit (letzte 30 Tage)
          </h2>
          <HourTable rows={data?.byHour ?? []} />
          <div className="flex flex-wrap gap-4 mt-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-500 inline-block" /> Dispatch-Wartezeit</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> Küchen-Zubereitung</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Abholwartezeit</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Fahrzeit</span>
          </div>
        </div>
      )}

      {activeTab === 'trend' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-200 mb-4 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            7-Tage-Trend — Ø Gesamtlieferzeit & Pünktlichkeit
          </h2>
          <TrendTable rows={data?.trend7d ?? []} />
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && (
        <div className="text-center py-16 text-gray-500">
          <GitBranch className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Noch keine Lifecycle-Daten</p>
          <p className="text-sm mt-1">Klicke „Neu analysieren" um Snapshots zu erstellen.</p>
        </div>
      )}
    </div>
  );
}
