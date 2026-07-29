'use client';

import { useEffect, useState } from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus, AlertTriangle, MapPin, Clock, Navigation2, CheckCircle2, XCircle, Gauge, Target, Zap } from 'lucide-react';

interface TourStop {
  stopp_nr: number;
  adresse: string;
  status: 'geliefert' | 'aktiv' | 'ausstehend' | 'verspaetet' | 'batch';
  eta_min: number | null;
  km: number;
  verspaetet_min: number | null;
}

interface FahrerScore {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_ring: 'platin' | 'gold' | 'gut' | 'schwach';
  trend: number;
  stopps_offen: number;
  stopps_gesamt: number;
  eta_naechster_min: number | null;
  km_heute: number;
  avg_lieferzeit_min: number;
  puenktlichkeit_pct: number;
  eta_accuracy_pct: number;
  tour_stops: TourStop[];
  stopps_fertig?: number;
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
  eta_accuracy_pct: number;
  alerts: string[];
}

const MOCK: ApiResponse = {
  team_score: 86,
  score_delta: +4,
  score_ziel: 85,
  alert_unter_ziel: false,
  puenktlichkeit_pct: 83,
  avg_lieferzeit_min: 27,
  eta_accuracy_pct: 79,
  alerts: [],
  fahrer: [
    {
      fahrer_id: 'f1', fahrer_name: 'M. Schulz', score: 96, score_ring: 'platin',
      trend: 3, stopps_offen: 2, stopps_gesamt: 9, eta_naechster_min: 4, km_heute: 38.2,
      avg_lieferzeit_min: 24, puenktlichkeit_pct: 95, eta_accuracy_pct: 88,
      tour_stops: [
        { stopp_nr: 1, adresse: 'Hauptstr. 12', status: 'geliefert', eta_min: null, km: 1.2, verspaetet_min: null },
        { stopp_nr: 2, adresse: 'Marktplatz 5', status: 'aktiv', eta_min: 4, km: 2.1, verspaetet_min: null },
        { stopp_nr: 3, adresse: 'Bergweg 8', status: 'ausstehend', eta_min: 14, km: 3.5, verspaetet_min: null },
      ],
    },
    {
      fahrer_id: 'f2', fahrer_name: 'A. Klein', score: 79, score_ring: 'gut',
      trend: -1, stopps_offen: 3, stopps_gesamt: 8, eta_naechster_min: 7, km_heute: 29.6,
      avg_lieferzeit_min: 29, puenktlichkeit_pct: 81, eta_accuracy_pct: 74,
      tour_stops: [
        { stopp_nr: 1, adresse: 'Seestr. 3', status: 'geliefert', eta_min: null, km: 0.9, verspaetet_min: null },
        { stopp_nr: 2, adresse: 'Am Ring 17', status: 'verspaetet', eta_min: 7, km: 1.8, verspaetet_min: 5 },
        { stopp_nr: 3, adresse: 'Parkweg 22', status: 'ausstehend', eta_min: 19, km: 4.2, verspaetet_min: null },
      ],
    },
    {
      fahrer_id: 'f3', fahrer_name: 'T. Bauer', score: 61, score_ring: 'schwach',
      trend: -5, stopps_offen: 4, stopps_gesamt: 7, eta_naechster_min: 11, km_heute: 22.1,
      avg_lieferzeit_min: 35, puenktlichkeit_pct: 64, eta_accuracy_pct: 61,
      tour_stops: [
        { stopp_nr: 1, adresse: 'Lindenweg 4', status: 'aktiv', eta_min: 11, km: 2.3, verspaetet_min: null },
        { stopp_nr: 2, adresse: 'Schulstr. 9', status: 'batch', eta_min: 24, km: 3.1, verspaetet_min: null },
        { stopp_nr: 3, adresse: 'Feldweg 2', status: 'ausstehend', eta_min: 38, km: 5.4, verspaetet_min: null },
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

function stoppIcon(s: TourStop['status']) {
  if (s === 'geliefert') return <CheckCircle2 className="w-3 h-3 text-green-400" />;
  if (s === 'verspaetet') return <XCircle className="w-3 h-3 text-red-400" />;
  if (s === 'aktiv') return <Navigation2 className="w-3 h-3 text-blue-400 animate-pulse" />;
  if (s === 'batch') return <Zap className="w-3 h-3 text-purple-400" />;
  return <MapPin className="w-3 h-3 text-gray-500" />;
}

function stoppBg(s: TourStop['status']) {
  if (s === 'geliefert') return 'bg-green-900/20 border-green-800/40';
  if (s === 'verspaetet') return 'bg-red-900/20 border-red-700/40';
  if (s === 'aktiv') return 'bg-blue-900/30 border-blue-600/50 ring-1 ring-blue-600/30';
  if (s === 'batch') return 'bg-purple-900/20 border-purple-700/40';
  return 'bg-slate-800/30 border-slate-700/40';
}

export function DispatchPhase4852ScoreTourVisualisierungV6({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['f1']));

  useEffect(() => {
    if (!locationId) return;
    const load = async () => {
      try {
        const r = await fetch(`/api/delivery/dispatch/score-tour?location_id=${locationId}`);
        if (r.ok) { const j = await r.json(); if (!j.error) setData(j); }
      } catch { /* mock */ }
    };
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [locationId]);

  const scoreColor = data.team_score >= 85 ? 'text-green-400' : data.team_score >= 70 ? 'text-yellow-400' : 'text-red-400';
  const arcPct = Math.min(100, data.team_score);
  const zielPct = Math.min(100, data.score_ziel);

  const toggle = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 bg-indigo-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            <span className="text-sm font-semibold text-indigo-300">Score + Tour-Visualisierung V6</span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-400">Ziel {data.score_ziel}</span>
          </div>
        </div>

        {/* Score Arc */}
        <div className="mt-3 flex items-center gap-4">
          <div className="relative w-16 h-16 shrink-0">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64">
              <circle cx="32" cy="32" r="26" fill="none" stroke="#1e293b" strokeWidth="8" />
              <circle cx="32" cy="32" r="26" fill="none" stroke={data.team_score >= 85 ? '#22c55e' : data.team_score >= 70 ? '#eab308' : '#ef4444'} strokeWidth="8"
                strokeDasharray={`${arcPct * 1.634} 163.4`} strokeLinecap="round" />
              {/* Ziel marker */}
              <circle cx="32" cy="32" r="26" fill="none" stroke="#6366f1" strokeWidth="3"
                strokeDasharray={`1 ${162 - zielPct * 1.634}`} strokeDashoffset={-(zielPct * 1.634)} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className={`text-lg font-extrabold ${scoreColor}`}>{data.team_score}</span>
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-2xl font-extrabold ${scoreColor}`}>{data.team_score}</span>
              <span className={`text-sm font-semibold ${data.score_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {data.score_delta >= 0 ? '+' : ''}{data.score_delta}
              </span>
              {!data.alert_unter_ziel && <span className="text-xs text-green-400 bg-green-950/40 px-1.5 py-0.5 rounded-full">Ziel erreicht</span>}
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {[
                { label: 'Pünktl.', val: `${data.puenktlichkeit_pct}%`, color: data.puenktlichkeit_pct >= 80 ? 'text-green-400' : 'text-yellow-400' },
                { label: 'Ø Zeit', val: `${data.avg_lieferzeit_min} Min`, color: data.avg_lieferzeit_min <= 30 ? 'text-green-400' : 'text-orange-400' },
                { label: 'ETA-Acc.', val: `${data.eta_accuracy_pct}%`, color: data.eta_accuracy_pct >= 75 ? 'text-blue-400' : 'text-yellow-400' },
              ].map(k => (
                <div key={k.label} className="bg-slate-800/50 rounded-lg px-2 py-1 text-center">
                  <div className={`text-sm font-bold ${k.color}`}>{k.val}</div>
                  <div className="text-[10px] text-slate-500">{k.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {data.alerts.map((a, i) => (
        <div key={i} className="px-4 py-2 bg-red-950/30 border-b border-red-800/30 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-300">{a}</span>
        </div>
      ))}

      {/* Driver List */}
      <div className="divide-y divide-slate-800/60">
        {data.fahrer.map(f => {
          const isOpen = expanded.has(f.fahrer_id);
          return (
            <div key={f.fahrer_id}>
              <button
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-800/30 transition-colors text-left"
                onClick={() => toggle(f.fahrer_id)}
              >
                {/* Score Ring */}
                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-sm font-bold shrink-0 ${ringColor(f.score_ring)}`}>
                  {f.score}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">{f.fahrer_name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-700/60 text-slate-300 capitalize">{f.score_ring}</span>
                    {f.trend !== 0 && (
                      f.trend > 0
                        ? <TrendingUp className="w-3 h-3 text-green-400" />
                        : <TrendingDown className="w-3 h-3 text-red-400" />
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-[10px] text-slate-500">
                    <span>{f.stopps_fertig ?? (f.stopps_gesamt - f.stopps_offen)}/{f.stopps_gesamt} Stopps</span>
                    {f.eta_naechster_min && <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{f.eta_naechster_min} Min</span>}
                    <span>{f.km_heute.toFixed(1)} km</span>
                    <span className={f.eta_accuracy_pct >= 75 ? 'text-blue-400' : 'text-yellow-500'}>ETA {f.eta_accuracy_pct}%</span>
                  </div>
                  {/* Score bar */}
                  <div className="mt-1.5 h-1 rounded-full bg-slate-700/60 overflow-hidden">
                    <div className={`h-full rounded-full ${ringBg(f.score_ring)}`} style={{ width: `${f.score}%` }} />
                  </div>
                </div>
                <span className="text-slate-500 text-xs">{isOpen ? '▲' : '▼'}</span>
              </button>

              {/* Expanded Stop Timeline */}
              {isOpen && (
                <div className="px-4 pb-3 space-y-1.5">
                  {f.tour_stops.map(st => (
                    <div key={st.stopp_nr} className={`flex items-start gap-2 px-2 py-1.5 rounded-lg border ${stoppBg(st.status)}`}>
                      <div className="mt-0.5">{stoppIcon(st.status)}</div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs text-slate-200 truncate block">{st.stopp_nr}. {st.adresse}</span>
                        <div className="flex items-center gap-2 mt-0.5">
                          {st.verspaetet_min && (
                            <span className="text-[10px] text-red-400">+{st.verspaetet_min} Min verspätet</span>
                          )}
                          <span className="text-[10px] text-slate-500">{st.km.toFixed(1)} km</span>
                        </div>
                      </div>
                      {st.eta_min !== null && (
                        <span className="text-xs text-slate-400 shrink-0">{st.eta_min} Min</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-slate-700 flex items-center justify-between bg-slate-800/20">
        <div className="flex items-center gap-1.5">
          <Gauge className="w-3 h-3 text-slate-500" />
          <span className="text-[10px] text-slate-500">20-Sek-Polling</span>
        </div>
        <span className="text-[10px] text-slate-500">{locationId ?? 'Demo'}</span>
      </div>
    </div>
  );
}
