'use client';

import { useEffect, useState, useCallback } from 'react';
import { Sparkles, AlertTriangle, TrendingUp, Users, RefreshCw, ShieldCheck, Heart, Coins } from 'lucide-react';

// ─── Types (mirrors lib/delivery/driver-wellbeing.ts) ────────────────────────

type WellbeingTier = 'thriving' | 'healthy' | 'stressed' | 'burnout_risk';
type InterventionType = 'rest_suggestion' | 'bonus' | 'message';

interface WellbeingOverview {
  totalDrivers: number;
  avgWellbeingScore: number;
  thrivingCount: number;
  healthyCount: number;
  stressedCount: number;
  burnoutRiskCount: number;
  interventionsToday: number;
}

interface WellbeingRow {
  id: string;
  driverId: string;
  driverName: string | null;
  vehicleType: string | null;
  wellbeingScore: number;
  wellbeingTier: WellbeingTier;
  fatigueComponent: number;
  satisfactionComponent: number;
  retentionComponent: number;
  incentiveComponent: number;
  latestFatigueScore: number | null;
  latestSatisfactionScore: number | null;
  latestRetentionScore: number | null;
  incentiveEur7d: number | null;
  interventionTriggered: boolean;
  interventionType: InterventionType | null;
  wellbeingRank: number;
}

interface TrendPoint {
  snapshotDate: string;
  avgWellbeingScore: number;
  thrivingCount: number;
  burnoutRiskCount: number;
}

interface Dashboard {
  overview: WellbeingOverview | null;
  atRisk: WellbeingRow[];
  trend7d: TrendPoint[];
  leaderboard: WellbeingRow[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TIER_COLOR: Record<WellbeingTier, string> = {
  thriving:    'bg-emerald-500',
  healthy:     'bg-blue-500',
  stressed:    'bg-amber-500',
  burnout_risk:'bg-red-500',
};

const TIER_TEXT_COLOR: Record<WellbeingTier, string> = {
  thriving:    'text-emerald-700 bg-emerald-50 ring-emerald-200',
  healthy:     'text-blue-700 bg-blue-50 ring-blue-200',
  stressed:    'text-amber-700 bg-amber-50 ring-amber-200',
  burnout_risk:'text-red-700 bg-red-50 ring-red-200',
};

const TIER_LABEL: Record<WellbeingTier, string> = {
  thriving:    'Bestens',
  healthy:     'Gesund',
  stressed:    'Belastet',
  burnout_risk:'Burnout-Risiko',
};

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span className="font-medium text-gray-700">{value}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function DriverCard({ row, onIntervene }: { row: WellbeingRow; onIntervene: (driverId: string, type: InterventionType) => Promise<void> }) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState<InterventionType | null>(null);
  const initials = (row.driverName ?? '??').split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();

  async function handleIntervene(type: InterventionType) {
    setLoading(type);
    await onIntervene(row.driverId, type);
    setLoading(null);
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600 shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-gray-900 truncate">{row.driverName ?? 'Unbekannt'}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ring-1 font-medium ${TIER_TEXT_COLOR[row.wellbeingTier]}`}>
              {TIER_LABEL[row.wellbeingTier]}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">Wellbeing-Score: <span className="font-semibold text-gray-700">{row.wellbeingScore}</span>/100</div>
        </div>
        <div className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</div>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-3">
          <div className="space-y-2">
            <ScoreBar label="Ermüdung (invertiert)" value={row.fatigueComponent}      color="bg-purple-400" />
            <ScoreBar label="Zufriedenheit"         value={row.satisfactionComponent} color="bg-blue-400"   />
            <ScoreBar label="Retention"             value={row.retentionComponent}    color="bg-emerald-400"/>
            <ScoreBar label="Incentive-Health"      value={row.incentiveComponent}    color="bg-amber-400"  />
          </div>
          <div className="text-xs text-gray-500 grid grid-cols-2 gap-1">
            {row.latestFatigueScore    != null && <span>Ermüdungs-Score: {row.latestFatigueScore}</span>}
            {row.latestSatisfactionScore != null && <span>Zufriedenheit: {row.latestSatisfactionScore}</span>}
            {row.latestRetentionScore  != null && <span>Retention: {row.latestRetentionScore}</span>}
            {row.incentiveEur7d        != null && <span>Incentives 7d: €{row.incentiveEur7d.toFixed(2)}</span>}
          </div>
          {!row.interventionTriggered ? (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handleIntervene('rest_suggestion')}
                disabled={loading !== null}
                className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded hover:bg-blue-100 disabled:opacity-50"
              >
                <Heart className="w-3 h-3" />
                {loading === 'rest_suggestion' ? '…' : 'Pause empfehlen'}
              </button>
              <button
                onClick={() => handleIntervene('bonus')}
                disabled={loading !== null}
                className="flex items-center gap-1 text-xs px-2 py-1 bg-emerald-50 text-emerald-700 rounded hover:bg-emerald-100 disabled:opacity-50"
              >
                <Coins className="w-3 h-3" />
                {loading === 'bonus' ? '…' : '€5-Wellbeing-Bonus'}
              </button>
              <button
                onClick={() => handleIntervene('message')}
                disabled={loading !== null}
                className="flex items-center gap-1 text-xs px-2 py-1 bg-amber-50 text-amber-700 rounded hover:bg-amber-100 disabled:opacity-50"
              >
                <ShieldCheck className="w-3 h-3" />
                {loading === 'message' ? '…' : 'Nachricht senden'}
              </button>
            </div>
          ) : (
            <div className="text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-1 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Intervention ausgelöst: {row.interventionType}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function WellbeingClient() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [snapshotting, setSnapshotting] = useState(false);
  const [activeTab, setActiveTab] = useState<'at_risk' | 'leaderboard' | 'trend'>('at_risk');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/driver-wellbeing');
      const json = await res.json() as { ok: boolean; data: Dashboard };
      if (json.ok) setDashboard(json.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const interval = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [load]);

  async function handleSnapshot() {
    setSnapshotting(true);
    await fetch('/api/delivery/admin/driver-wellbeing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'snapshot' }),
    });
    await load();
    setSnapshotting(false);
  }

  async function handleIntervene(driverId: string, type: InterventionType) {
    await fetch('/api/delivery/admin/driver-wellbeing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'trigger_intervention', driver_id: driverId, intervention_type: type }),
    });
    await load();
  }

  const ov = dashboard?.overview;

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[300px] text-gray-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" /> Lade Wellbeing-Daten …
      </div>
    );
  }

  // Tier breakdown bar widths
  const total = ov?.totalDrivers || 1;
  const pctThriving    = Math.round(((ov?.thrivingCount    ?? 0) / total) * 100);
  const pctHealthy     = Math.round(((ov?.healthyCount     ?? 0) / total) * 100);
  const pctStressed    = Math.round(((ov?.stressedCount    ?? 0) / total) * 100);
  const pctBurnout     = Math.round(((ov?.burnoutRiskCount ?? 0) / total) * 100);

  // Trend chart helpers
  const trend = dashboard?.trend7d ?? [];
  const maxTrendScore = Math.max(...trend.map(t => t.avgWellbeingScore), 1);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-7 h-7 text-purple-500" /> Fahrer-Wellbeing-Index
          </h1>
          <p className="text-sm text-gray-500 mt-1">Burnout-Prävention: Ermüdung + Zufriedenheit + Retention + Incentive-Health</p>
        </div>
        <button
          onClick={handleSnapshot}
          disabled={snapshotting}
          className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${snapshotting ? 'animate-spin' : ''}`} />
          {snapshotting ? 'Berechne …' : 'Jetzt berechnen'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Ø Wellbeing</div>
          <div className="text-3xl font-bold text-purple-600">{ov?.avgWellbeingScore ?? '—'}</div>
          <div className="text-xs text-gray-400 mt-0.5">{ov?.totalDrivers ?? 0} Fahrer</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3 text-emerald-500" /> Bestens</div>
          <div className="text-3xl font-bold text-emerald-600">{ov?.thrivingCount ?? 0}</div>
          <div className="text-xs text-gray-400 mt-0.5">{pctThriving}% der Fahrer</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-red-500" /> Burnout-Risiko</div>
          <div className="text-3xl font-bold text-red-600">{ov?.burnoutRiskCount ?? 0}</div>
          <div className="text-xs text-gray-400 mt-0.5">{pctBurnout}% der Fahrer</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <div className="text-xs text-gray-500 mb-1 flex items-center gap-1"><Users className="w-3 h-3 text-blue-500" /> Interventionen heute</div>
          <div className="text-3xl font-bold text-blue-600">{ov?.interventionsToday ?? 0}</div>
          <div className="text-xs text-gray-400 mt-0.5">ausgelöst</div>
        </div>
      </div>

      {/* Tier Distribution Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="text-sm font-medium text-gray-700 mb-3">Tier-Verteilung</div>
        <div className="h-4 rounded-full overflow-hidden flex">
          <div className="bg-emerald-500 h-full transition-all" style={{ width: `${pctThriving}%` }} title={`Bestens: ${ov?.thrivingCount}`} />
          <div className="bg-blue-500 h-full transition-all"    style={{ width: `${pctHealthy}%` }}  title={`Gesund: ${ov?.healthyCount}`} />
          <div className="bg-amber-500 h-full transition-all"   style={{ width: `${pctStressed}%` }} title={`Belastet: ${ov?.stressedCount}`} />
          <div className="bg-red-500 h-full transition-all"     style={{ width: `${pctBurnout}%` }}  title={`Burnout-Risiko: ${ov?.burnoutRiskCount}`} />
        </div>
        <div className="flex gap-4 mt-2 flex-wrap">
          {([
            ['Bestens',       ov?.thrivingCount    ?? 0, 'bg-emerald-500'],
            ['Gesund',        ov?.healthyCount     ?? 0, 'bg-blue-500'],
            ['Belastet',      ov?.stressedCount    ?? 0, 'bg-amber-500'],
            ['Burnout-Risiko',ov?.burnoutRiskCount ?? 0, 'bg-red-500'],
          ] as [string, number, string][]).map(([label, count, color]) => (
            <div key={label} className="flex items-center gap-1.5 text-xs text-gray-600">
              <div className={`w-2.5 h-2.5 rounded-full ${color}`} />
              {label}: <span className="font-semibold">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200">
          {([
            ['at_risk',     `Gefährdete Fahrer (${(dashboard?.atRisk.length ?? 0)})`],
            ['leaderboard', 'Wellbeing-Rangliste'],
            ['trend',       '7-Tage-Trend'],
          ] as [typeof activeTab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-purple-700 border-b-2 border-purple-600 bg-purple-50'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-4">
          {/* At-Risk Tab */}
          {activeTab === 'at_risk' && (
            <div className="space-y-2">
              {(dashboard?.atRisk.length ?? 0) === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Sparkles className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                  <p className="text-sm">Alle Fahrer sind im gesunden Bereich!</p>
                </div>
              ) : (
                dashboard?.atRisk.map(row => (
                  <DriverCard key={row.id} row={row} onIntervene={handleIntervene} />
                ))
              )}
            </div>
          )}

          {/* Leaderboard Tab */}
          {activeTab === 'leaderboard' && (
            <div className="space-y-2">
              {(dashboard?.leaderboard ?? []).map(row => {
                const initials = (row.driverName ?? '??').split(' ').map((p: string) => p[0]).join('').slice(0, 2).toUpperCase();
                return (
                  <div key={row.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0">
                      #{row.wellbeingRank}
                    </div>
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-xs font-semibold text-purple-700 shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">{row.driverName ?? 'Unbekannt'}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ring-1 font-medium ${TIER_TEXT_COLOR[row.wellbeingTier]}`}>
                          {TIER_LABEL[row.wellbeingTier]}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-gray-800">{row.wellbeingScore}</div>
                      <div className="text-xs text-gray-400">/ 100</div>
                    </div>
                    <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${TIER_COLOR[row.wellbeingTier]}`}
                        style={{ width: `${row.wellbeingScore}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Trend Tab */}
          {activeTab === 'trend' && (
            <div>
              {trend.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-sm">Noch keine Trenddaten verfügbar</div>
              ) : (
                <div className="space-y-3">
                  {/* SVG Bar Chart */}
                  <svg viewBox="0 0 560 120" className="w-full" preserveAspectRatio="none">
                    {trend.map((t, i) => {
                      const barH = Math.round((t.avgWellbeingScore / maxTrendScore) * 90);
                      const x = i * (560 / trend.length) + 4;
                      const w = (560 / trend.length) - 8;
                      const scoreColor = t.avgWellbeingScore >= 80 ? '#10b981'
                        : t.avgWellbeingScore >= 60 ? '#3b82f6'
                        : t.avgWellbeingScore >= 40 ? '#f59e0b'
                        : '#ef4444';
                      return (
                        <g key={t.snapshotDate}>
                          <rect x={x} y={120 - barH - 10} width={w} height={barH} rx="3" fill={scoreColor} opacity="0.8" />
                          <text x={x + w / 2} y={118} textAnchor="middle" fontSize="8" fill="#9ca3af">
                            {t.snapshotDate.slice(5)}
                          </text>
                          <text x={x + w / 2} y={120 - barH - 14} textAnchor="middle" fontSize="9" fontWeight="600" fill="#374151">
                            {t.avgWellbeingScore}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                  {/* Burnout risk counts */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                    {trend.slice(-4).map(t => (
                      <div key={t.snapshotDate} className="bg-gray-50 rounded-lg p-2 text-xs">
                        <div className="text-gray-400">{t.snapshotDate.slice(5)}</div>
                        <div className="font-semibold text-gray-700">Ø {t.avgWellbeingScore}</div>
                        <div className="text-emerald-600">{t.thrivingCount} Bestens</div>
                        <div className="text-red-500">{t.burnoutRiskCount} Burnout-Risiko</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
