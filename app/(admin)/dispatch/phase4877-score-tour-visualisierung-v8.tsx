'use client';

import { useEffect, useState } from 'react';
import { Trophy, TrendingUp, TrendingDown, AlertTriangle, MapPin, Clock, Navigation2, CheckCircle2, XCircle, Target, Zap, Route, Leaf, Star } from 'lucide-react';

interface TourStop {
  stopp_nr: number;
  adresse: string;
  status: 'geliefert' | 'aktiv' | 'ausstehend' | 'verspaetet' | 'batch';
  eta_min: number | null;
  km: number;
  verspaetet_min: number | null;
  kundenwertung: number | null;
}

interface FahrerScore {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_ring: 'platin' | 'gold' | 'gut' | 'schwach';
  trend: number;
  stopps_offen: number;
  stopps_gesamt: number;
  stopps_fertig: number;
  eta_naechster_min: number | null;
  km_heute: number;
  avg_lieferzeit_min: number;
  puenktlichkeit_pct: number;
  eta_accuracy_pct: number;
  route_effizienz_pct: number;
  co2_kg_heute: number;
  wellbeing_score: number;
  tour_stops: TourStop[];
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
  route_effizienz_gesamt_pct: number;
  co2_team_kg: number;
  alerts: string[];
}

const MOCK: ApiResponse = {
  team_score: 90,
  score_delta: +3,
  score_ziel: 85,
  alert_unter_ziel: false,
  puenktlichkeit_pct: 87,
  avg_lieferzeit_min: 25,
  eta_accuracy_pct: 83,
  route_effizienz_gesamt_pct: 80,
  co2_team_kg: 5.8,
  alerts: [],
  fahrer: [
    {
      fahrer_id: 'f1', fahrer_name: 'M. Schulz', score: 98, score_ring: 'platin',
      trend: 3, stopps_offen: 1, stopps_gesamt: 10, stopps_fertig: 9, eta_naechster_min: 2, km_heute: 39.1,
      avg_lieferzeit_min: 22, puenktlichkeit_pct: 97, eta_accuracy_pct: 92, route_effizienz_pct: 90, co2_kg_heute: 2.0, wellbeing_score: 88,
      tour_stops: [
        { stopp_nr: 1, adresse: 'Hauptstr. 12', status: 'geliefert', eta_min: null, km: 1.2, verspaetet_min: null, kundenwertung: 5 },
        { stopp_nr: 2, adresse: 'Marktplatz 5', status: 'aktiv',     eta_min: 2,    km: 2.0, verspaetet_min: null, kundenwertung: null },
      ],
    },
    {
      fahrer_id: 'f2', fahrer_name: 'A. Klein', score: 78, score_ring: 'gut',
      trend: -2, stopps_offen: 4, stopps_gesamt: 9, stopps_fertig: 5, eta_naechster_min: 9, km_heute: 31.4,
      avg_lieferzeit_min: 30, puenktlichkeit_pct: 80, eta_accuracy_pct: 74, route_effizienz_pct: 70, co2_kg_heute: 2.2, wellbeing_score: 62,
      tour_stops: [
        { stopp_nr: 1, adresse: 'Seestr. 3',   status: 'geliefert', eta_min: null, km: 0.9, verspaetet_min: null, kundenwertung: 4 },
        { stopp_nr: 2, adresse: 'Am Ring 17',   status: 'verspaetet', eta_min: 9,   km: 1.9, verspaetet_min: 5,    kundenwertung: null },
        { stopp_nr: 3, adresse: 'Parkweg 22',   status: 'ausstehend', eta_min: 21,  km: 4.1, verspaetet_min: null, kundenwertung: null },
      ],
    },
    {
      fahrer_id: 'f3', fahrer_name: 'T. Bauer', score: 62, score_ring: 'schwach',
      trend: -5, stopps_offen: 5, stopps_gesamt: 8, stopps_fertig: 3, eta_naechster_min: 15, km_heute: 22.0,
      avg_lieferzeit_min: 36, puenktlichkeit_pct: 63, eta_accuracy_pct: 60, route_effizienz_pct: 58, co2_kg_heute: 1.6, wellbeing_score: 44,
      tour_stops: [
        { stopp_nr: 1, adresse: 'Lindenweg 4',  status: 'aktiv',     eta_min: 15,  km: 2.2, verspaetet_min: null, kundenwertung: null },
        { stopp_nr: 2, adresse: 'Schulstr. 9',  status: 'batch',     eta_min: 28,  km: 3.0, verspaetet_min: null, kundenwertung: null },
        { stopp_nr: 3, adresse: 'Feldweg 2',    status: 'ausstehend', eta_min: 44,  km: 5.5, verspaetet_min: null, kundenwertung: null },
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

function wellbeingColor(score: number) {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-yellow-400';
  return 'text-red-400';
}

export function DispatchPhase4877ScoreTourVisualisierungV8({ locationId }: { locationId: string | null }) {
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
            <span className="text-sm font-semibold text-indigo-300">Score + Tour-Visualisierung V8</span>
            <span className="text-[10px] px-1.5 py-0.5 bg-green-900/50 text-green-300 rounded-full flex items-center gap-1">
              <Leaf className="w-2.5 h-2.5" /> Eco + Wellbeing
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs text-slate-400">Ziel {data.score_ziel}</span>
            <span className={`text-xl font-extrabold ${scoreColor}`}>{data.team_score}</span>
            <span className={`text-xs ${data.score_delta >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {data.score_delta >= 0 ? '+' : ''}{data.score_delta}
            </span>
          </div>
        </div>
      </div>

      {/* Alert */}
      {data.alert_unter_ziel && (
        <div className="px-4 py-2 bg-red-950/40 border-b border-red-800/40 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
          <span className="text-xs text-red-300">Team-Score unter Ziel ({data.score_ziel})</span>
        </div>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-5 divide-x divide-slate-700 border-b border-slate-700">
        {[
          { label: 'Pünktl.', val: `${data.puenktlichkeit_pct}%`, color: data.puenktlichkeit_pct >= 85 ? 'text-green-400' : 'text-yellow-400' },
          { label: 'Ø Zeit', val: `${data.avg_lieferzeit_min}m`, color: data.avg_lieferzeit_min <= 30 ? 'text-green-400' : 'text-red-400' },
          { label: 'ETA-Acc.', val: `${data.eta_accuracy_pct}%`, color: 'text-blue-400' },
          { label: 'Route-Eff.', val: `${data.route_effizienz_gesamt_pct}%`, color: 'text-emerald-400' },
          { label: 'CO₂', val: `${data.co2_team_kg}kg`, color: 'text-lime-400' },
        ].map(k => (
          <div key={k.label} className="flex flex-col items-center py-2 gap-0.5">
            <span className={`text-sm font-bold ${k.color}`}>{k.val}</span>
            <span className="text-[10px] text-slate-500">{k.label}</span>
          </div>
        ))}
      </div>

      {/* Driver List */}
      <div className="divide-y divide-slate-800">
        {data.fahrer.map(f => {
          const isExpanded = expanded.has(f.fahrer_id);
          return (
            <div key={f.fahrer_id}>
              <button
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-800/40 transition-colors"
                onClick={() => toggle(f.fahrer_id)}
              >
                {/* Score Circle */}
                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${ringColor(f.score_ring)}`}>
                  <span className={`text-sm font-bold ${ringColor(f.score_ring).split(' ')[0]}`}>{f.score}</span>
                </div>

                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">{f.fahrer_name}</span>
                    {f.trend > 0
                      ? <TrendingUp className="w-3 h-3 text-green-400 shrink-0" />
                      : f.trend < 0
                        ? <TrendingDown className="w-3 h-3 text-red-400 shrink-0" />
                        : null}
                    <span className="text-[10px] text-slate-500 ml-auto">
                      {f.stopps_fertig}/{f.stopps_gesamt} Stopps
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> {f.avg_lieferzeit_min}m
                    </span>
                    <span className="flex items-center gap-1">
                      <Route className="w-2.5 h-2.5" /> {f.km_heute.toFixed(1)}km
                    </span>
                    <span className="flex items-center gap-1">
                      <Leaf className="w-2.5 h-2.5 text-lime-400" /> {f.co2_kg_heute}kg
                    </span>
                    <span className={`flex items-center gap-1 ${wellbeingColor(f.wellbeing_score)}`}>
                      <Star className="w-2.5 h-2.5" /> WB {f.wellbeing_score}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-1.5 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${ringBg(f.score_ring)}`} style={{ width: `${(f.stopps_fertig / f.stopps_gesamt) * 100}%` }} />
                  </div>
                </div>

                {f.eta_naechster_min !== null && (
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-slate-500">Nächster</div>
                    <div className="text-sm font-bold text-blue-300">{f.eta_naechster_min}m</div>
                  </div>
                )}
              </button>

              {isExpanded && f.tour_stops.length > 0 && (
                <div className="px-4 pb-3 space-y-1.5">
                  {f.tour_stops.map(s => (
                    <div key={s.stopp_nr} className={`flex items-center gap-2 rounded-lg px-3 py-1.5 border ${stoppBg(s.status)}`}>
                      <span className="text-[10px] text-slate-500 w-4">{s.stopp_nr}</span>
                      {stoppIcon(s.status)}
                      <span className="text-xs text-slate-300 flex-1 truncate">{s.adresse}</span>
                      {s.kundenwertung !== null && (
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: s.kundenwertung }).map((_, i) => (
                            <Star key={i} className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
                          ))}
                        </div>
                      )}
                      {s.verspaetet_min !== null && (
                        <span className="text-[10px] text-red-400">+{s.verspaetet_min}m</span>
                      )}
                      {s.eta_min !== null && (
                        <span className="text-[10px] text-slate-400">{s.eta_min}m</span>
                      )}
                      <span className="text-[10px] text-slate-500">{s.km.toFixed(1)}km</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-4 py-2 bg-slate-800/20 flex items-center justify-between">
        <span className="text-[10px] text-slate-500 flex items-center gap-1.5">
          <Clock className="w-3 h-3" /> 20-Sek-Polling
        </span>
        <span className="text-[10px] text-slate-500">{locationId ?? 'Demo'}</span>
      </div>
    </div>
  );
}
