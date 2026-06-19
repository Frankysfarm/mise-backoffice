'use client';

/**
 * DispatchReturnPredictionLive — Phase 275
 *
 * ML-basierte Fahrer-Rückkehr-Vorhersage für den Dispatch.
 * Nutzt die Phase-274-API (/api/delivery/admin/return-prediction) mit
 * Haversine-Distanz + GPS-Konfidenz — im Gegensatz zur alten Prop-basierten
 * DriverReturnForecast (Phase 113).
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Bike, Car, CheckCircle2, Clock, RefreshCw, Zap } from 'lucide-react';

interface Prediction {
  driverId:             string;
  driverName:           string | null;
  driverVehicle:        'bike' | 'car';
  driverState:          string;
  minutesUntilReturn:   number;
  remainingStops:       number;
  totalStops:           number;
  estimatedReturnUtc:   string;
  confidence:           number;
  method:               string;
  predictedRemainingKm: number | null;
}

interface Dashboard {
  activeDrivers:         number;
  returningWithin15Min:  number;
  returningWithin30Min:  number;
  avgMinutesUntilReturn: number;
  highConfidenceCount:   number;
  predictions:           Prediction[];
  returningSoon:         Prediction[];
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  const cls = pct >= 75
    ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
    : pct >= 50
    ? 'bg-amber-100 text-amber-700 border-amber-200'
    : 'bg-red-100 text-red-700 border-red-200';
  return (
    <span className={cn('rounded-full border px-1.5 py-0.5 text-[8px] font-black tabular-nums', cls)}>
      {pct}%
    </span>
  );
}

function fmtMin(min: number): string {
  if (min <= 0) return 'Jetzt';
  if (min < 60) return `${min} Min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function DispatchReturnPredictionLive({ locationId }: { locationId: string }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const load = () => {
    setLoading(true);
    fetch(`/api/delivery/admin/return-prediction?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.ok) setData(d as Dashboard);
        setLastRefresh(new Date());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 30_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data && !loading) return null;

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 bg-violet-100 border-b border-violet-200 px-4 py-2.5">
        <Zap className="h-4 w-4 text-violet-700" />
        <span className="text-xs font-black uppercase tracking-wider text-violet-800">
          KI-Rückkehr-Prognose
        </span>
        {data && (
          <span className="ml-1 rounded-full bg-violet-200 px-2 py-0.5 text-[9px] font-bold text-violet-800">
            {data.activeDrivers} aktiv · {data.highConfidenceCount} hohe Konfidenz
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          {lastRefresh && (
            <span className="text-[9px] text-violet-500">
              {lastRefresh.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="rounded-lg p-1 text-violet-600 hover:bg-violet-200 disabled:opacity-40 transition"
          >
            <RefreshCw className={cn('h-3 w-3', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      {data && (
        <div className="grid grid-cols-3 divide-x divide-violet-200 border-b border-violet-200">
          <div className="px-4 py-2.5 text-center">
            <div className="text-[9px] font-black uppercase tracking-wider text-violet-500 mb-0.5">≤ 15 Min</div>
            <div className={cn(
              'text-xl font-black tabular-nums',
              data.returningWithin15Min > 0 ? 'text-emerald-700' : 'text-violet-300',
            )}>
              {data.returningWithin15Min}
            </div>
            <div className="text-[9px] text-violet-400">Fahrer bald frei</div>
          </div>
          <div className="px-4 py-2.5 text-center">
            <div className="text-[9px] font-black uppercase tracking-wider text-violet-500 mb-0.5">≤ 30 Min</div>
            <div className={cn(
              'text-xl font-black tabular-nums',
              data.returningWithin30Min > 0 ? 'text-amber-700' : 'text-violet-300',
            )}>
              {data.returningWithin30Min}
            </div>
            <div className="text-[9px] text-violet-400">Fahrer verfügbar</div>
          </div>
          <div className="px-4 py-2.5 text-center">
            <div className="text-[9px] font-black uppercase tracking-wider text-violet-500 mb-0.5">Ø Rückkehr</div>
            <div className="text-xl font-black tabular-nums text-violet-700">
              {data.avgMinutesUntilReturn > 0 ? `${data.avgMinutesUntilReturn} Min` : '—'}
            </div>
            <div className="text-[9px] text-violet-400">alle Fahrer</div>
          </div>
        </div>
      )}

      {/* Predictions list */}
      {data && data.predictions.length > 0 ? (
        <div className="divide-y divide-violet-100 max-h-[260px] overflow-y-auto">
          {[...data.predictions]
            .sort((a, b) => a.minutesUntilReturn - b.minutesUntilReturn)
            .map(p => {
              const isOverdue = p.minutesUntilReturn < 0;
              const isSoon    = p.minutesUntilReturn <= 10;
              const donePct   = p.totalStops > 0 ? (p.totalStops - p.remainingStops) / p.totalStops : 0;

              return (
                <div key={p.driverId} className="flex items-center gap-3 px-4 py-2.5">
                  {/* Vehicle icon */}
                  <div className={cn(
                    'h-8 w-8 rounded-xl flex items-center justify-center shrink-0',
                    isOverdue ? 'bg-red-500 text-white' :
                    isSoon ? 'bg-amber-500 text-white' :
                    'bg-violet-200 text-violet-700',
                  )}>
                    {p.driverVehicle === 'car'
                      ? <Car className="h-3.5 w-3.5" />
                      : <Bike className="h-3.5 w-3.5" />
                    }
                  </div>

                  {/* Name + progress */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[11px] font-black text-violet-900 truncate">
                        {p.driverName ?? 'Fahrer'}
                      </span>
                      <ConfidenceBadge confidence={p.confidence} />
                      {p.predictedRemainingKm != null && (
                        <span className="text-[9px] text-violet-400 font-bold">
                          ~{p.predictedRemainingKm.toFixed(1)} km
                        </span>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 rounded-full bg-violet-100 overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            donePct >= 1 ? 'bg-emerald-500' : donePct >= 0.5 ? 'bg-violet-500' : 'bg-violet-300',
                          )}
                          style={{ width: `${donePct * 100}%` }}
                        />
                      </div>
                      <span className="text-[9px] text-violet-400 tabular-nums shrink-0">
                        {p.totalStops - p.remainingStops}/{p.totalStops} Stops
                      </span>
                    </div>
                  </div>

                  {/* Return time */}
                  <div className="text-right shrink-0 min-w-[64px]">
                    {isOverdue ? (
                      <div className="flex items-center justify-end gap-1 text-red-600">
                        <AlertTriangle className="h-3 w-3 animate-pulse" />
                        <span className="text-[10px] font-black">Überfällig</span>
                      </div>
                    ) : p.remainingStops === 0 ? (
                      <div className="flex items-center justify-end gap-1 text-emerald-600">
                        <CheckCircle2 className="h-3 w-3" />
                        <span className="text-[10px] font-black">Kehrt zurück</span>
                      </div>
                    ) : (
                      <>
                        <div className={cn(
                          'text-sm font-black tabular-nums',
                          isSoon ? 'text-amber-700' : 'text-violet-700',
                        )}>
                          ~{fmtMin(p.minutesUntilReturn)}
                        </div>
                        <div className="text-[9px] text-violet-400 tabular-nums">
                          ≈ {fmtTime(p.estimatedReturnUtc)}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      ) : data && data.activeDrivers === 0 ? (
        <div className="px-4 py-6 text-center text-[11px] text-violet-400">
          Keine aktiven Fahrer
        </div>
      ) : loading ? (
        <div className="px-4 py-6 text-center text-[11px] text-violet-400">Lade Vorhersagen…</div>
      ) : null}
    </div>
  );
}
