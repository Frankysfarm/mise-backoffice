'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trophy, Target, TrendingUp, TrendingDown, Minus, Star, Route, Clock, AlertTriangle, Zap } from 'lucide-react';

interface TourFahrer {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  touren: number;
  avg_lieferzeit_min: number;
  puenktlichkeit_pct: number;
  leerfahrten: number;
  trend: 'up' | 'down' | 'neutral';
  ampel: 'gruen' | 'gelb' | 'rot';
  rank_delta: number;
}

interface TourVisualisierung {
  fahrer: TourFahrer[];
  team_score: number;
  team_score_delta: number;
  top_insight: string;
  alert_count: number;
  gesamt_touren: number;
  avg_lieferzeit: number;
  sla_rate: number;
}

const MOCK: TourVisualisierung = {
  team_score: 78,
  team_score_delta: +4,
  top_insight: 'Team-Score gestiegen — Lieferzeit um 8% verbessert.',
  alert_count: 1,
  gesamt_touren: 34,
  avg_lieferzeit: 26,
  sla_rate: 88,
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Thomas K.', score: 94, touren: 8, avg_lieferzeit_min: 22, puenktlichkeit_pct: 95, leerfahrten: 0, trend: 'up',      ampel: 'gruen', rank_delta: +1 },
    { fahrer_id: 'f2', fahrer_name: 'Sarah M.',  score: 88, touren: 7, avg_lieferzeit_min: 24, puenktlichkeit_pct: 90, leerfahrten: 1, trend: 'neutral',  ampel: 'gruen', rank_delta:  0 },
    { fahrer_id: 'f3', fahrer_name: 'Ali B.',    score: 75, touren: 6, avg_lieferzeit_min: 28, puenktlichkeit_pct: 82, leerfahrten: 2, trend: 'up',      ampel: 'gelb',  rank_delta: +2 },
    { fahrer_id: 'f4', fahrer_name: 'Lars W.',   score: 62, touren: 5, avg_lieferzeit_min: 32, puenktlichkeit_pct: 71, leerfahrten: 3, trend: 'down',    ampel: 'rot',   rank_delta: -2 },
    { fahrer_id: 'f5', fahrer_name: 'Nina P.',   score: 71, touren: 8, avg_lieferzeit_min: 26, puenktlichkeit_pct: 78, leerfahrten: 1, trend: 'neutral', ampel: 'gelb',  rank_delta:  0 },
  ],
};

const AMPEL: Record<string, string> = {
  gruen: 'bg-emerald-500',
  gelb:  'bg-yellow-400',
  rot:   'bg-red-500',
};

const AMPEL_TEXT: Record<string, string> = {
  gruen: 'text-emerald-700 dark:text-emerald-400',
  gelb:  'text-yellow-700 dark:text-yellow-400',
  rot:   'text-red-700 dark:text-red-400',
};

interface Props { locationId: string | null }

export function DispatchPhase4583TourScoreVisualisierungHub({ locationId }: Props) {
  const [data, setData] = useState<TourVisualisierung>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-routen-score?location_id=${locationId}`);
      if (res.ok) {
        const j = await res.json();
        if (!j.error && j.fahrer) setData(j);
      }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const iv = setInterval(load, 60_000); return () => clearInterval(iv); }, [load]);

  const teamScoreColor = data.team_score >= 80 ? 'text-emerald-600' : data.team_score >= 65 ? 'text-yellow-600' : 'text-red-600';
  const teamScoreBar   = data.team_score >= 80 ? 'bg-emerald-500' : data.team_score >= 65 ? 'bg-yellow-400' : 'bg-red-500';

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-indigo-200 dark:border-indigo-800 p-4 space-y-3 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Tour-Score Visualisierung</span>
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        {data.alert_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-600 font-semibold bg-red-50 dark:bg-red-950 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" /> {data.alert_count} Alert
          </span>
        )}
      </div>

      {/* Team-Score */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-gray-500 font-medium flex items-center gap-1">
            <Target className="w-3 h-3" /> Team-Score
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`text-xl font-black ${teamScoreColor}`}>{data.team_score}</span>
            <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${data.team_score_delta > 0 ? 'text-emerald-600' : data.team_score_delta < 0 ? 'text-red-600' : 'text-gray-400'}`}>
              {data.team_score_delta > 0 ? <TrendingUp className="w-3 h-3" /> : data.team_score_delta < 0 ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              {data.team_score_delta > 0 ? '+' : ''}{data.team_score_delta}
            </span>
          </div>
        </div>
        <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-700 ${teamScoreBar}`} style={{ width: `${data.team_score}%` }} />
        </div>
      </div>

      {/* KPI-Strip */}
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
          <div className="flex items-center justify-center gap-0.5 text-[9px] text-gray-500 mb-0.5">
            <Route className="w-2.5 h-2.5" /> Touren
          </div>
          <p className="text-sm font-black text-gray-800 dark:text-gray-100">{data.gesamt_touren}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
          <div className="flex items-center justify-center gap-0.5 text-[9px] text-gray-500 mb-0.5">
            <Clock className="w-2.5 h-2.5" /> Ø Lief.
          </div>
          <p className="text-sm font-black text-gray-800 dark:text-gray-100">{data.avg_lieferzeit}m</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
          <div className="flex items-center justify-center gap-0.5 text-[9px] text-gray-500 mb-0.5">
            <Zap className="w-2.5 h-2.5" /> SLA
          </div>
          <p className="text-sm font-black text-gray-800 dark:text-gray-100">{data.sla_rate}%</p>
        </div>
      </div>

      {/* Fahrer-Score-Visualisierung */}
      <div className="space-y-1.5">
        <p className="text-[9px] font-semibold text-gray-500 uppercase tracking-wide">Fahrer-Ranking</p>
        {data.fahrer.sort((a, b) => b.score - a.score).map((f, i) => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            {/* Rang */}
            <span className="text-[10px] font-black text-gray-400 w-4 text-right">{i + 1}</span>

            {/* Ampel-Dot */}
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${AMPEL[f.ampel]}`} />

            {/* Name */}
            <span className="text-[11px] font-medium text-gray-700 dark:text-gray-300 flex-1 min-w-0 truncate">{f.fahrer_name}</span>

            {/* Score-Balken */}
            <div className="w-24 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden flex-shrink-0">
              <div
                className={`h-full rounded-full ${AMPEL[f.ampel]} transition-all duration-700`}
                style={{ width: `${f.score}%` }}
              />
            </div>

            {/* Score-Wert */}
            <span className={`text-[11px] font-black w-7 text-right ${AMPEL_TEXT[f.ampel]}`}>{f.score}</span>

            {/* Trend */}
            <span className="w-4 flex justify-center">
              {f.trend === 'up'      ? <TrendingUp   className="w-3 h-3 text-emerald-500" />
               : f.trend === 'down' ? <TrendingDown  className="w-3 h-3 text-red-500" />
               :                      <Minus         className="w-3 h-3 text-gray-400" />}
            </span>
          </div>
        ))}
      </div>

      {/* Insight */}
      {data.top_insight && (
        <div className="flex items-start gap-2 bg-indigo-50 dark:bg-indigo-950 rounded-lg p-2.5">
          <Star className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-indigo-700 dark:text-indigo-300 leading-relaxed">{data.top_insight}</p>
        </div>
      )}

      <p className="text-[9px] text-gray-400 text-right">60-Sek-Polling · Mock-Fallback</p>
    </div>
  );
}
