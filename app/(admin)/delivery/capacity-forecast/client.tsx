'use client';

import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, RefreshCw, Loader2, BarChart3, Users, Zap, Calendar } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CapacityForecastDay {
  forecastDate: string;
  dayOfWeek: number;
  expectedOrders: number;
  expectedOrdersLow: number;
  expectedOrdersHigh: number;
  recommendedDrivers: number;
  predictedUtilizationPct: number;
  trendFactor: number;
  confidenceScore: number;
  isPeakDay: boolean;
  peakHourStart: number | null;
  peakHourEnd: number | null;
  dataPoints: number;
  activeDrivers: number;
}

interface CapacityForecastDashboard {
  forecast7d: CapacityForecastDay[];
  avgDailyOrders7d: number;
  avgUtilization7d: number;
  busiestDay: CapacityForecastDay | null;
  quietestDay: CapacityForecastDay | null;
  trendFactor7d: number;
  avgConfidence: number;
  totalExpectedOrders7d: number;
  peakDays: number;
  computedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, d = 1): string {
  return n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
}

const DOW_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DOW_NAMES_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

function fmtDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function utilizationColor(pct: number): string {
  if (pct >= 80) return 'bg-red-500';
  if (pct >= 60) return 'bg-amber-400';
  return 'bg-emerald-500';
}

function utilizationTextColor(pct: number): string {
  if (pct >= 80) return 'text-red-700';
  if (pct >= 60) return 'text-amber-700';
  return 'text-emerald-700';
}

function utilizationBgLight(pct: number): string {
  if (pct >= 80) return 'bg-red-50 border-red-200';
  if (pct >= 60) return 'bg-amber-50 border-amber-200';
  return 'bg-emerald-50 border-emerald-200';
}

function confidenceColor(score: number): string {
  if (score >= 70) return 'text-emerald-600 bg-emerald-50';
  if (score >= 40) return 'text-amber-600 bg-amber-50';
  return 'text-gray-500 bg-gray-100';
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-start gap-3">
      <div className={`p-2 rounded-lg ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500 font-medium">{label}</div>
        <div className="text-xl font-bold text-gray-900 mt-0.5">{value}</div>
        {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

// ── Trend Indicator ───────────────────────────────────────────────────────────

function TrendIndicator({ factor }: { factor: number }) {
  const isGrowing = factor > 1.05;
  const isDeclining = factor < 0.95;
  const pct = Math.round((factor - 1) * 100);

  if (isGrowing) {
    return (
      <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-sm font-medium">
        <TrendingUp className="w-4 h-4" />
        <span>Wachstum +{pct}% vs. Vorperiode</span>
      </div>
    );
  }
  if (isDeclining) {
    return (
      <div className="flex items-center gap-1.5 text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-sm font-medium">
        <TrendingDown className="w-4 h-4" />
        <span>Rückgang {pct}% vs. Vorperiode</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 text-gray-600 bg-gray-100 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium">
      <BarChart3 className="w-4 h-4" />
      <span>Stabil (Trend-Faktor {fmt(factor, 3)})</span>
    </div>
  );
}

// ── Forecast Day Card ─────────────────────────────────────────────────────────

function ForecastDayCard({ day }: { day: CapacityForecastDay }) {
  const utilizationWidth = Math.min(100, day.predictedUtilizationPct);

  return (
    <div className={`rounded-xl border p-4 ${utilizationBgLight(day.predictedUtilizationPct)} ${day.isPeakDay ? 'ring-2 ring-amber-300' : ''}`}>
      {/* Date + DOW header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-xs text-gray-500 font-medium">{fmtDate(day.forecastDate)}</div>
          <div className="text-base font-bold text-gray-900">{DOW_NAMES_LONG[day.dayOfWeek]}</div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {day.isPeakDay && (
            <span className="text-xs font-semibold text-amber-700 bg-amber-100 border border-amber-300 rounded-full px-2 py-0.5">
              Peak
            </span>
          )}
          <span className={`text-xs font-medium rounded-full px-2 py-0.5 ${confidenceColor(day.confidenceScore)}`}>
            {day.confidenceScore}% Konfidenz
          </span>
        </div>
      </div>

      {/* Expected orders with CI band */}
      <div className="mb-3">
        <div className="text-2xl font-bold text-gray-900">{fmt(day.expectedOrders, 0)}</div>
        <div className="text-xs text-gray-500">
          Erw. Bestellungen · {fmt(day.expectedOrdersLow, 0)}–{fmt(day.expectedOrdersHigh, 0)} KI
        </div>
      </div>

      {/* Utilization bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">Auslastung</span>
          <span className={`text-xs font-bold ${utilizationTextColor(day.predictedUtilizationPct)}`}>
            {fmt(day.predictedUtilizationPct, 0)}%
          </span>
        </div>
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${utilizationColor(day.predictedUtilizationPct)}`}
            style={{ width: `${utilizationWidth}%` }}
          />
        </div>
      </div>

      {/* Drivers */}
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1 text-gray-600">
          <Users className="w-3.5 h-3.5" />
          <span>{day.recommendedDrivers} Fahrer empfohlen</span>
        </div>
        {day.peakHourStart !== null && day.peakHourEnd !== null && (
          <div className="flex items-center gap-1 text-gray-500 text-xs">
            <Zap className="w-3 h-3 text-amber-500" />
            <span>{String(day.peakHourStart).padStart(2, '0')}–{String(day.peakHourEnd + 1).padStart(2, '0')} Uhr</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Client Component ─────────────────────────────────────────────────────

export function CapacityForecastClient({ locationId }: { locationId: string }) {
  const [data, setData] = useState<CapacityForecastDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/delivery/admin/capacity-forecast?action=dashboard&location_id=${locationId}`);
      if (!res.ok) throw new Error(await res.text());
      setData(await res.json() as CapacityForecastDashboard);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const rebuild = async () => {
    setRebuilding(true);
    try {
      await fetch('/api/delivery/admin/capacity-forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rebuild', location_id: locationId }),
      });
      await load();
    } finally {
      setRebuilding(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24 text-gray-400 gap-2">
      <Loader2 className="w-5 h-5 animate-spin" />
      <span>Kapazitätsprognose wird geladen…</span>
    </div>
  );

  if (error) return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
  );

  const d = data!;

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            <span>{d.forecast7d.length} Tage · {DOW_NAMES[new Date(d.forecast7d[0]?.forecastDate + 'T12:00:00Z').getUTCDay() ?? 0]} bis {DOW_NAMES[new Date(d.forecast7d[d.forecast7d.length - 1]?.forecastDate + 'T12:00:00Z').getUTCDay() ?? 0]}</span>
          </div>
          <TrendIndicator factor={d.trendFactor7d} />
        </div>
        <button
          onClick={rebuild}
          disabled={rebuilding}
          className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600 disabled:opacity-50"
        >
          {rebuilding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Neu berechnen
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard
          icon={BarChart3}
          label="Ø Tägl. Bestellungen (7d)"
          value={fmt(d.avgDailyOrders7d, 0)}
          sub="Vorhersage-Durchschnitt"
          color="bg-blue-100 text-blue-600"
        />
        <KpiCard
          icon={Zap}
          label="Ø Auslastung (7d)"
          value={`${fmt(d.avgUtilization7d, 0)}%`}
          sub="Fahrerkapazität"
          color={d.avgUtilization7d >= 80 ? 'bg-red-100 text-red-600' : d.avgUtilization7d >= 60 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}
        />
        <KpiCard
          icon={TrendingUp}
          label="Gesamt erwartet (7d)"
          value={fmt(d.totalExpectedOrders7d, 0)}
          sub="Bestellungen total"
          color="bg-purple-100 text-purple-600"
        />
        <KpiCard
          icon={Users}
          label="Peak-Tage"
          value={String(d.peakDays)}
          sub={`von ${d.forecast7d.length} Tagen · >75% Auslastung`}
          color={d.peakDays >= 3 ? 'bg-red-100 text-red-600' : d.peakDays >= 1 ? 'bg-amber-100 text-amber-600' : 'bg-gray-100 text-gray-600'}
        />
      </div>

      {/* Busiest / Quietest Day Summary */}
      {(d.busiestDay || d.quietestDay) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {d.busiestDay && (
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-amber-700 font-semibold text-sm mb-2">
                <TrendingUp className="w-4 h-4" />
                Stärkster Tag: {DOW_NAMES_LONG[d.busiestDay.dayOfWeek]} ({fmtDate(d.busiestDay.forecastDate)})
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-xs text-gray-500">Erw. Bestellungen</div>
                  <div className="font-bold text-gray-800">{fmt(d.busiestDay.expectedOrders, 0)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Fahrer empfohlen</div>
                  <div className="font-bold text-gray-800">{d.busiestDay.recommendedDrivers}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Auslastung</div>
                  <div className={`font-bold ${utilizationTextColor(d.busiestDay.predictedUtilizationPct)}`}>
                    {fmt(d.busiestDay.predictedUtilizationPct, 0)}%
                  </div>
                </div>
              </div>
            </div>
          )}
          {d.quietestDay && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm mb-2">
                <TrendingDown className="w-4 h-4" />
                Ruhigster Tag: {DOW_NAMES_LONG[d.quietestDay.dayOfWeek]} ({fmtDate(d.quietestDay.forecastDate)})
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div>
                  <div className="text-xs text-gray-500">Erw. Bestellungen</div>
                  <div className="font-bold text-gray-800">{fmt(d.quietestDay.expectedOrders, 0)}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Fahrer empfohlen</div>
                  <div className="font-bold text-gray-800">{d.quietestDay.recommendedDrivers}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500">Auslastung</div>
                  <div className={`font-bold ${utilizationTextColor(d.quietestDay.predictedUtilizationPct)}`}>
                    {fmt(d.quietestDay.predictedUtilizationPct, 0)}%
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 7-day forecast grid */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          7-Tage Kapazitäts-Vorhersage
        </h3>
        {d.forecast7d.length === 0 ? (
          <div className="text-sm text-gray-400 py-8 text-center bg-gray-50 rounded-xl border border-gray-200">
            Keine Prognose-Daten verfügbar. Bitte zuerst Nachfragemuster aufzeichnen.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {d.forecast7d.map((day) => (
              <ForecastDayCard key={day.forecastDate} day={day} />
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
        <div className="text-xs font-semibold text-gray-600 mb-2">Legende</div>
        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span>Auslastung &lt;60% (normal)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-amber-400" />
            <span>60–80% (erhöht)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>≥80% (Peak)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-4 h-4 rounded-full border-2 border-amber-300 bg-amber-50" />
            <span>Peak-Tag (&gt;75% Auslastung)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3 text-amber-500" />
            <span>Peak-Stunden-Fenster</span>
          </div>
        </div>
        <div className="mt-2 text-xs text-gray-400">
          Berechnung: Ø Bestellungen pro Wochentag (v_hourly_demand_pattern) × Trend-Faktor (14d vs. 14d prior) · Fahrerbedarf: ⌈Bestellungen / 15⌉ (2,5/h × 6h Schicht)
        </div>
      </div>

      {/* Footer */}
      <div className="text-xs text-gray-400 text-center">
        Berechnet: {new Date(d.computedAt).toLocaleString('de-DE')} · Ø Konfidenz: {d.avgConfidence}% · 5-Min-Auto-Refresh
      </div>
    </div>
  );
}
