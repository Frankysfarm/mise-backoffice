'use client';

import { useEffect, useState } from 'react';
import { Loader2, Route, AlertTriangle, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type RouteAlertLevel = 'optimal' | 'acceptable' | 'suboptimal' | 'poor';

interface TourRouteEfficiency {
  tourId: string;
  driverName: string | null;
  zone: string | null;
  stopCount: number;
  currentDistKm: number;
  optimalDistKm: number;
  efficiencyPct: number;
  alertLevel: RouteAlertLevel;
  status: string;
}

interface RouteSummary {
  activeTours: number;
  avgEfficiencyPct: number;
  poorTours: number;
  totalCurrentDistKm: number;
  totalOptimalDistKm: number;
}

interface ApiResponse {
  ok: boolean;
  tours: TourRouteEfficiency[];
  summary: RouteSummary;
  generatedAt: string;
}

interface Props {
  locationId: string | null;
}

const alertStyle: Record<RouteAlertLevel, { bar: string; badge: string; label: string; icon: string }> = {
  optimal:    { bar: 'bg-green-500',  badge: 'bg-green-100 text-green-700',   label: 'Optimal',     icon: 'text-green-500' },
  acceptable: { bar: 'bg-blue-400',   badge: 'bg-blue-100 text-blue-700',     label: 'Akzeptabel',  icon: 'text-blue-500' },
  suboptimal: { bar: 'bg-amber-400',  badge: 'bg-amber-100 text-amber-700',   label: 'Suboptimal',  icon: 'text-amber-500' },
  poor:       { bar: 'bg-red-500',    badge: 'bg-red-100 text-red-700',       label: 'Schlecht',    icon: 'text-red-500' },
};

export function DispatchTourRouteEfficiency({ locationId }: Props) {
  const [tours, setTours] = useState<TourRouteEfficiency[]>([]);
  const [summary, setSummary] = useState<RouteSummary | null>(null);
  const [open, setOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  async function load() {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/tour-route-efficiency?location_id=${locationId}`);
      if (!res.ok) return;
      const data: ApiResponse = await res.json();
      if (data.ok) {
        setTours(data.tours);
        setSummary(data.summary);
        setLastUpdate(data.generatedAt);
      }
    } catch {
      // silent fail
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const iv = setInterval(load, 60_000);
    return () => clearInterval(iv);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!loading && tours.length === 0) return null;

  const hasPoor = (summary?.poorTours ?? 0) > 0;

  return (
    <div className="border border-stone-200 rounded-xl shadow-sm bg-white overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center gap-3 px-5 py-3 bg-stone-50 hover:bg-stone-100 transition-colors text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <Route className={cn('w-4 h-4 shrink-0', hasPoor ? 'text-red-500' : 'text-indigo-500')} />
        <span className="font-semibold text-stone-800 text-sm flex-1">Tour-Routen-Effizienz</span>
        {loading && <Loader2 className="w-4 h-4 animate-spin text-stone-400" />}
        {!loading && summary && (
          <span className={cn(
            'text-xs font-bold px-2 py-0.5 rounded-full',
            hasPoor ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700',
          )}>
            {hasPoor
              ? `${summary.poorTours} Tour${summary.poorTours > 1 ? 'en' : ''} optimierbar`
              : `Ø ${summary.avgEfficiencyPct}% effizient`}
          </span>
        )}
        <span className="text-stone-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div>
          {/* Summary Bar */}
          {summary && (
            <div className="grid grid-cols-3 divide-x divide-stone-100 border-b border-stone-100">
              <div className="px-4 py-3 text-center">
                <div className="text-xl font-black tabular-nums text-stone-800">{summary.activeTours}</div>
                <div className="text-[10px] text-stone-500 uppercase tracking-wide">Aktive Touren</div>
              </div>
              <div className="px-4 py-3 text-center">
                <div className={cn('text-xl font-black tabular-nums', hasPoor ? 'text-red-600' : 'text-green-600')}>
                  {summary.avgEfficiencyPct}%
                </div>
                <div className="text-[10px] text-stone-500 uppercase tracking-wide">Ø Effizienz</div>
              </div>
              <div className="px-4 py-3 text-center">
                <div className="text-xl font-black tabular-nums text-stone-800">
                  {summary.totalCurrentDistKm.toFixed(1)} km
                </div>
                <div className="text-[10px] text-stone-500 uppercase tracking-wide">Gesamt-Distanz</div>
              </div>
            </div>
          )}

          {/* Alert Banner */}
          {hasPoor && summary && (
            <div className="mx-4 mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
              <span className="text-xs text-red-700 font-medium">
                {summary.poorTours} Tour{summary.poorTours > 1 ? 'en haben' : ' hat'} eine suboptimale Stop-Reihenfolge — manuelle Neuanordnung empfohlen.
              </span>
            </div>
          )}

          {/* Tour List */}
          <div className="divide-y divide-stone-100 mt-2">
            {tours.map((t) => {
              const s = alertStyle[t.alertLevel];
              const barW = Math.min(100, t.efficiencyPct);
              const saved = t.currentDistKm > 0 ? t.currentDistKm - t.optimalDistKm : 0;

              return (
                <div key={t.tourId} className="px-5 py-3">
                  <div className="flex items-center gap-3 mb-2">
                    {/* Alert icon */}
                    {t.alertLevel === 'poor' || t.alertLevel === 'suboptimal'
                      ? <AlertCircle className={cn('w-4 h-4 shrink-0', s.icon)} />
                      : <CheckCircle2 className={cn('w-4 h-4 shrink-0', s.icon)} />
                    }

                    {/* Driver + Zone */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm text-stone-800 truncate">
                          {t.driverName ?? 'Fahrer'}
                        </span>
                        {t.zone && (
                          <span className="text-[11px] bg-stone-100 text-stone-600 rounded px-1.5 py-0.5 font-medium">
                            Zone {t.zone}
                          </span>
                        )}
                        <span className={cn('text-[10px] font-bold rounded-full px-2 py-0.5', s.badge)}>
                          {s.label}
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-500 mt-0.5">
                        {t.stopCount} Stops · Ist {t.currentDistKm.toFixed(1)} km · Optimal {t.optimalDistKm.toFixed(1)} km
                        {saved > 0.1 && (
                          <span className="ml-1 text-amber-600 font-medium">
                            (−{saved.toFixed(1)} km möglich)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Score */}
                    <div className={cn('text-right shrink-0 font-black text-lg tabular-nums', s.icon)}>
                      {t.efficiencyPct}%
                    </div>
                  </div>

                  {/* Efficiency bar */}
                  <div className="h-1.5 bg-stone-200 rounded-full overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', s.bar)}
                      style={{ width: `${barW}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {lastUpdate && (
            <div className="px-5 py-2 text-[10px] text-stone-400 border-t border-stone-100 text-right">
              Aktualisiert: {new Date(lastUpdate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · alle 1 Min
            </div>
          )}
        </div>
      )}
    </div>
  );
}
