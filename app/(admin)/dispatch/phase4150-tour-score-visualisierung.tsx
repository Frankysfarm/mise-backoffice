'use client';

import { useState, useEffect, useCallback } from 'react';
import { Route, Star, Clock, Zap, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TourStop {
  id: string;
  adresse: string;
  bestellnummer: string;
  eta_min: number | null;
  status: 'ausstehend' | 'abgeschlossen' | 'aktiv';
  verspätung_min?: number;
}

interface Tour {
  id: string;
  fahrer_name: string;
  score: number;
  stops: TourStop[];
  start_min_ago: number;
  eta_gesamt_min: number;
  pünktlichkeit_pct: number;
  laufend: boolean;
}

interface ApiData {
  touren: Tour[];
  fleet_score: number;
  aktive_touren: number;
  on_time_pct: number;
}

function scoreColor(s: number) {
  if (s >= 80) return 'text-emerald-600';
  if (s >= 60) return 'text-amber-600';
  if (s >= 40) return 'text-orange-600';
  return 'text-red-600';
}
function scoreBg(s: number) {
  if (s >= 80) return 'bg-emerald-500';
  if (s >= 60) return 'bg-amber-500';
  if (s >= 40) return 'bg-orange-500';
  return 'bg-red-500';
}

const MOCK: ApiData = {
  fleet_score: 78,
  aktive_touren: 3,
  on_time_pct: 84,
  touren: [
    {
      id: 't1', fahrer_name: 'Max M.', score: 88, start_min_ago: 18, eta_gesamt_min: 12, pünktlichkeit_pct: 92, laufend: true,
      stops: [
        { id: 's1', adresse: 'Elisenstr. 5', bestellnummer: '#1041', eta_min: 4, status: 'aktiv' },
        { id: 's2', adresse: 'Pontstr. 12', bestellnummer: '#1042', eta_min: 12, status: 'ausstehend' },
        { id: 's3', adresse: 'Kaiserpl. 3', bestellnummer: '#1040', eta_min: null, status: 'abgeschlossen' },
      ],
    },
    {
      id: 't2', fahrer_name: 'Lisa K.', score: 65, start_min_ago: 35, eta_gesamt_min: 8, pünktlichkeit_pct: 71, laufend: true,
      stops: [
        { id: 's4', adresse: 'Römerstr. 22', bestellnummer: '#1044', eta_min: 8, status: 'aktiv', verspätung_min: 3 },
        { id: 's5', adresse: 'Dom 1', bestellnummer: '#1043', eta_min: null, status: 'abgeschlossen' },
      ],
    },
    {
      id: 't3', fahrer_name: 'Tom B.', score: 45, start_min_ago: 52, eta_gesamt_min: 20, pünktlichkeit_pct: 55, laufend: true,
      stops: [
        { id: 's6', adresse: 'Adalbertstr. 9', bestellnummer: '#1046', eta_min: 20, status: 'aktiv', verspätung_min: 7 },
        { id: 's7', adresse: 'Bismarckstr. 1', bestellnummer: '#1047', eta_min: 28, status: 'ausstehend' },
      ],
    },
  ],
};

interface Props { locationId: string | null; }

export function DispatchPhase4150TourScoreVisualisierung({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/tours?location_id=${locationId}&status=aktiv`);
      if (res.ok) { const j = await res.json(); if (!j.error && j.touren) setData(j); }
    } catch { /* Mock-Fallback */ }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 20_000); return () => clearInterval(id); }, [load]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Route className="w-4 h-4 text-violet-500" />
          <span className="text-xs font-bold text-gray-900">Tour-Score · Visualisierung</span>
        </div>
        <span className="text-[10px] text-gray-400">{data.aktive_touren} aktiv</span>
      </div>

      {/* Fleet KPIs */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="bg-violet-50 rounded-lg p-1.5 text-center">
          <div className="text-[9px] text-gray-500">Fleet-Score</div>
          <div className={cn('text-sm font-black', scoreColor(data.fleet_score))}>{data.fleet_score}</div>
        </div>
        <div className="bg-emerald-50 rounded-lg p-1.5 text-center">
          <div className="text-[9px] text-gray-500">Pünktl.</div>
          <div className="text-sm font-black text-emerald-600">{data.on_time_pct}%</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-1.5 text-center">
          <div className="text-[9px] text-gray-500">Touren</div>
          <div className="text-sm font-black text-blue-600">{data.aktive_touren}</div>
        </div>
      </div>

      {/* Tour-Karten */}
      <div className="space-y-2">
        {data.touren.map(tour => (
          <div key={tour.id} className="border border-gray-100 rounded-lg overflow-hidden">
            {/* Header */}
            <button
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors"
              onClick={() => setExpanded(expanded === tour.id ? null : tour.id)}
            >
              <div className="flex items-center gap-2">
                <div className={cn('w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white', scoreBg(tour.score))}>
                  {tour.score}
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-gray-800">{tour.fahrer_name}</div>
                  <div className="text-[9px] text-gray-400">{tour.stops.length} Stopps · vor {tour.start_min_ago}min gestartet</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('text-[10px] font-bold', tour.pünktlichkeit_pct >= 80 ? 'text-emerald-600' : 'text-amber-600')}>
                  {tour.pünktlichkeit_pct}% pünktl.
                </span>
                {tour.stops.some(s => s.verspätung_min) && (
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                )}
              </div>
            </button>

            {/* Score-Balken */}
            <div className="h-1 bg-gray-100">
              <div className={cn('h-full transition-all', scoreBg(tour.score))} style={{ width: `${tour.score}%` }} />
            </div>

            {/* Stops-Expansion */}
            {expanded === tour.id && (
              <div className="px-3 py-2 bg-gray-50 space-y-1.5">
                <div className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Stopp-Sequenz</div>
                {tour.stops.map((stop, idx) => (
                  <div key={stop.id} className="flex items-center gap-2">
                    <div className={cn(
                      'w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0',
                      stop.status === 'abgeschlossen' ? 'bg-emerald-100 text-emerald-700' :
                      stop.status === 'aktiv' ? 'bg-blue-100 text-blue-700 animate-pulse' :
                      'bg-gray-100 text-gray-500',
                    )}>
                      {stop.status === 'abgeschlossen' ? '✓' : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-semibold text-gray-800 truncate">{stop.adresse}</div>
                      <div className="text-[9px] text-gray-400">{stop.bestellnummer}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {stop.eta_min !== null && (
                        <span className={cn(
                          'text-[10px] font-bold',
                          stop.verspätung_min ? 'text-red-600' : 'text-gray-600',
                        )}>
                          {stop.eta_min}min
                          {stop.verspätung_min && <span className="text-red-500"> (+{stop.verspätung_min})</span>}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
