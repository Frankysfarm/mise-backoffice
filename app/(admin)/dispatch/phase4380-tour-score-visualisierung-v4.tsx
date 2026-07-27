'use client';

import { useState, useEffect, useCallback } from 'react';
import { Route, Star, Clock, Zap, MapPin, CheckCircle2, AlertTriangle, TrendingUp, Navigation } from 'lucide-react';

interface TourStop {
  id: string;
  reihenfolge: number;
  adresse: string;
  bestellnummer: string;
  status: 'ausstehend' | 'aktiv' | 'abgeschlossen';
  eta_min: number | null;
  versp_min: number;
}

interface TourEntry {
  id: string;
  fahrer_name: string;
  score: number;
  score_delta: number;
  pünktlichkeit_pct: number;
  lieferzeit_avg_min: number;
  aktive_stopps: number;
  abgeschlossene_stopps: number;
  stops: TourStop[];
  laufend: boolean;
  eta_rest_min: number | null;
  km_bisher: number;
}

interface FleetKpis {
  fleet_score: number;
  aktive_touren: number;
  on_time_pct: number;
  avg_lieferzeit_min: number;
  touren: TourEntry[];
}

const MOCK: FleetKpis = {
  fleet_score: 81,
  aktive_touren: 3,
  on_time_pct: 87,
  avg_lieferzeit_min: 23,
  touren: [
    {
      id: 't1', fahrer_name: 'Max M.', score: 91, score_delta: 3, pünktlichkeit_pct: 95,
      lieferzeit_avg_min: 19, aktive_stopps: 1, abgeschlossene_stopps: 2,
      laufend: true, eta_rest_min: 8, km_bisher: 4.2,
      stops: [
        { id: 's1', reihenfolge: 1, adresse: 'Kaiserstr. 7', bestellnummer: '#1040', status: 'abgeschlossen', eta_min: null, versp_min: 0 },
        { id: 's2', reihenfolge: 2, adresse: 'Elisenstr. 5', bestellnummer: '#1041', status: 'aktiv',         eta_min: 8,   versp_min: 0 },
        { id: 's3', reihenfolge: 3, adresse: 'Pontstr. 12',  bestellnummer: '#1042', status: 'ausstehend',    eta_min: 18,  versp_min: 0 },
      ],
    },
    {
      id: 't2', fahrer_name: 'Anna S.', score: 74, score_delta: -2, pünktlichkeit_pct: 80,
      lieferzeit_avg_min: 26, aktive_stopps: 2, abgeschlossene_stopps: 1,
      laufend: true, eta_rest_min: 14, km_bisher: 3.1,
      stops: [
        { id: 's4', reihenfolge: 1, adresse: 'Adalbertstr. 3', bestellnummer: '#1043', status: 'abgeschlossen', eta_min: null, versp_min: 0 },
        { id: 's5', reihenfolge: 2, adresse: 'Jülichstr. 9',   bestellnummer: '#1044', status: 'aktiv',         eta_min: 6,   versp_min: 4 },
        { id: 's6', reihenfolge: 3, adresse: 'Boxgraben 14',   bestellnummer: '#1045', status: 'ausstehend',    eta_min: 14,  versp_min: 0 },
      ],
    },
    {
      id: 't3', fahrer_name: 'Leon K.', score: 68, score_delta: 0, pünktlichkeit_pct: 75,
      lieferzeit_avg_min: 29, aktive_stopps: 1, abgeschlossene_stopps: 0,
      laufend: true, eta_rest_min: 22, km_bisher: 1.8,
      stops: [
        { id: 's7', reihenfolge: 1, adresse: 'Seilgraben 2', bestellnummer: '#1046', status: 'aktiv',      eta_min: 22, versp_min: 0 },
        { id: 's8', reihenfolge: 2, adresse: 'Trierer Str.', bestellnummer: '#1047', status: 'ausstehend', eta_min: 33, versp_min: 0 },
      ],
    },
  ],
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 85 ? 'bg-green-500' : score >= 70 ? 'bg-yellow-500' : score >= 50 ? 'bg-orange-500' : 'bg-red-500';
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden w-full">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
    </div>
  );
}

function scoreTextColor(s: number) {
  return s >= 85 ? 'text-green-600' : s >= 70 ? 'text-yellow-600' : s >= 50 ? 'text-orange-600' : 'text-red-600';
}

interface Props { locationId: string | null }

export function DispatchPhase4380TourScoreVisualisierungV4({ locationId }: Props) {
  const [data, setData] = useState<FleetKpis>(MOCK);
  const [loading, setLoading] = useState(false);
  const [expandedTour, setExpandedTour] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/dispatch/tour-scores?location_id=${locationId}`);
      if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ }
    finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 20_000); return () => clearInterval(iv); }, [load]);

  const fleetColor = scoreTextColor(data.fleet_score);

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Route className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-xs font-semibold text-gray-900">Tour-Score V4</span>
          {loading && <span className="w-2 h-2 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        <span className={`text-sm font-bold ${fleetColor}`}>Fleet {data.fleet_score}</span>
      </div>

      {/* Fleet KPIs */}
      <div className="grid grid-cols-4 gap-1 text-center">
        <div className="bg-blue-50 rounded-lg p-1.5">
          <p className="text-[8px] text-blue-400 font-bold uppercase tracking-wide">Score</p>
          <p className={`text-sm font-bold ${fleetColor}`}>{data.fleet_score}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-1.5">
          <p className="text-[8px] text-green-500 font-bold uppercase tracking-wide">Pünktl.</p>
          <p className="text-sm font-bold text-green-700">{data.on_time_pct}%</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-1.5">
          <p className="text-[8px] text-purple-400 font-bold uppercase tracking-wide">Touren</p>
          <p className="text-sm font-bold text-purple-700">{data.aktive_touren}</p>
        </div>
        <div className="bg-amber-50 rounded-lg p-1.5">
          <p className="text-[8px] text-amber-500 font-bold uppercase tracking-wide">Ø Liefer</p>
          <p className="text-sm font-bold text-amber-700">{data.avg_lieferzeit_min}m</p>
        </div>
      </div>

      {/* Tour cards */}
      <div className="space-y-1.5">
        {data.touren.map((tour) => {
          const tc = scoreTextColor(tour.score);
          const isExpanded = expandedTour === tour.id;
          const totalStops = tour.aktive_stopps + tour.abgeschlossene_stopps + (tour.stops.length - tour.aktive_stopps - tour.abgeschlossene_stopps);
          const donePct = totalStops > 0 ? Math.round((tour.abgeschlossene_stopps / totalStops) * 100) : 0;

          return (
            <div key={tour.id} className="border border-gray-100 rounded-lg overflow-hidden">
              <button
                onClick={() => setExpandedTour(isExpanded ? null : tour.id)}
                className="w-full flex items-center gap-2 px-2.5 py-2 bg-gray-50 hover:bg-gray-100 text-left"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[11px] font-semibold text-gray-900 truncate">{tour.fahrer_name}</span>
                    {tour.laufend && <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />}
                    {tour.score_delta !== 0 && (
                      <span className={`text-[9px] font-bold flex-shrink-0 ${tour.score_delta > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {tour.score_delta > 0 ? '+' : ''}{tour.score_delta}
                      </span>
                    )}
                  </div>
                  <ScoreBar score={tour.score} />
                </div>
                <div className="text-right flex-shrink-0 space-y-0.5">
                  <p className={`text-sm font-bold ${tc}`}>{tour.score}</p>
                  <p className="text-[9px] text-gray-400">{donePct}% fertig</p>
                </div>
              </button>

              {/* Sub-KPIs */}
              <div className="flex items-center gap-3 px-2.5 py-1 text-[9px] text-gray-500 border-t border-gray-100 bg-white">
                <span className="flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5 text-green-400" />{tour.abgeschlossene_stopps}/{tour.stops.length}</span>
                <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />Ø {tour.lieferzeit_avg_min}m</span>
                <span className="flex items-center gap-0.5"><TrendingUp className="w-2.5 h-2.5 text-blue-400" />{tour.pünktlichkeit_pct}%</span>
                {tour.eta_rest_min != null && (
                  <span className="flex items-center gap-0.5 ml-auto text-blue-500 font-medium">
                    <Navigation className="w-2.5 h-2.5" />~{tour.eta_rest_min}m
                  </span>
                )}
              </div>

              {/* Stop sequence (expanded) */}
              {isExpanded && (
                <div className="px-2.5 py-1.5 space-y-1 border-t border-gray-100">
                  {tour.stops.map((stop) => {
                    const isDone = stop.status === 'abgeschlossen';
                    const isActive = stop.status === 'aktiv';
                    const hasDelay = stop.versp_min > 0;

                    return (
                      <div key={stop.id} className="flex items-center gap-1.5">
                        <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${isDone ? 'bg-green-100' : isActive ? 'bg-blue-100' : 'bg-gray-100'}`}>
                          {isDone
                            ? <CheckCircle2 className="w-2.5 h-2.5 text-green-500" />
                            : isActive
                              ? <Zap className="w-2.5 h-2.5 text-blue-500" />
                              : <span className="text-[8px] font-bold text-gray-400">{stop.reihenfolge}</span>
                          }
                        </div>
                        <span className="text-[9px] text-gray-500 font-medium w-10 flex-shrink-0">{stop.bestellnummer}</span>
                        <span className={`text-[10px] flex-1 truncate ${isDone ? 'line-through text-gray-400' : isActive ? 'text-blue-700 font-medium' : 'text-gray-600'}`}>
                          {stop.adresse}
                        </span>
                        {stop.eta_min != null && !isDone && (
                          <span className={`text-[9px] font-bold flex-shrink-0 ${hasDelay ? 'text-red-500' : 'text-gray-500'}`}>
                            {hasDelay && <AlertTriangle className="w-2 h-2 inline mr-0.5" />}
                            {stop.eta_min}m
                          </span>
                        )}
                        <span className="flex items-center gap-0.5">
                          <MapPin className="w-2 h-2 text-gray-300" />
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[8px] text-gray-400 pt-1 border-t border-gray-100">
        <span>Score: grün ≥85 · gelb ≥70 · orange ≥50 · rot &lt;50</span>
        <span className="flex items-center gap-0.5"><Clock className="w-2 h-2" />20s</span>
      </div>
    </div>
  );
}
