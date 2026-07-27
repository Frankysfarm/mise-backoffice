'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, Route, MapPin, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

interface TourStop {
  stopp_nr: number;
  adresse: string;
  status: 'geliefert' | 'unterwegs' | 'ausstehend' | 'problem';
  eta_delta_min: number;
}

interface FahrerTour {
  fahrer_id: string;
  fahrer_name: string;
  gesamt_score: number;
  score_delta: number;
  puenktlichkeit_pct: number;
  lieferzeit_min: number;
  bewertung_avg: number;
  aktive_tour: boolean;
  stopps_gesamt: number;
  stopps_erledigt: number;
  verzoegerung_min: number;
  stops: TourStop[];
  expanded: boolean;
}

interface BoardData {
  fahrer: FahrerTour[];
  flotten_score: number;
  alert_count: number;
  top_name: string;
  top_score: number;
}

const MOCK: BoardData = {
  flotten_score: 79,
  alert_count: 1,
  top_name: 'Lisa W.',
  top_score: 94,
  fahrer: [
    {
      fahrer_id: 'f1', fahrer_name: 'Lisa W.', gesamt_score: 94, score_delta: 3,
      puenktlichkeit_pct: 97, lieferzeit_min: 22, bewertung_avg: 4.9,
      aktive_tour: true, stopps_gesamt: 5, stopps_erledigt: 3, verzoegerung_min: 0,
      expanded: false,
      stops: [
        { stopp_nr: 1, adresse: 'Adalbertsteinweg 12', status: 'geliefert', eta_delta_min: 0 },
        { stopp_nr: 2, adresse: 'Jülicher Str. 8', status: 'geliefert', eta_delta_min: -1 },
        { stopp_nr: 3, adresse: 'Pontstraße 3', status: 'unterwegs', eta_delta_min: 2 },
        { stopp_nr: 4, adresse: 'Habsburgerallee 5', status: 'ausstehend', eta_delta_min: 0 },
        { stopp_nr: 5, adresse: 'Vaalser Str. 20', status: 'ausstehend', eta_delta_min: 0 },
      ],
    },
    {
      fahrer_id: 'f2', fahrer_name: 'Marco T.', gesamt_score: 82, score_delta: 0,
      puenktlichkeit_pct: 87, lieferzeit_min: 26, bewertung_avg: 4.6,
      aktive_tour: true, stopps_gesamt: 4, stopps_erledigt: 2, verzoegerung_min: 3,
      expanded: false,
      stops: [
        { stopp_nr: 1, adresse: 'Sandkaulstraße 1', status: 'geliefert', eta_delta_min: 0 },
        { stopp_nr: 2, adresse: 'Elisengarten 7', status: 'geliefert', eta_delta_min: 3 },
        { stopp_nr: 3, adresse: 'Boxgraben 18', status: 'unterwegs', eta_delta_min: 5 },
        { stopp_nr: 4, adresse: 'Richardstraße 9', status: 'ausstehend', eta_delta_min: 0 },
      ],
    },
    {
      fahrer_id: 'f3', fahrer_name: 'Ben K.', gesamt_score: 63, score_delta: -4,
      puenktlichkeit_pct: 68, lieferzeit_min: 34, bewertung_avg: 4.2,
      aktive_tour: true, stopps_gesamt: 3, stopps_erledigt: 1, verzoegerung_min: 9,
      expanded: false,
      stops: [
        { stopp_nr: 1, adresse: 'Theaterstraße 4', status: 'geliefert', eta_delta_min: 8 },
        { stopp_nr: 2, adresse: 'Kaiserplatz 2', status: 'problem', eta_delta_min: 12 },
        { stopp_nr: 3, adresse: 'Jakobstraße 6', status: 'ausstehend', eta_delta_min: 0 },
      ],
    },
  ],
};

const STOP_STYLES = {
  geliefert: { dot: 'bg-green-500',  line: 'bg-green-200' },
  unterwegs:  { dot: 'bg-blue-500 animate-pulse', line: 'bg-blue-100' },
  ausstehend: { dot: 'bg-gray-300',  line: 'bg-gray-100' },
  problem:    { dot: 'bg-red-500',   line: 'bg-red-100' },
} as const;

function scoreBg(s: number) {
  return s >= 85 ? 'bg-green-100 text-green-700' : s >= 70 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
}

interface Props { locationId: string | null; }

export function DispatchPhase4307FahrerScoreTourVisualisierungBoard({ locationId }: Props) {
  const [data, setData] = useState<BoardData>(MOCK);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-tour-score?location_id=${locationId}`);
      if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 20_000); return () => clearInterval(id); }, [load]);

  const fleetColor = data.flotten_score >= 85 ? 'text-green-600' : data.flotten_score >= 70 ? 'text-yellow-600' : 'text-red-500';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold text-gray-900">Score + Tour-Visualisierung</span>
          {loading && <span className="w-2 h-2 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        <div className="flex items-center gap-2">
          {data.alert_count > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-red-600 bg-red-50 rounded-full px-1.5 py-0.5">
              <AlertTriangle className="w-2.5 h-2.5" />{data.alert_count}
            </span>
          )}
          <span className={`text-sm font-bold ${fleetColor}`}>⌀ {data.flotten_score}</span>
        </div>
      </div>

      {/* Top Performer Strip */}
      <div className="flex items-center gap-2 bg-amber-50 rounded-lg px-2 py-1.5">
        <Trophy className="w-3 h-3 text-amber-500" />
        <span className="text-[10px] font-semibold text-amber-700">Top: {data.top_name}</span>
        <span className="text-[10px] font-bold text-amber-700 ml-auto">{data.top_score} Punkte</span>
      </div>

      {/* Fahrer Cards */}
      <div className="space-y-2">
        {data.fahrer.map((f) => {
          const isOpen = expanded[f.fahrer_id];
          const progress = f.stopps_gesamt > 0 ? (f.stopps_erledigt / f.stopps_gesamt) * 100 : 0;
          const alertStyle = f.gesamt_score < 70 ? 'border-red-200 bg-red-50/30' : 'border-gray-200';

          return (
            <div key={f.fahrer_id} className={`rounded-lg border ${alertStyle} overflow-hidden`}>
              {/* Card Header */}
              <button
                onClick={() => setExpanded((p) => ({ ...p, [f.fahrer_id]: !p[f.fahrer_id] }))}
                className="w-full flex items-center gap-2 px-2.5 py-2 hover:bg-gray-50 transition text-left"
              >
                <span className={`text-[11px] font-bold rounded-md px-1.5 py-0.5 ${scoreBg(f.gesamt_score)}`}>
                  {f.gesamt_score}
                </span>
                <span className="text-[11px] font-semibold text-gray-800 flex-1">{f.fahrer_name}</span>

                {/* Score delta */}
                <span className="flex items-center gap-0.5 text-[9px]">
                  {f.score_delta > 0 && <><TrendingUp className="w-2.5 h-2.5 text-green-500" /><span className="text-green-600">+{f.score_delta}</span></>}
                  {f.score_delta < 0 && <><TrendingDown className="w-2.5 h-2.5 text-red-500" /><span className="text-red-600">{f.score_delta}</span></>}
                  {f.score_delta === 0 && <Minus className="w-2.5 h-2.5 text-gray-400" />}
                </span>

                {/* Stopps */}
                <span className="text-[9px] text-gray-500">{f.stopps_erledigt}/{f.stopps_gesamt}</span>

                {/* Delay */}
                {f.verzoegerung_min > 0 && (
                  <span className="text-[9px] font-bold text-red-600">+{f.verzoegerung_min}m</span>
                )}
                {f.verzoegerung_min === 0 && <CheckCircle2 className="w-3 h-3 text-green-500" />}

                <span className="text-[9px] text-gray-400">{isOpen ? '▲' : '▼'}</span>
              </button>

              {/* Progress Bar */}
              <div className="h-1 bg-gray-100">
                <div
                  className={`h-full transition-all duration-500 ${f.gesamt_score >= 85 ? 'bg-green-400' : f.gesamt_score >= 70 ? 'bg-yellow-400' : 'bg-red-400'}`}
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Sub KPIs */}
              <div className="px-2.5 py-1.5 grid grid-cols-3 gap-1 text-center bg-gray-50/50">
                <div>
                  <p className="text-[8px] text-gray-400">Pünktl.</p>
                  <p className="text-[10px] font-bold text-gray-700">{f.puenktlichkeit_pct}%</p>
                </div>
                <div>
                  <p className="text-[8px] text-gray-400">Lieferzeit</p>
                  <p className="text-[10px] font-bold text-gray-700">{f.lieferzeit_min}m</p>
                </div>
                <div>
                  <p className="text-[8px] text-gray-400">Bewertung</p>
                  <p className="text-[10px] font-bold text-gray-700">★ {f.bewertung_avg}</p>
                </div>
              </div>

              {/* Expanded: Stop Timeline */}
              {isOpen && (
                <div className="px-2.5 py-2 border-t border-gray-100 space-y-1.5">
                  <div className="flex items-center gap-1 mb-1">
                    <Route className="w-3 h-3 text-blue-500" />
                    <span className="text-[9px] font-semibold text-blue-600 uppercase tracking-wide">Tour-Stopps</span>
                  </div>
                  {f.stops.map((s, i) => {
                    const ss = STOP_STYLES[s.status];
                    return (
                      <div key={s.stopp_nr} className="flex items-start gap-1.5">
                        <div className="flex flex-col items-center flex-shrink-0">
                          <span className={`w-2.5 h-2.5 rounded-full ${ss.dot}`} />
                          {i < f.stops.length - 1 && <span className={`w-0.5 h-3 ${ss.line}`} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-[9px] text-gray-500 font-medium">#{s.stopp_nr}</span>
                          <span className="text-[9px] text-gray-700 ml-1 truncate">{s.adresse}</span>
                        </div>
                        {s.eta_delta_min > 0 && (
                          <span className="text-[8px] font-bold text-red-500 flex-shrink-0">+{s.eta_delta_min}m</span>
                        )}
                        {s.eta_delta_min < 0 && (
                          <span className="text-[8px] font-bold text-green-500 flex-shrink-0">{s.eta_delta_min}m</span>
                        )}
                        {s.status === 'geliefert' && <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />}
                        {s.status === 'problem'   && <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[9px] text-gray-400 border-t border-gray-100 pt-1.5">
        <span className="flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" />Stopp-Karte per Tippen</span>
        <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" />20s Polling</span>
      </div>
    </div>
  );
}
