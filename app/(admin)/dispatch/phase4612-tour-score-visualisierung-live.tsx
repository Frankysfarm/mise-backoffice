'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, Target, TrendingUp, TrendingDown, Minus, Route, Clock, AlertTriangle, Zap, MapPin } from 'lucide-react';

interface TourStop {
  stopp_nr: number;
  adresse: string;
  status: 'ausstehend' | 'unterwegs' | 'geliefert' | 'problem';
  eta_min: number | null;
}

interface FahrerTour {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  touren_heute: number;
  avg_lieferzeit_min: number;
  puenktlichkeit_pct: number;
  aktive_stops: number;
  trend: 'up' | 'down' | 'neutral';
  ampel: 'gruen' | 'gelb' | 'rot';
  aktuelle_tour_stops: TourStop[];
}

interface ApiData {
  fahrer: FahrerTour[];
  team_score: number;
  team_score_delta: number;
  top_insight: string;
  gesamt_touren: number;
  avg_lieferzeit: number;
  sla_rate: number;
  alert_count: number;
}

const MOCK: ApiData = {
  team_score: 81,
  team_score_delta: +3,
  top_insight: 'Team-Score gestiegen — Ø-Lieferzeit um 6% verbessert.',
  gesamt_touren: 28,
  avg_lieferzeit: 24,
  sla_rate: 91,
  alert_count: 1,
  fahrer: [
    {
      fahrer_id: 'f1', fahrer_name: 'Thomas K.', score: 95, touren_heute: 7, avg_lieferzeit_min: 21, puenktlichkeit_pct: 96, aktive_stops: 3, trend: 'up', ampel: 'gruen',
      aktuelle_tour_stops: [
        { stopp_nr: 1, adresse: 'Habsburgerallee 12', status: 'geliefert', eta_min: null },
        { stopp_nr: 2, adresse: 'Pontstr. 47',         status: 'unterwegs',  eta_min: 5   },
        { stopp_nr: 3, adresse: 'Jülicher Str. 3',     status: 'ausstehend', eta_min: 14  },
      ],
    },
    {
      fahrer_id: 'f2', fahrer_name: 'Sarah M.', score: 87, touren_heute: 6, avg_lieferzeit_min: 23, puenktlichkeit_pct: 89, aktive_stops: 2, trend: 'neutral', ampel: 'gruen',
      aktuelle_tour_stops: [
        { stopp_nr: 1, adresse: 'Boxgraben 52',       status: 'unterwegs',  eta_min: 7  },
        { stopp_nr: 2, adresse: 'Heinrichsallee 88',  status: 'ausstehend', eta_min: 18 },
      ],
    },
    {
      fahrer_id: 'f3', fahrer_name: 'Ali B.', score: 68, touren_heute: 5, avg_lieferzeit_min: 31, puenktlichkeit_pct: 74, aktive_stops: 3, trend: 'down', ampel: 'rot',
      aktuelle_tour_stops: [
        { stopp_nr: 1, adresse: 'Kühlwetterstr. 6',  status: 'problem',    eta_min: null },
        { stopp_nr: 2, adresse: 'Oppenhoffallee 14',  status: 'ausstehend', eta_min: 22  },
        { stopp_nr: 3, adresse: 'Goethestr. 30',      status: 'ausstehend', eta_min: 34  },
      ],
    },
  ],
};

const AMPEL_DOT: Record<string, string> = { gruen: 'bg-emerald-500', gelb: 'bg-yellow-400', rot: 'bg-red-500' };
const AMPEL_SCORE: Record<string, string> = { gruen: 'text-emerald-600 dark:text-emerald-400', gelb: 'text-yellow-600 dark:text-yellow-400', rot: 'text-red-600 dark:text-red-400' };
const STOP_STATUS: Record<TourStop['status'], { dot: string; label: string }> = {
  ausstehend: { dot: 'bg-gray-300 dark:bg-gray-600', label: '' },
  unterwegs:  { dot: 'bg-blue-500 animate-pulse',    label: '' },
  geliefert:  { dot: 'bg-emerald-500',               label: '' },
  problem:    { dot: 'bg-red-500 animate-pulse',     label: '' },
};

function TrendIcon({ trend }: { trend: 'up' | 'down' | 'neutral' }) {
  if (trend === 'up')      return <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />;
  if (trend === 'down')    return <TrendingDown className="h-3.5 w-3.5 text-red-500" />;
  return <Minus className="h-3.5 w-3.5 text-gray-400" />;
}

interface Props { locationId: string | null }

export function DispatchPhase4612TourScoreVisualisierungLive({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [expandedDriver, setExpandedDriver] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-routen-score?location_id=${locationId}`);
      if (res.ok) {
        const j = await res.json();
        if (j.fahrer?.length) setData(j);
      }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, [load]);

  const scoreColor = data.team_score >= 80 ? 'text-emerald-600 dark:text-emerald-400' : data.team_score >= 65 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';
  const scoreBar   = data.team_score >= 80 ? 'bg-emerald-500' : data.team_score >= 65 ? 'bg-yellow-400' : 'bg-red-500';

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-indigo-500" />
          <span className="font-semibold text-gray-800 dark:text-gray-100 text-sm">Tour-Score & Visualisierung</span>
          {loading && <span className="text-xs text-gray-400 dark:text-gray-500">…</span>}
        </div>
        {data.alert_count > 0 && (
          <span className="flex items-center gap-1 rounded-full bg-red-100 dark:bg-red-900/40 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-400">
            <AlertTriangle className="h-3 w-3" /> {data.alert_count} Alert
          </span>
        )}
      </div>

      {/* Team Score */}
      <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">TEAM-SCORE</span>
          <span className={`text-2xl font-bold ${scoreColor}`}>
            {data.team_score}
            <span className="text-sm font-normal text-gray-400 ml-1">/100</span>
          </span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div className={`h-full ${scoreBar} rounded-full transition-all duration-500`} style={{ width: `${data.team_score}%` }} />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-gray-400">{data.team_score_delta > 0 ? `▲ +${data.team_score_delta}` : data.team_score_delta < 0 ? `▼ ${data.team_score_delta}` : '— ±0'} heute</span>
          <span className="text-xs text-gray-400">{data.sla_rate}% SLA · {data.avg_lieferzeit}min Ø</span>
        </div>
        {data.top_insight && (
          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1.5 italic">{data.top_insight}</p>
        )}
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-center">
          <div className="text-lg font-bold text-gray-700 dark:text-gray-200">{data.gesamt_touren}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Touren</div>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-center">
          <div className="text-lg font-bold text-gray-700 dark:text-gray-200">{data.avg_lieferzeit}min</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Ø Lieferzeit</div>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-center">
          <div className={`text-lg font-bold ${data.sla_rate >= 85 ? 'text-emerald-600' : data.sla_rate >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>{data.sla_rate}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">SLA</div>
        </div>
      </div>

      {/* Fahrer-Scores */}
      <div className="space-y-2">
        {data.fahrer.map((f) => (
          <div key={f.fahrer_id} className="rounded-lg border border-gray-100 dark:border-gray-800 overflow-hidden">
            <button
              onClick={() => setExpandedDriver(expandedDriver === f.fahrer_id ? null : f.fahrer_id)}
              className="w-full flex items-center gap-2 p-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
            >
              <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${AMPEL_DOT[f.ampel]}`} />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200 flex-1">{f.fahrer_name}</span>
              <TrendIcon trend={f.trend} />
              <span className={`font-bold text-sm ${AMPEL_SCORE[f.ampel]}`}>{f.score}</span>
              <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden ml-1">
                <div className={`h-full ${AMPEL_DOT[f.ampel]} rounded-full`} style={{ width: `${f.score}%` }} />
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-400 ml-1">
                <MapPin className="h-3 w-3" />
                {f.aktive_stops}
              </div>
            </button>

            {/* Aufgeklappte Tour-Stops */}
            {expandedDriver === f.fahrer_id && (
              <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2 bg-gray-50/50 dark:bg-gray-800/30 space-y-1.5">
                <div className="flex gap-3 text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span><Clock className="h-3 w-3 inline mr-0.5" />{f.avg_lieferzeit_min}min Ø</span>
                  <span><Target className="h-3 w-3 inline mr-0.5" />{f.puenktlichkeit_pct}% pünktlich</span>
                  <span><Route className="h-3 w-3 inline mr-0.5" />{f.touren_heute} Touren</span>
                </div>
                {/* Tour-Zeitlinie */}
                <div className="flex items-center gap-1 py-1">
                  {f.aktuelle_tour_stops.map((s, i) => (
                    <div key={s.stopp_nr} className="flex items-center gap-1">
                      <div className="flex flex-col items-center">
                        <span className={`h-3 w-3 rounded-full border-2 border-white dark:border-gray-900 ${STOP_STATUS[s.status].dot}`} title={`Stopp ${s.stopp_nr}: ${s.adresse}`} />
                        <span className="text-[9px] text-gray-400 mt-0.5">{s.stopp_nr}</span>
                      </div>
                      {i < f.aktuelle_tour_stops.length - 1 && (
                        <div className={`h-0.5 w-6 rounded ${s.status === 'geliefert' ? 'bg-emerald-400' : 'bg-gray-200 dark:bg-gray-700'}`} />
                      )}
                    </div>
                  ))}
                  <span className="h-3 w-3 rounded-full bg-gray-700 dark:bg-gray-300 ml-1" title="Depot" />
                </div>
                {f.aktuelle_tour_stops.map((s) => (
                  s.status !== 'geliefert' && (
                    <div key={s.stopp_nr} className="flex items-center gap-2 text-xs">
                      <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${STOP_STATUS[s.status].dot}`} />
                      <span className="text-gray-600 dark:text-gray-300 truncate flex-1">{s.adresse}</span>
                      {s.eta_min !== null && (
                        <span className={`font-mono text-xs ${s.status === 'problem' ? 'text-red-500' : 'text-gray-500 dark:text-gray-400'}`}>
                          {s.status === 'problem' ? '⚠ Problem' : `~${s.eta_min}min`}
                        </span>
                      )}
                    </div>
                  )
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
