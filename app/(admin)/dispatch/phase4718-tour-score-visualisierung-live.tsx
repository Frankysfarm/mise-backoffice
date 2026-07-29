'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Trophy, Route, Gauge, Target, Star } from 'lucide-react';

interface FahrerScore {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  score: number;
  touren: number;
  lieferzeit_avg_min: number;
  puenktlichkeit_pct: number;
  score_delta: number;
  zone: string;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface TourKpi {
  label: string;
  value: string;
  delta_pct: number | null;
}

interface ApiResponse {
  fahrer: FahrerScore[];
  team_score_avg: number;
  team_score_trend: number;
  tour_kpis: TourKpi[];
  top_zone: string;
  alert_score_below: string | null;
}

const MOCK: ApiResponse = {
  team_score_avg: 74,
  team_score_trend: 3,
  top_zone: 'Mitte',
  alert_score_below: null,
  tour_kpis: [
    { label: 'Ø Lieferzeit', value: '28 min', delta_pct: -4 },
    { label: 'Pünktlichkeit', value: '83%', delta_pct: 2 },
    { label: 'Touren/Std', value: '2.4', delta_pct: 5 },
    { label: 'Km-Effizienz', value: '€1.12/km', delta_pct: null },
  ],
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max K.', rang: 1, score: 91, touren: 6, lieferzeit_avg_min: 24, puenktlichkeit_pct: 92, score_delta: 4, zone: 'Mitte', ampel: 'gruen' },
    { fahrer_id: 'f2', fahrer_name: 'Sara L.', rang: 2, score: 84, touren: 5, lieferzeit_avg_min: 27, puenktlichkeit_pct: 86, score_delta: -1, zone: 'Nord', ampel: 'gruen' },
    { fahrer_id: 'f3', fahrer_name: 'Tom R.', rang: 3, score: 71, touren: 4, lieferzeit_avg_min: 31, puenktlichkeit_pct: 74, score_delta: 0, zone: 'Süd', ampel: 'gelb' },
    { fahrer_id: 'f4', fahrer_name: 'Ana B.', rang: 4, score: 58, touren: 3, lieferzeit_avg_min: 38, puenktlichkeit_pct: 61, score_delta: -5, zone: 'West', ampel: 'rot' },
  ],
};

function ScoreArc({ score }: { score: number }) {
  const r = 40;
  const circ = Math.PI * r;
  const fill = (score / 100) * circ;
  const color = score >= 80 ? '#34d399' : score >= 60 ? '#fbbf24' : '#f87171';
  return (
    <svg width="100" height="56" viewBox="0 0 100 56">
      <path d="M10,50 A40,40 0 0,1 90,50" fill="none" stroke="#1e1b4b" strokeWidth="10" />
      <path d="M10,50 A40,40 0 0,1 90,50" fill="none" stroke={color} strokeWidth="10"
        strokeDasharray={`${fill} ${circ}`} strokeLinecap="round" />
      <text x="50" y="48" textAnchor="middle" fontSize="18" fontWeight="bold" fill={color}>{score}</text>
    </svg>
  );
}

function Delta({ v }: { v: number }) {
  if (v > 0) return <TrendingUp className="w-3 h-3 text-emerald-400" />;
  if (v < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

const ampelBg: Record<string, string> = { gruen: 'bg-emerald-500', gelb: 'bg-amber-400', rot: 'bg-red-500' };

export function DispatchPhase4718TourScoreVisualisierungLive({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    try {
      const r = await fetch(`/api/delivery/admin/tour-score-visualisierung-live?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
      else setData(MOCK);
    } catch { setData(MOCK); }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return <div className="rounded-2xl bg-violet-950 p-4 text-violet-400 text-sm animate-pulse">Lade Tour-Score Visualisierung…</div>;

  const trendColor = data.team_score_trend > 0 ? 'text-emerald-400' : data.team_score_trend < 0 ? 'text-red-400' : 'text-gray-400';

  return (
    <div className="rounded-2xl bg-violet-950 text-white p-4 space-y-4">
      {/* Header + Team Arc */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Route className="w-5 h-5 text-violet-400" />
            <span className="font-semibold text-violet-100">Tour-Score Live</span>
          </div>
          <div className={`text-xs flex items-center gap-1 mt-1 ${trendColor}`}>
            <Delta v={data.team_score_trend} />
            {Math.abs(data.team_score_trend)} Pkt. vs. gestern
          </div>
        </div>
        <ScoreArc score={data.team_score_avg} />
      </div>

      {data.alert_score_below && (
        <div className="rounded-lg bg-red-900/50 border border-red-600 px-3 py-2 text-red-300 text-xs">
          ⚠ Score-Warnung: {data.alert_score_below}
        </div>
      )}

      {/* Tour KPIs */}
      <div className="grid grid-cols-2 gap-2">
        {data.tour_kpis.map(kpi => (
          <div key={kpi.label} className="rounded-xl bg-violet-900/50 p-3">
            <p className="text-[10px] text-violet-400">{kpi.label}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-bold text-violet-100">{kpi.value}</span>
              {kpi.delta_pct !== null && (
                <span className={`text-[10px] flex items-center gap-0.5 ${kpi.delta_pct > 0 ? 'text-emerald-400' : kpi.delta_pct < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                  <Delta v={kpi.delta_pct} />
                  {Math.abs(kpi.delta_pct)}%
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Top Zone */}
      <div className="flex items-center gap-2 text-xs text-violet-300">
        <Target className="w-4 h-4 text-emerald-400" />
        Top-Zone heute: <span className="font-semibold text-emerald-400">{data.top_zone}</span>
      </div>

      {/* Fahrer Ranking */}
      <div className="space-y-2">
        <div className="flex items-center gap-1 text-xs text-violet-400">
          <Trophy className="w-3 h-3" /> Fahrer-Ranking
        </div>
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-violet-500 w-4">#{f.rang}</span>
                <Delta v={f.score_delta} />
                <span className="text-violet-100">{f.fahrer_name}</span>
                <span className="text-[10px] text-violet-500">{f.zone}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-violet-400">{f.lieferzeit_avg_min}′ · {f.puenktlichkeit_pct}%</span>
                <span className="font-bold text-white">{f.score}</span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-violet-900">
              <div className={`h-full rounded-full ${ampelBg[f.ampel]}`} style={{ width: `${f.score}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
