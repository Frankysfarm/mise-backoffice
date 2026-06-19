'use client';

import { useEffect, useState, useCallback } from 'react';
import { Bike, Car, Clock, RefreshCw, MapPin, RotateCcw, CheckCircle, AlertTriangle } from 'lucide-react';
import type { ReturnPredictionWithDriver, ReturnPredictionDashboard } from '@/lib/delivery/driver-return-prediction';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardData extends ReturnPredictionDashboard {
  ok: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function confidenceBadge(c: number): { label: string; cls: string } {
  if (c >= 0.75) return { label: 'Hoch',    cls: 'bg-emerald-100 text-emerald-700' };
  if (c >= 0.5)  return { label: 'Mittel',  cls: 'bg-amber-100  text-amber-700' };
  return           { label: 'Niedrig', cls: 'bg-red-100    text-red-700' };
}

function methodLabel(m: string): string {
  switch (m) {
    case 'haversine': return 'GPS-Route';
    case 'returning': return 'Rückfahrt';
    case 'fallback':  return 'Verfügbar';
    default:          return m;
  }
}

function stateLabel(s: string): string {
  switch (s) {
    case 'en_route':      return 'Unterwegs';
    case 'at_restaurant': return 'Am Restaurant';
    case 'assigned':      return 'Zugewiesen';
    case 'returning':     return 'Rückfahrt';
    case 'idle':          return 'Verfügbar';
    default:              return s;
  }
}

function stateColor(s: string): string {
  switch (s) {
    case 'en_route':      return 'bg-blue-100 text-blue-700';
    case 'at_restaurant': return 'bg-purple-100 text-purple-700';
    case 'assigned':      return 'bg-amber-100 text-amber-700';
    case 'returning':     return 'bg-teal-100 text-teal-700';
    case 'idle':          return 'bg-emerald-100 text-emerald-700';
    default:              return 'bg-gray-100 text-gray-700';
  }
}

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, accent = false,
}: { label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'border-blue-200 bg-blue-50' : 'bg-white'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent ? 'text-blue-700' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Driver Row ────────────────────────────────────────────────────────────────

function DriverCard({ p, isSoon }: { p: ReturnPredictionWithDriver; isSoon: boolean }) {
  const conf    = confidenceBadge(p.confidence);
  const isNow   = p.minutesUntilReturn === 0;

  return (
    <div className={`rounded-xl border p-4 ${isSoon ? 'border-teal-300 bg-teal-50' : 'bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        {/* Driver info */}
        <div className="flex items-center gap-2 min-w-0">
          {p.driverVehicle === 'car'
            ? <Car className="h-5 w-5 text-blue-500 shrink-0" />
            : <Bike className="h-5 w-5 text-emerald-500 shrink-0" />}
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 truncate">
              {p.driverName ?? p.driverId.slice(0, 8)}
            </p>
            <div className="flex gap-1 flex-wrap mt-0.5">
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${stateColor(p.driverState)}`}>
                {stateLabel(p.driverState)}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${conf.cls}`}>
                {conf.label}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                {methodLabel(p.method)}
              </span>
            </div>
          </div>
        </div>

        {/* Return time */}
        <div className="text-right shrink-0">
          {isNow ? (
            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-sm">
              <CheckCircle className="h-4 w-4" /> Verfügbar
            </span>
          ) : (
            <>
              <p className="text-xl font-bold text-gray-900">
                {fmtTime(p.estimatedReturnUtc)}
              </p>
              <p className={`text-xs font-medium ${isSoon ? 'text-teal-700' : 'text-gray-500'}`}>
                in {p.minutesUntilReturn} Min
              </p>
            </>
          )}
        </div>
      </div>

      {/* Stop progress */}
      {p.totalStops > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {p.remainingStops}/{p.totalStops} Stops offen
            </span>
            {p.predictedRemainingKm != null && (
              <span>~{p.predictedRemainingKm.toFixed(1)} km</span>
            )}
          </div>
          <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all"
              style={{
                width: `${Math.round(
                  ((p.totalStops - p.remainingStops) / p.totalStops) * 100,
                )}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Client ───────────────────────────────────────────────────────────────

export function ReturnPredictionClient() {
  const [data,      setData]      = useState<DashboardData | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);
  const [computing, setComputing] = useState(false);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchDashboard = useCallback(async () => {
    setError(null);
    try {
      const res  = await fetch('/api/delivery/admin/return-prediction?action=dashboard');
      const json = await res.json() as DashboardData;
      if (!json.ok) throw new Error(String((json as unknown as { error?: string }).error ?? 'Fehler'));
      setData(json);
      setLastFetch(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const recompute = useCallback(async () => {
    setComputing(true);
    try {
      await fetch('/api/delivery/admin/return-prediction', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action: 'predict_all' }),
      });
      await fetchDashboard();
    } finally {
      setComputing(false);
    }
  }, [fetchDashboard]);

  useEffect(() => {
    void fetchDashboard();
    const id = setInterval(() => { void fetchDashboard(); }, 30_000);
    return () => clearInterval(id);
  }, [fetchDashboard]);

  if (loading) {
    return (
      <div className="p-6 text-gray-500 text-sm animate-pulse">
        Lade Rückkehr-Vorhersagen…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-red-600 text-sm">
        Fehler: {error ?? 'Keine Daten'}
      </div>
    );
  }

  const { predictions, returningSoon } = data;
  const activePredictions = predictions.filter((p) => p.minutesUntilReturn > 0 || p.remainingStops > 0);
  const availableNow      = predictions.filter((p) => p.minutesUntilReturn === 0 && p.remainingStops === 0);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <RotateCcw className="h-6 w-6 text-teal-600" />
            Fahrer-Rückkehr-Vorhersage
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Predictive Return-to-Base — aktualisiert alle 30 s
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastFetch && (
            <span className="text-xs text-gray-400">
              Stand: {lastFetch.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          )}
          <button
            onClick={() => { void recompute(); }}
            disabled={computing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${computing ? 'animate-spin' : ''}`} />
            {computing ? 'Berechne…' : 'Neu berechnen'}
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="Aktive Fahrer"
          value={data.activeDrivers}
          sub="mit Vorhersage"
        />
        <KpiCard
          label="Rückkehr < 15 Min"
          value={data.returningWithin15Min}
          sub="können bald neu assigned werden"
          accent={data.returningWithin15Min > 0}
        />
        <KpiCard
          label="Ø Rückkehr"
          value={data.avgMinutesUntilReturn > 0 ? `${data.avgMinutesUntilReturn} Min` : '—'}
          sub="Durchschnitt aktiver Fahrer"
        />
        <KpiCard
          label="Hohe Konfidenz"
          value={data.highConfidenceCount}
          sub="GPS-Vorhersagen ≥ 75 %"
        />
      </div>

      {/* Returning Soon Banner */}
      {returningSoon.length > 0 && (
        <div className="rounded-xl border border-teal-300 bg-teal-50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-5 w-5 text-teal-600" />
            <h2 className="font-semibold text-teal-800">
              {returningSoon.length} Fahrer in &lt; 15 Min zurück — Pre-Assignment möglich
            </h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {returningSoon.map((p) => (
              <DriverCard key={p.driverId} p={p} isSoon />
            ))}
          </div>
        </div>
      )}

      {/* Available Now */}
      {availableNow.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            Jetzt verfügbar ({availableNow.length})
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {availableNow.map((p) => (
              <DriverCard key={p.driverId} p={p} isSoon={false} />
            ))}
          </div>
        </div>
      )}

      {/* All active predictions */}
      {activePredictions.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-500" />
            Fahrer auf Tour ({activePredictions.length})
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {activePredictions.map((p) => (
              <DriverCard
                key={p.driverId}
                p={p}
                isSoon={returningSoon.some((r) => r.driverId === p.driverId)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {predictions.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <AlertTriangle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">
            Keine aktiven Fahrer gefunden. Vorhersagen werden automatisch erstellt wenn Fahrer Touren übernehmen.
          </p>
        </div>
      )}
    </div>
  );
}
