'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, MapPin, Clock, TrendingUp, TrendingDown, Minus, CheckCircle2, AlertTriangle, Route, Star, Zap } from 'lucide-react';

type StoppStatus = 'geliefert' | 'aktiv' | 'ausstehend';
type ScoreStufe = 'top' | 'gut' | 'schwach';

interface TourStopp {
  nr: number;
  adresse_kurz: string;
  status: StoppStatus;
  lieferzeit_min: number | null;
}

interface FahrerScoreRow {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_delta: number;
  stufe: ScoreStufe;
  puenktlichkeit_pct: number;
  lieferzeit_avg_min: number;
  bewertung_avg: number;
  stopps_erledigt: number;
  stopps_gesamt: number;
  aktive_tour_id: string | null;
  tour_stopps: TourStopp[];
}

interface ApiData {
  fahrer: FahrerScoreRow[];
  flotten_avg_score: number;
  top_fahrer_name: string;
  alert_count: number;
}

const MOCK: ApiData = {
  flotten_avg_score: 76,
  top_fahrer_name: 'Lukas H.',
  alert_count: 1,
  fahrer: [
    {
      fahrer_id: 'f1', fahrer_name: 'Lukas H.', score: 91, score_delta: 3, stufe: 'top',
      puenktlichkeit_pct: 94, lieferzeit_avg_min: 22, bewertung_avg: 4.8,
      stopps_erledigt: 4, stopps_gesamt: 6, aktive_tour_id: 't1',
      tour_stopps: [
        { nr: 1, adresse_kurz: 'Adalbertsteinweg 12', status: 'geliefert', lieferzeit_min: 18 },
        { nr: 2, adresse_kurz: 'Jülicher Str. 8',     status: 'geliefert', lieferzeit_min: 21 },
        { nr: 3, adresse_kurz: 'Pontstraße 3',         status: 'geliefert', lieferzeit_min: 24 },
        { nr: 4, adresse_kurz: 'Habsburgerallee 5',    status: 'geliefert', lieferzeit_min: 26 },
        { nr: 5, adresse_kurz: 'Vaalser Str. 20',      status: 'aktiv',     lieferzeit_min: null },
        { nr: 6, adresse_kurz: 'Franzstraße 15',       status: 'ausstehend',lieferzeit_min: null },
      ],
    },
    {
      fahrer_id: 'f2', fahrer_name: 'Sara M.', score: 74, score_delta: -2, stufe: 'gut',
      puenktlichkeit_pct: 77, lieferzeit_avg_min: 28, bewertung_avg: 4.3,
      stopps_erledigt: 2, stopps_gesamt: 5, aktive_tour_id: 't2',
      tour_stopps: [
        { nr: 1, adresse_kurz: 'Roermonder Str. 4',   status: 'geliefert', lieferzeit_min: 25 },
        { nr: 2, adresse_kurz: 'Trierer Str. 11',      status: 'geliefert', lieferzeit_min: 32 },
        { nr: 3, adresse_kurz: 'Aachener Str. 9',      status: 'aktiv',     lieferzeit_min: null },
        { nr: 4, adresse_kurz: 'Westbahnhof Pl. 1',   status: 'ausstehend',lieferzeit_min: null },
        { nr: 5, adresse_kurz: 'Nizzaallee 7',         status: 'ausstehend',lieferzeit_min: null },
      ],
    },
    {
      fahrer_id: 'f3', fahrer_name: 'Tim B.', score: 61, score_delta: -5, stufe: 'schwach',
      puenktlichkeit_pct: 58, lieferzeit_avg_min: 38, bewertung_avg: 3.9,
      stopps_erledigt: 1, stopps_gesamt: 4, aktive_tour_id: 't3',
      tour_stopps: [
        { nr: 1, adresse_kurz: 'Kapuzinergraben 2',   status: 'geliefert', lieferzeit_min: 42 },
        { nr: 2, adresse_kurz: 'Elisengarten 3',       status: 'aktiv',     lieferzeit_min: null },
        { nr: 3, adresse_kurz: 'Dom-Nähe 1',           status: 'ausstehend',lieferzeit_min: null },
        { nr: 4, adresse_kurz: 'Katschhof 5',          status: 'ausstehend',lieferzeit_min: null },
      ],
    },
  ],
};

const STUFE_STYLE: Record<ScoreStufe, { ring: string; bg: string; text: string }> = {
  top:    { ring: 'border-green-400',  bg: 'bg-green-50',  text: 'text-green-700'  },
  gut:    { ring: 'border-yellow-400', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  schwach:{ ring: 'border-red-400',    bg: 'bg-red-50',    text: 'text-red-600'    },
};

const STOPP_COLOR: Record<StoppStatus, string> = {
  geliefert:   'bg-green-500',
  aktiv:       'bg-indigo-500 animate-pulse',
  ausstehend:  'bg-gray-300',
};

interface Props { locationId: string | null; }

export function DispatchPhase4351ScoreTourVisualisierungV3({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>('f1');

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-score-tour?location_id=${locationId}`);
      if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 20_000); return () => clearInterval(id); }, [load]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
      <div className="bg-amber-600 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-200" />
          <span className="text-sm font-bold text-white">Score + Tour-Visualisierung V3</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-center">
            <p className="text-[8px] text-amber-300">Flotte Ø</p>
            <p className="text-sm font-black text-white">{data.flotten_avg_score}</p>
          </div>
          {data.alert_count > 0 && (
            <span className="flex items-center gap-1 bg-red-500/20 border border-red-400/40 rounded-full px-2 py-0.5 text-[10px] text-red-200 font-semibold">
              <AlertTriangle className="w-2.5 h-2.5" />{data.alert_count}
            </span>
          )}
        </div>
      </div>

      <div className="divide-y divide-gray-100">
        {data.fahrer.map((f) => {
          const ss = STUFE_STYLE[f.stufe];
          const isOpen = expanded === f.fahrer_id;
          const progress = f.stopps_gesamt > 0 ? (f.stopps_erledigt / f.stopps_gesamt) * 100 : 0;
          const DeltaIcon = f.score_delta > 0 ? TrendingUp : f.score_delta < 0 ? TrendingDown : Minus;
          const deltaColor = f.score_delta > 0 ? 'text-green-500' : f.score_delta < 0 ? 'text-red-500' : 'text-gray-400';

          return (
            <div key={f.fahrer_id}>
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left"
                onClick={() => setExpanded(isOpen ? null : f.fahrer_id)}
              >
                {/* Score Ring */}
                <div className={`w-11 h-11 rounded-full flex items-center justify-center border-2 flex-shrink-0 ${ss.ring} ${ss.bg}`}>
                  <span className={`text-sm font-black ${ss.text}`}>{f.score}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-gray-800">{f.fahrer_name}</span>
                    <DeltaIcon className={`w-3 h-3 ${deltaColor}`} />
                    {f.score_delta !== 0 && (
                      <span className={`text-[9px] font-semibold ${deltaColor}`}>
                        {f.score_delta > 0 ? '+' : ''}{f.score_delta}
                      </span>
                    )}
                    {f.score < 70 && <AlertTriangle className="w-3 h-3 text-red-500" />}
                  </div>
                  {/* Tour-Progress Sequenz */}
                  <div className="flex items-center gap-0.5 mt-1">
                    {f.tour_stopps.map((s) => (
                      <span key={s.nr} className={`w-3 h-3 rounded-sm flex-shrink-0 ${STOPP_COLOR[s.status]}`} title={s.adresse_kurz} />
                    ))}
                    <span className="text-[9px] text-gray-400 ml-1">{f.stopps_erledigt}/{f.stopps_gesamt}</span>
                  </div>
                </div>

                <div className="flex-shrink-0 text-right">
                  <div className="flex items-center gap-1 justify-end">
                    <Star className="w-2.5 h-2.5 text-amber-400" />
                    <span className="text-xs font-semibold text-gray-600">{f.bewertung_avg.toFixed(1)}</span>
                  </div>
                  <span className="text-[9px] text-gray-400">{f.puenktlichkeit_pct}% pünktl.</span>
                </div>
              </button>

              {isOpen && (
                <div className="px-4 pb-3 bg-gray-50 border-t border-gray-100 space-y-2">
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <div className="bg-white rounded-lg p-2 border border-gray-100 text-center">
                      <p className="text-[8px] text-gray-400">Pünktlichkeit</p>
                      <p className="text-sm font-bold text-gray-700">{f.puenktlichkeit_pct}%</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-gray-100 text-center">
                      <p className="text-[8px] text-gray-400">Ø Lieferzeit</p>
                      <p className="text-sm font-bold text-gray-700">{f.lieferzeit_avg_min}m</p>
                    </div>
                    <div className="bg-white rounded-lg p-2 border border-gray-100 text-center">
                      <p className="text-[8px] text-gray-400">Bewertung</p>
                      <p className="text-sm font-bold text-gray-700">{f.bewertung_avg.toFixed(1)} ★</p>
                    </div>
                  </div>
                  {/* Stopp-Sequenz Detail */}
                  <div className="space-y-1">
                    {f.tour_stopps.map((s) => (
                      <div key={s.nr} className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${STOPP_COLOR[s.status]}`} />
                        <span className="text-[10px] text-gray-600 flex-1 truncate">#{s.nr} {s.adresse_kurz}</span>
                        {s.lieferzeit_min != null && (
                          <span className="text-[9px] text-green-600 font-medium">{s.lieferzeit_min}m</span>
                        )}
                        {s.status === 'aktiv' && <Zap className="w-2.5 h-2.5 text-indigo-400" />}
                      </div>
                    ))}
                  </div>
                  {/* Progress bar */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${progress}%` }} />
                    </div>
                    <span className="text-[9px] text-gray-400">{Math.round(progress)}%</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 text-[9px] text-gray-400 flex justify-between border-t border-gray-100">
        <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />20s Live</span>
        <span>Tippen = Tour-Details · ■=Stop-Sequenz</span>
      </div>
    </div>
  );
}
