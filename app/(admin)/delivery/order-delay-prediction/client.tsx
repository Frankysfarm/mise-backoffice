'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Clock, TrendingDown, CheckCircle, RefreshCw, Zap, Activity } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RiskFactors {
  kitchenLoad: number;
  peakHourScore: number;
  zoneDistanceScore: number;
  weatherPenalty: number;
  orderComplexity: number;
  driverShortage: number;
  historicalLateRate: number;
}

type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

interface DelayPrediction {
  id: string;
  orderId: string;
  delayRiskScore: number;
  riskLevel: RiskLevel;
  predictedDelayMin: number | null;
  riskFactors: RiskFactors;
  bestellnummer?: string;
  orderStatus?: string;
  kundeAdresse?: string | null;
  etaEarliest?: string | null;
  deliveryZone?: string | null;
  orderCreatedAt?: string;
}

interface AccuracyRow {
  riskLevel: RiskLevel;
  totalPredictions: number;
  settled: number;
  avgRiskScore: number;
  avgPredictedDelayMin: number | null;
  avgActualDelayMin: number | null;
  avgAbsErrorMin: number | null;
  actualLateRate: number | null;
}

interface Summary {
  totalActive: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  avgRiskScore: number;
  settledToday: number;
  avgActualDelayMin: number | null;
}

interface Dashboard {
  activePredictions: DelayPrediction[];
  accuracy: AccuracyRow[];
  summary: Summary;
  computedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RISK_CONFIG: Record<RiskLevel, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
  low:      { label: 'Niedrig',   bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: <CheckCircle className="w-4 h-4" /> },
  medium:   { label: 'Mittel',    bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   icon: <Clock className="w-4 h-4" /> },
  high:     { label: 'Hoch',      bg: 'bg-orange-50',  text: 'text-orange-700',  border: 'border-orange-200',  icon: <AlertTriangle className="w-4 h-4" /> },
  critical: { label: 'Kritisch',  bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     icon: <AlertTriangle className="w-4 h-4" /> },
};

const FACTOR_LABELS: Record<keyof RiskFactors, string> = {
  kitchenLoad:        'Küchenauslastung',
  peakHourScore:      'Stoßzeit',
  zoneDistanceScore:  'Zonen-Distanz',
  weatherPenalty:     'Wetter',
  orderComplexity:    'Bestellkomplexität',
  driverShortage:     'Fahrermangel',
  historicalLateRate: 'Historische Verspätungsrate',
};

function FactorBar({ value, label }: { value: number; label: string }) {
  const color = value >= 75 ? 'bg-red-500' : value >= 50 ? 'bg-amber-500' : value >= 25 ? 'bg-yellow-400' : 'bg-emerald-500';
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium text-gray-800">{value}</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function PredictionCard({ p, expanded, onToggle }: {
  p: DelayPrediction;
  expanded: boolean;
  onToggle: () => void;
}) {
  const cfg = RISK_CONFIG[p.riskLevel];
  return (
    <div className={`border rounded-lg p-3 ${cfg.bg} ${cfg.border} cursor-pointer hover:shadow-sm transition-shadow`} onClick={onToggle}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`flex-shrink-0 ${cfg.text}`}>{cfg.icon}</span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900 text-sm">
                #{p.bestellnummer ?? p.orderId.slice(0, 8)}
              </span>
              <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                {cfg.label}
              </span>
              {p.deliveryZone && (
                <span className="text-xs bg-white/80 border border-gray-200 text-gray-600 px-1.5 py-0.5 rounded">
                  Zone {p.deliveryZone}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{p.kundeAdresse ?? '—'}</p>
          </div>
        </div>
        <div className="flex-shrink-0 text-right">
          <div className={`text-2xl font-bold ${cfg.text}`}>{p.delayRiskScore}</div>
          <div className="text-xs text-gray-500">/ 100</div>
          {p.predictedDelayMin && (
            <div className="text-xs text-gray-600 mt-0.5">+{p.predictedDelayMin} min</div>
          )}
        </div>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-gray-200/70 space-y-1.5">
          {(Object.entries(p.riskFactors) as Array<[keyof RiskFactors, number]>).map(([key, val]) => (
            <FactorBar key={key} label={FACTOR_LABELS[key]} value={val} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OrderDelayPredictionClient() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterLevel, setFilterLevel] = useState<RiskLevel | 'all'>('all');
  const [tab, setTab] = useState<'active' | 'accuracy'>('active');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/delivery/admin/order-delay-prediction?action=dashboard');
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // 60s auto-refresh
  useEffect(() => {
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const runAction = async (action: string) => {
    setActionLoading(true);
    try {
      await fetch('/api/delivery/admin/order-delay-prediction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      await load();
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  const s = data?.summary;
  const predictions = data?.activePredictions ?? [];
  const filtered = filterLevel === 'all' ? predictions : predictions.filter(p => p.riskLevel === filterLevel);

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Activity className="w-6 h-6 text-orange-600" />
            Order Delay Prediction
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Proaktive Verspätungs-Risikoanalyse — 7 Signalfaktoren
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => runAction('predict_now')}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <Zap className="w-4 h-4" /> Jetzt scannen
          </button>
          <button
            onClick={load}
            disabled={loading || actionLoading}
            className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* KPI Band */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-3xl font-bold text-gray-900">{s?.totalActive ?? 0}</div>
          <div className="text-xs text-gray-500 mt-1">Aktive Prognosen</div>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-4 text-center">
          <div className="text-3xl font-bold text-red-700">{s?.criticalCount ?? 0}</div>
          <div className="text-xs text-red-600 mt-1">Kritisch</div>
        </div>
        <div className="bg-orange-50 rounded-xl border border-orange-200 p-4 text-center">
          <div className="text-3xl font-bold text-orange-700">{s?.highCount ?? 0}</div>
          <div className="text-xs text-orange-600 mt-1">Hohes Risiko</div>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-3xl font-bold text-gray-900">{s?.avgRiskScore ?? 0}</div>
          <div className="text-xs text-gray-500 mt-1">Ø Risiko-Score</div>
        </div>
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <CheckCircle className="w-8 h-8 text-emerald-500 flex-shrink-0" />
          <div>
            <div className="text-xl font-bold text-gray-900">{s?.settledToday ?? 0}</div>
            <div className="text-xs text-gray-500">Abgeschlossen heute</div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4 flex items-center gap-3">
          <TrendingDown className="w-8 h-8 text-blue-500 flex-shrink-0" />
          <div>
            <div className="text-xl font-bold text-gray-900">
              {s?.avgActualDelayMin !== null && s?.avgActualDelayMin !== undefined
                ? `${s.avgActualDelayMin > 0 ? '+' : ''}${s.avgActualDelayMin} min`
                : '—'}
            </div>
            <div className="text-xs text-gray-500">Ø tatsächliche Verspätung</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-4">
        {(['active', 'accuracy'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'active' ? 'Aktive Prognosen' : 'Genauigkeit'}
          </button>
        ))}
      </div>

      {/* Active Predictions Tab */}
      {tab === 'active' && (
        <div className="space-y-3">
          {/* Filter */}
          <div className="flex gap-2 flex-wrap">
            {(['all', 'critical', 'high', 'medium', 'low'] as const).map(level => (
              <button
                key={level}
                onClick={() => setFilterLevel(level)}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  filterLevel === level
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                {level === 'all' ? 'Alle' : RISK_CONFIG[level as RiskLevel].label}
                {level !== 'all' && (
                  <span className="ml-1">
                    ({predictions.filter(p => p.riskLevel === level).length})
                  </span>
                )}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Keine aktiven Prognosen</p>
              <p className="text-sm mt-1">Alle Bestellungen sind im Zeitplan</p>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {filtered.map(p => (
                <PredictionCard
                  key={p.id}
                  p={p}
                  expanded={expandedId === p.id}
                  onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Accuracy Tab */}
      {tab === 'accuracy' && (
        <div className="space-y-3">
          {data?.accuracy && data.accuracy.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-gray-500 font-medium">
                    <th className="text-left py-2">Risiko-Level</th>
                    <th className="text-right py-2">Prognosen</th>
                    <th className="text-right py-2">Abgeschlossen</th>
                    <th className="text-right py-2">Ø Prognose-Delay</th>
                    <th className="text-right py-2">Ø Ist-Delay</th>
                    <th className="text-right py-2">Ø Abweichung</th>
                    <th className="text-right py-2">Tatsächl. Verspätungsrate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.accuracy.map(row => {
                    const cfg = RISK_CONFIG[row.riskLevel];
                    return (
                      <tr key={row.riskLevel} className="border-b hover:bg-gray-50">
                        <td className="py-2.5">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text} border ${cfg.border}`}>
                            {cfg.label}
                          </span>
                        </td>
                        <td className="text-right py-2.5 font-medium">{row.totalPredictions}</td>
                        <td className="text-right py-2.5 text-gray-600">{row.settled}</td>
                        <td className="text-right py-2.5 text-gray-600">
                          {row.avgPredictedDelayMin !== null ? `+${row.avgPredictedDelayMin} min` : '—'}
                        </td>
                        <td className="text-right py-2.5 text-gray-600">
                          {row.avgActualDelayMin !== null ? `${row.avgActualDelayMin > 0 ? '+' : ''}${row.avgActualDelayMin} min` : '—'}
                        </td>
                        <td className="text-right py-2.5">
                          <span className={row.avgAbsErrorMin !== null && row.avgAbsErrorMin > 10 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                            {row.avgAbsErrorMin !== null ? `${row.avgAbsErrorMin} min` : '—'}
                          </span>
                        </td>
                        <td className="text-right py-2.5">
                          {row.actualLateRate !== null
                            ? <span className={row.actualLateRate > 0.5 ? 'text-red-600 font-medium' : 'text-emerald-600'}>
                                {Math.round(row.actualLateRate * 100)}%
                              </span>
                            : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Noch keine Genauigkeitsdaten</p>
              <p className="text-sm mt-1">Daten werden nach abgeschlossenen Lieferungen gesammelt</p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => runAction('settle')}
              disabled={actionLoading}
              className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              Outcomes abgleichen
            </button>
            <button
              onClick={() => runAction('prune')}
              disabled={actionLoading}
              className="text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              Alte Einträge löschen (30d)
            </button>
          </div>
        </div>
      )}

      {data?.computedAt && (
        <p className="text-xs text-gray-400 text-center">
          Letzte Aktualisierung: {new Date(data.computedAt).toLocaleTimeString('de-DE')} · Auto-Refresh 60s
        </p>
      )}
    </div>
  );
}
