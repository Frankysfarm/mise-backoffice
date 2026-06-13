'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  BarChart2, RefreshCw, TrendingUp, TrendingDown, Minus,
  Clock, Route, Target, Package, Zap, Info, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Typen ────────────────────────────────────────────────────────────────────

interface AnalyticsSummary {
  totalTours30d: number;
  avgBundleSize: number | null;
  avgEfficiencyScore: number | null;
  avgDeliveryMin: number | null;
  onTimePct: number | null;
  avgDetourKm: number | null;
  maxBundleSeen: number;
  multiStopTours: number;
  bundleRatePct: number | null;
}

interface TourTrendDay {
  dayBerlin: string;
  totalTours: number;
  avgBundleSize: number | null;
  avgEfficiencyScore: number | null;
  avgDeliveryMin: number | null;
  totalOnTime: number;
  totalLate: number;
  onTimePct: number | null;
  avgRouteKm: number | null;
}

interface ZoneEfficiency {
  zone: string;
  totalStops: number;
  avgEfficiencyScore: number | null;
  avgDeliveryMin: number | null;
  onTimePct: number | null;
}

interface BundleRecommendations {
  optimalBundleSize: number;
  suggestedMaxDetourKm: number;
  worstZone: string | null;
  bestZone: string | null;
  insight: string;
}

interface Dashboard {
  summary: AnalyticsSummary | null;
  trend: TourTrendDay[];
  zoneEfficiency: ZoneEfficiency[];
  recommendations: BundleRecommendations;
  lastUpdated: string;
}

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

const ZONE_LABELS: Record<string, string> = {
  A: 'Zone A — Express <3 km',
  B: 'Zone B — Standard 3–6 km',
  C: 'Zone C — Weit 6–10 km',
  D: 'Zone D — Außerhalb >10 km',
};

const ZONE_COLORS: Record<string, string> = {
  A: 'bg-green-100 text-green-800 border-green-200',
  B: 'bg-blue-100 text-blue-800 border-blue-200',
  C: 'bg-amber-100 text-amber-800 border-amber-200',
  D: 'bg-red-100 text-red-800 border-red-200',
};

function efficiencyColor(score: number | null): string {
  if (score == null) return 'text-gray-400';
  if (score >= 80) return 'text-green-600';
  if (score >= 65) return 'text-amber-600';
  return 'text-red-600';
}

function efficiencyBg(score: number | null): string {
  if (score == null) return 'bg-gray-100';
  if (score >= 80) return 'bg-green-50 border-green-200';
  if (score >= 65) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

function onTimeColor(pct: number | null): string {
  if (pct == null) return 'text-gray-400';
  if (pct >= 85) return 'text-green-600';
  if (pct >= 70) return 'text-amber-600';
  return 'text-red-600';
}

function fmt(val: number | null, digits = 1, suffix = ''): string {
  if (val == null) return '—';
  return val.toFixed(digits) + suffix;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

// ─── Trend-Balken ─────────────────────────────────────────────────────────────

function TrendBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── KPI-Karte ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  icon: React.ElementType;
}) {
  return (
    <div className="bg-white rounded-xl border p-4 flex items-start gap-3 shadow-sm">
      <div className="p-2 rounded-lg bg-gray-50">
        <Icon className="w-5 h-5 text-gray-500" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500 truncate">{label}</p>
        <p className={`text-xl font-bold ${color ?? 'text-gray-900'}`}>{value}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Hauptkomponente ──────────────────────────────────────────────────────────

export function TourAnalyticsClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [showTrend, setShowTrend] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/admin/tour-analytics?location_id=${locationId}`);
      if (!res.ok) return;
      const json = await res.json() as { ok: boolean } & Dashboard;
      if (json.ok) {
        setData(json);
        setLastRefresh(new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
      }
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    void load();
    const t = setInterval(() => void load(), 120_000);
    return () => clearInterval(t);
  }, [load]);

  const triggerScan = async () => {
    setScanning(true);
    try {
      await fetch('/api/delivery/admin/tour-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan' }),
      });
      await load();
    } finally {
      setScanning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const s = data?.summary ?? null;
  const trend = data?.trend ?? [];
  const zones = data?.zoneEfficiency ?? [];
  const rec = data?.recommendations;

  const maxTours = Math.max(...trend.map((d) => d.totalTours), 1);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <BarChart2 className="w-4 h-4" />
          <span>Letzte Aktualisierung: {lastRefresh ?? '—'}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void triggerScan()}
            disabled={scanning}
            className="text-xs px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
            Backfill-Scan
          </button>
          <button
            onClick={() => void load()}
            className="text-xs px-3 py-1.5 rounded-lg border bg-white hover:bg-gray-50 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Aktualisieren
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      {s ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label="Touren (30 Tage)"
            value={s.totalTours30d.toString()}
            sub={`${s.multiStopTours} Multi-Stop`}
            icon={Route}
          />
          <KpiCard
            label="Ø Effizienz-Score"
            value={fmt(s.avgEfficiencyScore, 1, '%')}
            sub={`Max. Bundle: ${s.maxBundleSeen} Stops`}
            color={efficiencyColor(s.avgEfficiencyScore)}
            icon={Target}
          />
          <KpiCard
            label="Pünktlichkeit"
            value={fmt(s.onTimePct, 1, '%')}
            sub={`Ø Lieferzeit: ${fmt(s.avgDeliveryMin, 0, ' Min')}`}
            color={onTimeColor(s.onTimePct)}
            icon={Clock}
          />
          <KpiCard
            label="Bundle-Rate"
            value={fmt(s.bundleRatePct, 1, '%')}
            sub={`Ø ${fmt(s.avgBundleSize, 1)} Stops/Tour`}
            icon={Package}
          />
        </div>
      ) : (
        <div className="bg-gray-50 rounded-xl border p-8 text-center text-gray-500 text-sm">
          Noch keine abgeschlossenen Touren mit Analytics-Daten vorhanden.
          <br />
          <span className="text-xs text-gray-400">
            Daten werden nach Tour-Abschluss automatisch erfasst.
          </span>
        </div>
      )}

      {/* Empfehlungen */}
      {rec && (
        <div className={`rounded-xl border p-4 ${s ? efficiencyBg(s.avgEfficiencyScore) : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-start gap-2">
            <Zap className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-gray-800">Bundle-Optimierungs-Empfehlung</p>
              <p className="text-sm text-gray-600">{rec.insight}</p>
              <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                <span>
                  Optimale Bundle-Größe:{' '}
                  <strong className="text-gray-800">{rec.optimalBundleSize} Stops</strong>
                </span>
                <span>
                  Max. Umweg:{' '}
                  <strong className="text-gray-800">{rec.suggestedMaxDetourKm} km</strong>
                </span>
                {rec.bestZone && (
                  <span>
                    Beste Zone:{' '}
                    <strong className="text-green-700">{rec.bestZone}</strong>
                  </span>
                )}
                {rec.worstZone && (
                  <span>
                    Schwächste Zone:{' '}
                    <strong className="text-red-700">{rec.worstZone}</strong>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend-Tabelle */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <button
            onClick={() => setShowTrend((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-semibold text-gray-800">
                Effizienz-Trend (letzte 14 Tage)
              </span>
            </div>
            {showTrend ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
          {showTrend && (
            <div className="overflow-x-auto">
              {trend.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">Keine Trend-Daten</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-gray-500">Tag</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500">Touren</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500">Effizienz</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500">Pünktl.</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-500">Ø Min</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {trend.map((day) => {
                      const d = new Date(day.dayBerlin);
                      const isToday =
                        d.toDateString() === new Date().toDateString();
                      return (
                        <tr
                          key={day.dayBerlin}
                          className={isToday ? 'bg-blue-50' : 'hover:bg-gray-50'}
                        >
                          <td className="px-3 py-2 text-gray-700">
                            {formatDate(day.dayBerlin)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div>{day.totalTours}</div>
                            <TrendBar value={day.totalTours} max={maxTours} color="bg-blue-400" />
                          </td>
                          <td className={`px-3 py-2 text-right font-medium ${efficiencyColor(day.avgEfficiencyScore)}`}>
                            {fmt(day.avgEfficiencyScore, 0, '%')}
                          </td>
                          <td className={`px-3 py-2 text-right ${onTimeColor(day.onTimePct)}`}>
                            {fmt(day.onTimePct, 0, '%')}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {fmt(day.avgDeliveryMin, 0)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Zonen-Effizienz */}
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <Route className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-800">
              Bundle-Effizienz nach Zone (14 Tage)
            </span>
          </div>
          {zones.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">Keine Zonen-Daten</p>
          ) : (
            <div className="divide-y">
              {zones.map((z) => (
                <div key={z.zone} className="px-4 py-3 flex items-start gap-3">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded border shrink-0 ${ZONE_COLORS[z.zone] ?? 'bg-gray-100 text-gray-700 border-gray-200'}`}
                  >
                    {z.zone}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 mb-1">{ZONE_LABELS[z.zone] ?? `Zone ${z.zone}`}</p>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-gray-400">Stops</span>
                        <div className="font-semibold text-gray-800">{z.totalStops}</div>
                      </div>
                      <div>
                        <span className="text-gray-400">Effizienz</span>
                        <div className={`font-semibold ${efficiencyColor(z.avgEfficiencyScore)}`}>
                          {fmt(z.avgEfficiencyScore, 0, '%')}
                        </div>
                      </div>
                      <div>
                        <span className="text-gray-400">Pünktl.</span>
                        <div className={`font-semibold ${onTimeColor(z.onTimePct)}`}>
                          {fmt(z.onTimePct, 0, '%')}
                        </div>
                      </div>
                    </div>
                    <div className="mt-1">
                      <div className="text-gray-400 text-xs">Ø Lieferzeit: {fmt(z.avgDeliveryMin, 0, ' Min')}</div>
                      <TrendBar
                        value={z.avgEfficiencyScore ?? 0}
                        max={100}
                        color={
                          (z.avgEfficiencyScore ?? 0) >= 80
                            ? 'bg-green-400'
                            : (z.avgEfficiencyScore ?? 0) >= 65
                            ? 'bg-amber-400'
                            : 'bg-red-400'
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info-Box */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
          <div className="text-xs text-blue-700 space-y-1">
            <p className="font-semibold">So funktioniert Tour-Performance Analytics</p>
            <p>
              Jede abgeschlossene Tour wird automatisch analysiert: geplante vs. tatsächliche
              Lieferzeit, Stop-Reihenfolge, Umwege und SLA-Einhaltung.
            </p>
            <p>
              Der <strong>Effizienz-Score (0–100)</strong> kombiniert: 40% SLA-Pünktlichkeit +
              30% ETA-Genauigkeit + 30% Stop-Auslastung (planned vs. actual).
            </p>
            <p>
              Empfehlungen werden aus 30-Tage-Daten berechnet und helfen, die Bundle-Größe
              und den maximalen Umweg für den Dispatch-Algorithmus zu optimieren.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
