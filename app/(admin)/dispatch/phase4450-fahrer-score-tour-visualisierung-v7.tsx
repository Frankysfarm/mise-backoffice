'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, MapPin, Clock, TrendingUp, TrendingDown, Star, CheckCircle2, AlertTriangle, Navigation, Package, ChevronDown, ChevronUp } from 'lucide-react';

interface TourStopp {
  stop_id: string;
  position: number;
  adresse: string;
  status: 'ausstehend' | 'unterwegs' | 'geliefert' | 'problem';
  eta_min: number | null;
  km: number | null;
}

interface FahrerScore {
  driver_id: string;
  driver_name: string;
  score: number;
  score_delta: number;
  rang: number;
  rang_delta: number;
  puenktlichkeit_pct: number;
  avg_lieferzeit_min: number;
  avg_bewertung: number;
  touren_heute: number;
  aktive_tour_id: string | null;
  tour_stopps: TourStopp[];
  zone: string;
  sla_pct: number;
}

interface ApiData {
  fahrer: FahrerScore[];
  flotten_avg_score: number;
  total_aktiv: number;
  sla_kritisch: number;
}

const MOCK_STOPPS: TourStopp[] = [
  { stop_id: 's1', position: 1, adresse: 'Pontstraße 14, Aachen',    status: 'geliefert',  eta_min: null, km: 0.8 },
  { stop_id: 's2', position: 2, adresse: 'Jakobstraße 55, Aachen',   status: 'unterwegs',  eta_min: 4,    km: 1.2 },
  { stop_id: 's3', position: 3, adresse: 'Kaiserplatz 3, Aachen',    status: 'ausstehend', eta_min: 12,   km: 2.1 },
  { stop_id: 's4', position: 4, adresse: 'Elisabethstraße 7, Aachen',status: 'ausstehend', eta_min: 19,   km: 3.4 },
];

const MOCK: ApiData = {
  fahrer: [
    { driver_id: 'd1', driver_name: 'Marco R.', score: 94, score_delta: +3, rang: 1, rang_delta: +1, puenktlichkeit_pct: 96, avg_lieferzeit_min: 18, avg_bewertung: 4.9, touren_heute: 7, aktive_tour_id: 't1', tour_stopps: MOCK_STOPPS, zone: 'Innenstadt', sla_pct: 98 },
    { driver_id: 'd2', driver_name: 'Luisa K.', score: 88, score_delta: -1, rang: 2, rang_delta: 0,  puenktlichkeit_pct: 91, avg_lieferzeit_min: 21, avg_bewertung: 4.7, touren_heute: 5, aktive_tour_id: 't2', tour_stopps: MOCK_STOPPS.slice(0,2), zone: 'Burtscheid', sla_pct: 91 },
    { driver_id: 'd3', driver_name: 'Jan T.',   score: 71, score_delta: -5, rang: 3, rang_delta: -1, puenktlichkeit_pct: 74, avg_lieferzeit_min: 28, avg_bewertung: 4.3, touren_heute: 4, aktive_tour_id: null, tour_stopps: [],   zone: 'Laurensberg', sla_pct: 72 },
  ],
  flotten_avg_score: 84,
  total_aktiv: 3,
  sla_kritisch: 1,
};

function scoreColor(s: number) {
  if (s >= 90) return { text: 'text-green-600',  bg: 'bg-green-50',  ring: 'ring-green-300',  label: 'Exzellent' };
  if (s >= 75) return { text: 'text-yellow-600', bg: 'bg-yellow-50', ring: 'ring-yellow-300', label: 'Gut' };
  return                { text: 'text-red-600',   bg: 'bg-red-50',   ring: 'ring-red-300',    label: 'Kritisch' };
}

const STOPP_STATUS = {
  geliefert:  { dot: 'bg-green-400',  label: 'Geliefert' },
  unterwegs:  { dot: 'bg-blue-500 animate-pulse', label: 'Unterwegs' },
  ausstehend: { dot: 'bg-gray-300',   label: 'Ausstehend' },
  problem:    { dot: 'bg-red-500',    label: 'Problem' },
} as const;

interface Props { locationId?: string | null; }

export function DispatchPhase4450FahrerScoreTourVisualisierungV7({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/dispatch-score-tour-cockpit?location_id=${locationId}`);
      if (res.ok) { const j = await res.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 20_000); return () => clearInterval(id); }, [load]);

  const avgColor = scoreColor(data.flotten_avg_score);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold text-gray-900">Fahrer-Score + Tour-Visualisierung V7</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {data.sla_kritisch > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-bold bg-red-50 rounded px-1.5 py-0.5">
              <AlertTriangle className="w-3 h-3" />SLA krit.
            </span>
          )}
        </div>
      </div>

      {/* Flotten-KPI */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className={`rounded-lg border p-1.5 text-center ${avgColor.bg} ring-1 ${avgColor.ring}`}>
          <p className="text-[9px] font-medium text-gray-500 uppercase">Flotten-Avg</p>
          <p className={`text-xl font-black ${avgColor.text}`}>{data.flotten_avg_score}</p>
          <p className="text-[8px] text-gray-400">{avgColor.label}</p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-1.5 text-center">
          <p className="text-[9px] font-medium text-gray-500 uppercase">Aktive Fahrer</p>
          <p className="text-xl font-black text-gray-800">{data.total_aktiv}</p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gray-50 p-1.5 text-center">
          <p className="text-[9px] font-medium text-gray-500 uppercase">SLA-Krit.</p>
          <p className={`text-xl font-black ${data.sla_kritisch > 0 ? 'text-red-600' : 'text-green-600'}`}>{data.sla_kritisch}</p>
        </div>
      </div>

      {/* Fahrer-Liste mit Tour-Visualisierung */}
      <div className="space-y-1.5">
        {data.fahrer.map((f) => {
          const sc = scoreColor(f.score);
          const isExpanded = expandedDriver === f.driver_id;
          const geliefert = f.tour_stopps.filter((s) => s.status === 'geliefert').length;
          const total = f.tour_stopps.length;

          return (
            <div key={f.driver_id} className={`rounded-lg border ring-1 ${sc.ring} ${sc.bg} overflow-hidden`}>
              {/* Fahrer-Header */}
              <button
                className="w-full flex items-center gap-2 p-2 text-left hover:opacity-80 transition-opacity"
                onClick={() => setExpandedDriver(isExpanded ? null : f.driver_id)}
              >
                {/* Score-Badge */}
                <div className={`w-10 h-10 rounded-full flex flex-col items-center justify-center flex-shrink-0 bg-white ring-2 ${sc.ring}`}>
                  <span className={`text-sm font-black leading-none ${sc.text}`}>{f.score}</span>
                  <span className="text-[7px] text-gray-400">Score</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-gray-900">{f.driver_name}</span>
                    <span className="text-[9px] bg-white rounded px-1 text-gray-500 border">#{f.rang}</span>
                    {f.rang_delta !== 0 && (
                      f.rang_delta > 0
                        ? <TrendingUp className="w-3 h-3 text-green-500" />
                        : <TrendingDown className="w-3 h-3 text-red-500" />
                    )}
                    {f.score_delta !== 0 && (
                      <span className={`text-[9px] font-bold ${f.score_delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {f.score_delta > 0 ? '+' : ''}{f.score_delta}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-gray-500">{f.zone}</span>
                    <span className="text-[9px] text-gray-500">·</span>
                    <span className="text-[9px] text-gray-500">{f.touren_heute} Touren</span>
                    <span className="text-[9px] text-gray-500">·</span>
                    <Star className="w-2.5 h-2.5 text-amber-400" />
                    <span className="text-[9px] text-gray-700 font-medium">{f.avg_bewertung.toFixed(1)}</span>
                  </div>
                  {/* Tour-Fortschritt */}
                  {total > 0 && (
                    <div className="mt-1">
                      <div className="flex items-center gap-0.5">
                        {f.tour_stopps.map((s) => (
                          <div
                            key={s.stop_id}
                            className={`h-2 flex-1 rounded-sm ${STOPP_STATUS[s.status].dot.replace(' animate-pulse','')} ${s.status === 'unterwegs' ? 'animate-pulse' : ''}`}
                          />
                        ))}
                      </div>
                      <p className="text-[8px] text-gray-400 mt-0.5">{geliefert}/{total} Stopps · SLA {f.sla_pct}%</p>
                    </div>
                  )}
                </div>

                <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
                  <div className="flex items-center gap-1 text-[9px] text-gray-600">
                    <CheckCircle2 className="w-3 h-3 text-green-500" />
                    <span>{f.puenktlichkeit_pct}%</span>
                  </div>
                  <div className="flex items-center gap-1 text-[9px] text-gray-600">
                    <Clock className="w-3 h-3 text-blue-400" />
                    <span>{f.avg_lieferzeit_min}min</span>
                  </div>
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
                </div>
              </button>

              {/* Expandierte Tour-Details */}
              {isExpanded && f.tour_stopps.length > 0 && (
                <div className="border-t border-white/60 bg-white/50 px-3 py-2 space-y-1">
                  <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <Navigation className="w-3 h-3" />Tour-Stopps
                  </p>
                  {f.tour_stopps.map((s) => {
                    const ss = STOPP_STATUS[s.status];
                    return (
                      <div key={s.stop_id} className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-gray-400 w-4">{s.position}.</span>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ss.dot}`} />
                        <span className="text-[10px] text-gray-700 flex-1 truncate">{s.adresse}</span>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {s.eta_min !== null && (
                            <span className="text-[9px] text-blue-600 font-medium flex items-center gap-0.5">
                              <Clock className="w-2.5 h-2.5" />{s.eta_min}min
                            </span>
                          )}
                          {s.km !== null && (
                            <span className="text-[9px] text-gray-400 flex items-center gap-0.5">
                              <MapPin className="w-2.5 h-2.5" />{s.km}km
                            </span>
                          )}
                          <span className="text-[8px] text-gray-500">{ss.label}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sub-KPIs */}
      <div className="grid grid-cols-3 gap-1 text-center">
        <div>
          <p className="text-[8px] text-gray-400 uppercase">Ø Pünktl.</p>
          <p className="text-xs font-bold text-gray-700">
            {Math.round(data.fahrer.reduce((a,f) => a + f.puenktlichkeit_pct, 0) / Math.max(1, data.fahrer.length))}%
          </p>
        </div>
        <div>
          <p className="text-[8px] text-gray-400 uppercase">Ø Lieferz.</p>
          <p className="text-xs font-bold text-gray-700">
            {Math.round(data.fahrer.reduce((a,f) => a + f.avg_lieferzeit_min, 0) / Math.max(1, data.fahrer.length))}min
          </p>
        </div>
        <div>
          <p className="text-[8px] text-gray-400 uppercase">Ø Bewert.</p>
          <p className="text-xs font-bold text-gray-700">
            {(data.fahrer.reduce((a,f) => a + f.avg_bewertung, 0) / Math.max(1, data.fahrer.length)).toFixed(1)}★
          </p>
        </div>
      </div>
    </div>
  );
}
