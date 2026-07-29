'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, Gauge, MapPin, AlertTriangle, Zap, CheckCircle2 } from 'lucide-react';

interface FahrerScoreRow {
  fahrer_id: string;
  fahrer_name: string;
  score: number;
  score_trend: number;
  zone: string;
  zone_match_pct: number;
  aktiv: boolean;
  tour_laeuft: boolean;
  alert: boolean;
}

interface KpiStrip {
  label: string;
  value: string;
  color: string;
}

interface ApiResponse {
  fahrer: FahrerScoreRow[];
  team_score: number;
  kpi_strip: KpiStrip[];
  alerts: string[];
}

const MOCK: ApiResponse = {
  team_score: 77,
  alerts: [],
  kpi_strip: [
    { label: 'Ø Score', value: '77', color: 'text-indigo-300' },
    { label: 'Score >80', value: '3 / 4', color: 'text-emerald-400' },
    { label: 'Zone-Match', value: '84%', color: 'text-amber-400' },
    { label: 'Live-Touren', value: '4', color: 'text-violet-300' },
  ],
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Kai B.', score: 92, score_trend: 5, zone: 'Mitte', zone_match_pct: 94, aktiv: true, tour_laeuft: true, alert: false },
    { fahrer_id: 'f2', fahrer_name: 'Mia S.', score: 85, score_trend: -2, zone: 'Nord', zone_match_pct: 87, aktiv: true, tour_laeuft: true, alert: false },
    { fahrer_id: 'f3', fahrer_name: 'Jonas R.', score: 72, score_trend: 0, zone: 'Ost', zone_match_pct: 76, aktiv: true, tour_laeuft: true, alert: false },
    { fahrer_id: 'f4', fahrer_name: 'Lena H.', score: 58, score_trend: -8, zone: 'West', zone_match_pct: 61, aktiv: true, tour_laeuft: false, alert: true },
  ],
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? 'bg-emerald-500' : score >= 65 ? 'bg-amber-400' : 'bg-red-500';
  return (
    <div className="h-2 rounded-full bg-gray-800 flex-1">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${score}%` }} />
    </div>
  );
}

function TrendIcon({ v }: { v: number }) {
  if (v > 0) return <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />;
  if (v < 0) return <TrendingDown className="w-3.5 h-3.5 text-red-400" />;
  return <Minus className="w-3.5 h-3.5 text-gray-500" />;
}

export function DispatchPhase4720ScoreAnzeigeCockpit({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    try {
      const r = await fetch(`/api/delivery/admin/dispatch-score-anzeige-cockpit?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
      else setData(MOCK);
    } catch { setData(MOCK); }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [locationId]);

  if (!data) return <div className="rounded-2xl bg-gray-900 p-4 text-gray-400 text-sm animate-pulse">Lade Score-Cockpit…</div>;

  const scoreColor = data.team_score >= 80 ? 'text-emerald-400' : data.team_score >= 65 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="rounded-2xl bg-gray-900 text-white p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-gray-100">Score-Anzeige Cockpit</span>
        </div>
        <div className={`text-3xl font-black ${scoreColor}`}>{data.team_score}</div>
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
        {data.kpi_strip.map(k => (
          <div key={k.label} className="rounded-lg bg-gray-800 p-2">
            <p className="text-gray-500 text-[10px]">{k.label}</p>
            <p className={`font-bold ${k.color}`}>{k.value}</p>
          </div>
        ))}
      </div>

      {/* Fahrer Score Rows */}
      <div className="space-y-3">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className={`rounded-xl p-3 space-y-2 ${f.alert ? 'bg-red-950 border border-red-700' : 'bg-gray-800'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {f.tour_laeuft
                  ? <Zap className="w-3.5 h-3.5 text-amber-400" />
                  : <CheckCircle2 className="w-3.5 h-3.5 text-gray-600" />
                }
                <span className="text-sm font-semibold text-gray-100">{f.fahrer_name}</span>
                <span className="text-[10px] text-gray-500 flex items-center gap-0.5">
                  <MapPin className="w-2.5 h-2.5" />{f.zone}
                </span>
                {f.alert && <AlertTriangle className="w-3 h-3 text-red-400" />}
              </div>
              <div className="flex items-center gap-2">
                <TrendIcon v={f.score_trend} />
                <span className={`text-lg font-black ${f.score >= 80 ? 'text-emerald-400' : f.score >= 65 ? 'text-amber-400' : 'text-red-400'}`}>
                  {f.score}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ScoreBar score={f.score} />
              <span className="text-[10px] text-gray-500 shrink-0">Zone {f.zone_match_pct}%</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
