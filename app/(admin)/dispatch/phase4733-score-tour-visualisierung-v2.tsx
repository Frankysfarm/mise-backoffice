'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Trophy, MapPin, AlertTriangle, Zap, CheckCircle2, Clock, Navigation2 } from 'lucide-react';

interface StoppRow {
  stopp_nr: number;
  adresse: string;
  status: 'geliefert' | 'aktiv' | 'ausstehend' | 'verspätet';
  eta_min: number | null;
}

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_trend: number;
  tour_score: number;
  stopps: StoppRow[];
  aktiv_stopp: number;
  gesamt_stopps: number;
  lieferzeit_avg: number;
  puenktlichkeit_pct: number;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_score: number;
  team_tour_score: number;
  alerts: string[];
  kpi: { label: string; value: string; color: string }[];
}

const MOCK: ApiResponse = {
  team_score: 79,
  team_tour_score: 74,
  alerts: [],
  kpi: [
    { label: 'Team-Score', value: '79', color: 'text-indigo-300' },
    { label: 'Tour-Score', value: '74', color: 'text-violet-300' },
    { label: 'Live-Fahrer', value: '3', color: 'text-emerald-400' },
    { label: 'Verspätungen', value: '1', color: 'text-amber-400' },
  ],
  fahrer: [
    {
      fahrer_id: 'f1', fahrer_name: 'Kai B.', score: 91, score_trend: 4, tour_score: 88,
      stopps: [
        { stopp_nr: 1, adresse: 'Hauptstr. 12', status: 'geliefert', eta_min: null },
        { stopp_nr: 2, adresse: 'Goethestr. 5', status: 'aktiv', eta_min: 4 },
        { stopp_nr: 3, adresse: 'Marktplatz 3', status: 'ausstehend', eta_min: 12 },
      ],
      aktiv_stopp: 2, gesamt_stopps: 3, lieferzeit_avg: 28, puenktlichkeit_pct: 94,
    },
    {
      fahrer_id: 'f2', fahrer_name: 'Mia S.', score: 83, score_trend: -1, tour_score: 79,
      stopps: [
        { stopp_nr: 1, adresse: 'Bergstr. 8', status: 'geliefert', eta_min: null },
        { stopp_nr: 2, adresse: 'Lindenallee 22', status: 'geliefert', eta_min: null },
        { stopp_nr: 3, adresse: 'Rosenweg 1', status: 'aktiv', eta_min: 6 },
        { stopp_nr: 4, adresse: 'Waldstr. 15', status: 'ausstehend', eta_min: 16 },
      ],
      aktiv_stopp: 3, gesamt_stopps: 4, lieferzeit_avg: 31, puenktlichkeit_pct: 87,
    },
    {
      fahrer_id: 'f3', fahrer_name: 'Jonas R.', score: 62, score_trend: -6, tour_score: 56,
      stopps: [
        { stopp_nr: 1, adresse: 'Kirchplatz 4', status: 'geliefert', eta_min: null },
        { stopp_nr: 2, adresse: 'Bahnhofstr. 7', status: 'verspätet', eta_min: 2 },
        { stopp_nr: 3, adresse: 'Schillerstr. 9', status: 'ausstehend', eta_min: 18 },
      ],
      aktiv_stopp: 2, gesamt_stopps: 3, lieferzeit_avg: 47, puenktlichkeit_pct: 61,
    },
  ],
};

const STOPP_STYLE = {
  geliefert:   { bg: 'bg-emerald-800', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  aktiv:       { bg: 'bg-blue-800', text: 'text-blue-200', dot: 'bg-blue-400 animate-pulse' },
  ausstehend:  { bg: 'bg-gray-700', text: 'text-gray-300', dot: 'bg-gray-500' },
  verspätet:   { bg: 'bg-red-900', text: 'text-red-300', dot: 'bg-red-400 animate-pulse' },
};

function TrendIcon({ v }: { v: number }) {
  if (v > 0) return <TrendingUp className="w-3 h-3 text-emerald-400" />;
  if (v < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

function ScoreColor(s: number) {
  return s >= 80 ? 'text-emerald-400' : s >= 65 ? 'text-amber-400' : 'text-red-400';
}

export function DispatchPhase4733ScoreTourVisualisierungV2({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    try {
      const r = await fetch(`/api/delivery/admin/dispatch-score-tour-v2?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
      else setData(MOCK);
    } catch { setData(MOCK); }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 20000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return <div className="rounded-2xl bg-gray-900 p-4 text-gray-400 text-sm animate-pulse">Lade Score + Tour-Visualisierung V2…</div>;

  const teamScoreColor = ScoreColor(data.team_score);

  return (
    <div className="rounded-2xl bg-gray-900 text-white p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-400" />
          <span className="font-semibold text-gray-100">Score + Tour-Visualisierung</span>
          <span className="text-[10px] text-gray-500">V2</span>
        </div>
        <div className="text-right">
          <p className={`text-2xl font-black ${teamScoreColor}`}>{data.team_score}</p>
          <p className="text-[10px] text-gray-500">Tour-Ø {data.team_tour_score}</p>
        </div>
      </div>

      {/* Alerts */}
      {data.alerts.map((a, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg bg-red-900/50 border border-red-700 px-3 py-2 text-red-300 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {a}
        </div>
      ))}

      {/* KPI Strip */}
      <div className="grid grid-cols-4 gap-2 text-center text-xs">
        {data.kpi.map(k => (
          <div key={k.label} className="rounded-lg bg-gray-800 p-2">
            <p className="text-gray-500 text-[10px]">{k.label}</p>
            <p className={`font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Fahrer Cards */}
      <div className="space-y-3">
        {data.fahrer.map(f => {
          const isExpanded = expanded === f.fahrer_id;
          const hasVerspaetung = f.stopps.some(s => s.status === 'verspätet');
          return (
            <div
              key={f.fahrer_id}
              className={`rounded-xl p-3 space-y-2 cursor-pointer transition-all ${hasVerspaetung ? 'bg-red-950 border border-red-700' : 'bg-gray-800'}`}
              onClick={() => setExpanded(isExpanded ? null : f.fahrer_id)}
            >
              {/* Row 1: Name + Score */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Navigation2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span className="text-sm font-semibold text-gray-100">{f.fahrer_name}</span>
                  {hasVerspaetung && <AlertTriangle className="w-3 h-3 text-red-400" />}
                  <span className="text-[10px] text-gray-500">{f.aktiv_stopp}/{f.gesamt_stopps} Stopps</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendIcon v={f.score_trend} />
                  <span className={`text-lg font-black ${ScoreColor(f.score)}`}>{f.score}</span>
                </div>
              </div>

              {/* Score Bar */}
              <div className="flex items-center gap-2">
                <div className="h-2 rounded-full bg-gray-700 flex-1">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${f.score >= 80 ? 'bg-emerald-500' : f.score >= 65 ? 'bg-amber-400' : 'bg-red-500'}`}
                    style={{ width: `${f.score}%` }}
                  />
                </div>
                <span className="text-[10px] text-gray-500 shrink-0">Tour {f.tour_score}</span>
              </div>

              {/* KPI mini row */}
              <div className="flex gap-3 text-[10px] text-gray-400">
                <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" />Ø {f.lieferzeit_avg} min</span>
                <span className={`${f.puenktlichkeit_pct >= 85 ? 'text-emerald-400' : f.puenktlichkeit_pct >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                  {f.puenktlichkeit_pct}% pünktlich
                </span>
              </div>

              {/* Stopp Timeline (Expanded) */}
              {isExpanded && (
                <div className="mt-3 space-y-1.5 border-t border-gray-700 pt-3">
                  {f.stopps.map(s => {
                    const sStyle = STOPP_STYLE[s.status];
                    return (
                      <div key={s.stopp_nr} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 ${sStyle.bg}`}>
                        <div className={`w-2 h-2 rounded-full shrink-0 ${sStyle.dot}`} />
                        <span className={`text-[10px] font-semibold ${sStyle.text}`}>#{s.stopp_nr}</span>
                        <span className={`text-[10px] flex-1 ${sStyle.text}`}>{s.adresse}</span>
                        {s.eta_min !== null && (
                          <span className={`text-[9px] ${sStyle.text} flex items-center gap-0.5`}>
                            <Clock className="w-2 h-2" />{s.eta_min}′
                          </span>
                        )}
                        {s.status === 'geliefert' && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
                        {s.status === 'aktiv' && <Zap className="w-3 h-3 text-blue-400 shrink-0" />}
                        {s.status === 'verspätet' && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-center text-[10px] text-gray-600">Tippe auf einen Fahrer für die Tour-Timeline</p>
    </div>
  );
}
