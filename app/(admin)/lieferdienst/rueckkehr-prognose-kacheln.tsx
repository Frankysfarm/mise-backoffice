'use client';

/**
 * RueckkehrPrognoseKacheln — Phase 275
 *
 * Statistik-Kacheln für die Fahrer-Rückkehr-Prognose (Phase 274 API).
 * Zeigt KPI-Übersicht + Liste aller aktiven Vorhersagen in der Lieferdienst Stats-View.
 */

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Bike, Car, Clock, RefreshCw, Target, Zap } from 'lucide-react';

interface Prediction {
  driverId:           string;
  driverName:         string | null;
  driverVehicle:      'bike' | 'car';
  driverState:        string;
  minutesUntilReturn: number;
  remainingStops:     number;
  totalStops:         number;
  estimatedReturnUtc: string;
  confidence:         number;
  method:             string;
}

interface DashboardData {
  activeDrivers:         number;
  returningWithin15Min:  number;
  returningWithin30Min:  number;
  avgMinutesUntilReturn: number;
  highConfidenceCount:   number;
  predictions:           Prediction[];
}

function fmtTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

export function RueckkehrPrognoseKacheln({ locationId }: { locationId: string }) {
  const [data, setData]       = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    fetch(`/api/delivery/admin/return-prediction?location_id=${locationId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.ok) setData(d as DashboardData); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-violet-600" />
          <span className="text-xs font-black uppercase tracking-wider text-char">
            Fahrer-Rückkehr-Prognose
          </span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg p-1 text-stone-400 hover:text-stone-600 hover:bg-stone-100 disabled:opacity-40 transition"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
        </button>
      </div>

      {/* KPI Kacheln */}
      {data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-stone-100">
            {[
              {
                label: 'Aktive Fahrer',
                value: data.activeDrivers,
                unit: '',
                icon: <Target className="h-3.5 w-3.5" />,
                color: 'text-violet-700',
                bg: 'bg-white',
              },
              {
                label: 'Frei in ≤ 15 Min',
                value: data.returningWithin15Min,
                unit: '',
                icon: <Clock className="h-3.5 w-3.5" />,
                color: data.returningWithin15Min > 0 ? 'text-emerald-700' : 'text-stone-400',
                bg: data.returningWithin15Min > 0 ? 'bg-emerald-50' : 'bg-white',
              },
              {
                label: 'Frei in ≤ 30 Min',
                value: data.returningWithin30Min,
                unit: '',
                icon: <Clock className="h-3.5 w-3.5" />,
                color: data.returningWithin30Min > 0 ? 'text-amber-700' : 'text-stone-400',
                bg: data.returningWithin30Min > 0 ? 'bg-amber-50' : 'bg-white',
              },
              {
                label: 'Ø Rückkehr',
                value: data.avgMinutesUntilReturn > 0 ? data.avgMinutesUntilReturn : 0,
                unit: ' Min',
                icon: <Zap className="h-3.5 w-3.5" />,
                color: 'text-violet-700',
                bg: 'bg-white',
              },
            ].map((kpi) => (
              <div key={kpi.label} className={cn('px-4 py-3', kpi.bg)}>
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-stone-400">{kpi.icon}</span>
                  <span className="text-[9px] font-black uppercase tracking-wider text-stone-400">
                    {kpi.label}
                  </span>
                </div>
                <div className={cn('text-2xl font-black tabular-nums', kpi.color)}>
                  {kpi.value}{kpi.unit}
                </div>
              </div>
            ))}
          </div>

          {/* Driver list */}
          {data.predictions.length > 0 && (
            <div className="divide-y divide-stone-50">
              {[...data.predictions]
                .sort((a, b) => a.minutesUntilReturn - b.minutesUntilReturn)
                .map(p => {
                  const donePct   = p.totalStops > 0 ? (p.totalStops - p.remainingStops) / p.totalStops : 0;
                  const confPct   = Math.round(p.confidence * 100);
                  const isSoon    = p.minutesUntilReturn <= 15;
                  const isOverdue = p.minutesUntilReturn < 0;

                  return (
                    <div key={p.driverId} className="flex items-center gap-3 px-4 py-2.5">
                      <div className={cn(
                        'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
                        isOverdue ? 'bg-red-100 text-red-700' :
                        isSoon    ? 'bg-amber-100 text-amber-700' :
                        'bg-violet-100 text-violet-700',
                      )}>
                        {p.driverVehicle === 'car'
                          ? <Car className="h-3.5 w-3.5" />
                          : <Bike className="h-3.5 w-3.5" />
                        }
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[11px] font-black text-char truncate">
                            {p.driverName ?? 'Fahrer'}
                          </span>
                          <span className={cn(
                            'rounded-full px-1.5 py-0.5 text-[8px] font-black',
                            confPct >= 75 ? 'bg-emerald-100 text-emerald-700' :
                            confPct >= 50 ? 'bg-amber-100 text-amber-700' :
                            'bg-red-100 text-red-700',
                          )}>
                            {confPct}%
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1 rounded-full bg-stone-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-violet-400 transition-all"
                              style={{ width: `${donePct * 100}%` }}
                            />
                          </div>
                          <span className="text-[9px] text-stone-400 tabular-nums shrink-0">
                            {p.totalStops - p.remainingStops}/{p.totalStops}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        {isOverdue ? (
                          <div className="text-[11px] font-black text-red-600">Überfällig</div>
                        ) : (
                          <>
                            <div className={cn(
                              'text-sm font-black tabular-nums',
                              isSoon ? 'text-amber-700' : 'text-violet-700',
                            )}>
                              ~{p.minutesUntilReturn} Min
                            </div>
                            <div className="text-[9px] text-stone-400 tabular-nums">
                              ≈ {fmtTime(p.estimatedReturnUtc)}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {data.predictions.length === 0 && data.activeDrivers === 0 && (
            <div className="px-4 py-6 text-center text-[11px] text-stone-400">
              Keine aktiven Fahrer
            </div>
          )}
        </>
      ) : loading ? (
        <div className="px-4 py-6 text-center text-[11px] text-stone-400">
          Lade Vorhersagen…
        </div>
      ) : (
        <div className="px-4 py-6 text-center text-[11px] text-stone-400">
          Keine Daten verfügbar
        </div>
      )}
    </div>
  );
}
