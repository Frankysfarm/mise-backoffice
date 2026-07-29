'use client';

import { useEffect, useState } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, AlertTriangle, MapPin, Clock, Star, Navigation2, CheckCircle2, XCircle } from 'lucide-react';

interface TourStop {
  stopp_nr: number;
  adresse: string;
  status: 'geliefert' | 'aktiv' | 'ausstehend' | 'verspaetet';
  eta_min: number | null;
  km: number;
}

interface FahrerScore {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_ring: 'platin' | 'gold' | 'gut' | 'schwach';
  score_balken_pct: number;
  trend: number;
  stopps_offen: number;
  stopps_gesamt: number;
  eta_naechster_min: number | null;
  km_heute: number;
  tour_stops: TourStop[];
  aufgeklappt?: boolean;
}

interface ApiResponse {
  team_score: number;
  score_delta: number;
  score_ziel: number;
  alert_unter_ziel: boolean;
  fahrer: FahrerScore[];
  puenktlichkeit_pct: number;
  avg_lieferzeit_min: number;
  alerts: string[];
}

const MOCK: ApiResponse = {
  team_score: 83,
  score_delta: +2,
  score_ziel: 85,
  alert_unter_ziel: true,
  puenktlichkeit_pct: 81,
  avg_lieferzeit_min: 28,
  alerts: ['Team-Score unter Ziel — 2 Punkte fehlen'],
  fahrer: [
    {
      fahrer_id: 'f1', fahrer_name: 'M. Schulz', score: 94, score_ring: 'platin',
      score_balken_pct: 94, trend: 3, stopps_offen: 2, stopps_gesamt: 9, eta_naechster_min: 4, km_heute: 38.2,
      tour_stops: [
        { stopp_nr: 1, adresse: 'Hauptstr. 12', status: 'geliefert', eta_min: null, km: 1.2 },
        { stopp_nr: 2, adresse: 'Marktplatz 5', status: 'aktiv', eta_min: 4, km: 2.1 },
        { stopp_nr: 3, adresse: 'Bergweg 8', status: 'ausstehend', eta_min: 14, km: 3.5 },
      ],
    },
    {
      fahrer_id: 'f2', fahrer_name: 'A. Klein', score: 78, score_ring: 'gut',
      score_balken_pct: 78, trend: -1, stopps_offen: 3, stopps_gesamt: 8, eta_naechster_min: 7, km_heute: 29.6,
      tour_stops: [
        { stopp_nr: 1, adresse: 'Seestr. 3', status: 'geliefert', eta_min: null, km: 0.9 },
        { stopp_nr: 2, adresse: 'Am Ring 17', status: 'verspaetet', eta_min: 7, km: 1.8 },
        { stopp_nr: 3, adresse: 'Parkweg 22', status: 'ausstehend', eta_min: 19, km: 4.2 },
      ],
    },
    {
      fahrer_id: 'f3', fahrer_name: 'T. Bauer', score: 62, score_ring: 'schwach',
      score_balken_pct: 62, trend: -4, stopps_offen: 4, stopps_gesamt: 7, eta_naechster_min: 11, km_heute: 22.1,
      tour_stops: [
        { stopp_nr: 1, adresse: 'Lindenweg 4', status: 'aktiv', eta_min: 11, km: 2.3 },
        { stopp_nr: 2, adresse: 'Schulstr. 9', status: 'ausstehend', eta_min: 22, km: 3.1 },
      ],
    },
  ],
};

function ringColor(r: string) {
  if (r === 'platin') return 'text-blue-300 border-blue-400';
  if (r === 'gold') return 'text-yellow-300 border-yellow-400';
  if (r === 'gut') return 'text-green-300 border-green-500';
  return 'text-red-300 border-red-500';
}

function ringBg(r: string) {
  if (r === 'platin') return 'bg-blue-500';
  if (r === 'gold') return 'bg-yellow-500';
  if (r === 'gut') return 'bg-green-500';
  return 'bg-red-500';
}

function stoppIcon(status: TourStop['status']) {
  if (status === 'geliefert') return <CheckCircle2 className="w-3 h-3 text-green-400" />;
  if (status === 'verspaetet') return <XCircle className="w-3 h-3 text-red-400" />;
  if (status === 'aktiv') return <Navigation2 className="w-3 h-3 text-blue-400 animate-pulse" />;
  return <MapPin className="w-3 h-3 text-gray-500" />;
}

export function DispatchPhase4847TourScoreLiveBoardV5({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  async function load() {
    const url = locationId
      ? `/api/delivery/dispatch/tour-score-live?location_id=${locationId}`
      : '/api/delivery/dispatch/tour-score-live';
    try {
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
      else setData(MOCK);
    } catch {
      setData(MOCK);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!data) return null;

  const teamScoreColor = data.team_score >= 85 ? 'text-green-400' : data.team_score >= 70 ? 'text-yellow-400' : 'text-red-400';
  const zielPct = Math.min(100, (data.team_score / data.score_ziel) * 100);

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-indigo-800 bg-indigo-950/30 p-4 mb-3">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-indigo-400" />
        <span className="text-sm font-semibold text-indigo-300">Tour-Score Live Board V5</span>
        <span className="ml-auto text-xs text-gray-500">20-Sek</span>
      </div>

      {/* Alerts */}
      {data.alerts.map((a, i) => (
        <div key={i} className="flex items-center gap-2 text-xs text-yellow-300 bg-yellow-900/20 rounded px-3 py-1.5 mb-2">
          <AlertTriangle className="w-3 h-3 shrink-0" />{a}
        </div>
      ))}

      {/* Team Score Arc */}
      <div className="flex items-center gap-4 bg-black/20 rounded p-3 mb-3">
        <div className="text-center">
          <div className="text-xs text-gray-400">Team-Score</div>
          <div className={`text-3xl font-bold ${teamScoreColor}`}>{data.team_score}</div>
          <div className="flex items-center justify-center gap-1 text-xs mt-0.5">
            {data.score_delta >= 0
              ? <><TrendingUp className="w-3 h-3 text-green-400" /><span className="text-green-400">+{data.score_delta}</span></>
              : <><TrendingDown className="w-3 h-3 text-red-400" /><span className="text-red-400">{data.score_delta}</span></>}
          </div>
        </div>
        <div className="flex-1">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-400">Ziel {data.score_ziel}</span>
            <span className={teamScoreColor}>{zielPct.toFixed(0)}%</span>
          </div>
          <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${data.team_score >= 85 ? 'bg-green-500' : data.team_score >= 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: `${zielPct}%` }}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="text-center">
              <div className="text-xs text-gray-400">Pünktl.</div>
              <div className={`text-sm font-semibold ${data.puenktlichkeit_pct >= 80 ? 'text-green-400' : 'text-yellow-400'}`}>{data.puenktlichkeit_pct}%</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-gray-400">Ø Zeit</div>
              <div className="text-sm font-semibold text-slate-300">{data.avg_lieferzeit_min}min</div>
            </div>
          </div>
        </div>
      </div>

      {/* Fahrer Scores */}
      <div className="space-y-2">
        {data.fahrer.map(f => {
          const isOpen = expanded.has(f.fahrer_id);
          return (
            <div key={f.fahrer_id} className="rounded-lg border border-slate-700 bg-black/20 overflow-hidden">
              <button
                className="w-full flex items-center gap-2 p-2.5 text-left"
                onClick={() => toggleExpand(f.fahrer_id)}
              >
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 ${ringColor(f.score_ring)}`}>
                  {f.score}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-200 truncate">{f.fahrer_name}</span>
                    <span className={`text-xs px-1 rounded ${f.score_ring === 'platin' ? 'bg-blue-900/60 text-blue-300' : f.score_ring === 'gold' ? 'bg-yellow-900/60 text-yellow-300' : f.score_ring === 'gut' ? 'bg-green-900/60 text-green-300' : 'bg-red-900/60 text-red-300'}`}>
                      {f.score_ring}
                    </span>
                  </div>
                  <div className="h-1 bg-gray-800 rounded-full overflow-hidden mt-1">
                    <div className={`h-full rounded-full ${ringBg(f.score_ring)}`} style={{ width: `${f.score_balken_pct}%` }} />
                  </div>
                </div>
                <div className="text-right text-xs shrink-0">
                  <div className="text-gray-400">{f.stopps_offen}/{f.stopps_gesamt} Stopps</div>
                  {f.eta_naechster_min !== null && (
                    <div className="flex items-center gap-0.5 text-blue-300 justify-end mt-0.5">
                      <Clock className="w-2.5 h-2.5" />{f.eta_naechster_min}min
                    </div>
                  )}
                </div>
                <div className="ml-1">
                  {f.trend > 0
                    ? <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                    : f.trend < 0
                      ? <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                      : <Minus className="w-3.5 h-3.5 text-gray-500" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-slate-700 px-3 py-2">
                  <div className="text-xs text-gray-500 mb-2">{f.km_heute.toFixed(1)} km heute</div>
                  <div className="space-y-1.5">
                    {f.tour_stops.map(s => (
                      <div key={s.stopp_nr} className="flex items-center gap-2 text-xs">
                        <span className="w-4 text-gray-500">{s.stopp_nr}.</span>
                        {stoppIcon(s.status)}
                        <span className={`flex-1 truncate ${s.status === 'geliefert' ? 'text-gray-500 line-through' : s.status === 'verspaetet' ? 'text-red-400' : s.status === 'aktiv' ? 'text-blue-300' : 'text-slate-400'}`}>
                          {s.adresse}
                        </span>
                        <span className="text-gray-500">{s.km}km</span>
                        {s.eta_min !== null && (
                          <span className={`${s.status === 'verspaetet' ? 'text-red-400' : 'text-gray-400'}`}>~{s.eta_min}min</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
