'use client';

import { useEffect, useState } from 'react';
import { Trophy, Target, Zap, TrendingUp, TrendingDown, Minus, Route } from 'lucide-react';

interface TourRow {
  tour_id: string;
  fahrer_name: string;
  score: number;
  stopps_gesamt: number;
  stopps_erledigt: number;
  eta_min: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  delta: number;
}

interface ApiData {
  touren: TourRow[];
  team_avg_score: number;
  beste_score: number;
  beste_name: string;
  alert_count: number;
}

const MOCK: ApiData = {
  team_avg_score: 76,
  beste_score: 92,
  beste_name: 'Thomas K.',
  alert_count: 1,
  touren: [
    { tour_id: 't1', fahrer_name: 'Thomas K.', score: 92, stopps_gesamt: 4, stopps_erledigt: 2, eta_min: 18, ampel: 'gruen', delta: 3 },
    { tour_id: 't2', fahrer_name: 'Sarah M.', score: 78, stopps_gesamt: 3, stopps_erledigt: 1, eta_min: 25, ampel: 'gelb', delta: -2 },
    { tour_id: 't3', fahrer_name: 'Ali B.', score: 58, stopps_gesamt: 5, stopps_erledigt: 3, eta_min: 32, ampel: 'rot', delta: -5 },
  ],
};

const AMPEL_RING: Record<string, string> = {
  gruen: 'ring-emerald-400 dark:ring-emerald-600',
  gelb:  'ring-yellow-400 dark:ring-yellow-600',
  rot:   'ring-red-400 dark:ring-red-600',
};
const AMPEL_SCORE: Record<string, string> = {
  gruen: 'text-emerald-700 dark:text-emerald-300',
  gelb:  'text-yellow-700 dark:text-yellow-300',
  rot:   'text-red-600 dark:text-red-400',
};
const AMPEL_BAR: Record<string, string> = {
  gruen: 'bg-emerald-500', gelb: 'bg-yellow-400', rot: 'bg-red-500',
};

function DeltaBadge({ d }: { d: number }) {
  if (d > 0) return <span className="text-xs text-emerald-600 flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />+{d}</span>;
  if (d < 0) return <span className="text-xs text-red-500 flex items-center gap-0.5"><TrendingDown className="w-3 h-3" />{d}</span>;
  return <span className="text-xs text-gray-400"><Minus className="w-3 h-3 inline" /></span>;
}

export function DispatchPhase4643TourScoreKpiBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const p = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/tour-score-kpi${p}`);
        if (!res.ok) throw new Error();
        const json: ApiData = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(MOCK);
      }
    }

    load();
    const iv = setInterval(load, 20_000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!data) return <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 animate-pulse h-64" />;

  return (
    <div className="rounded-2xl border border-violet-200 dark:border-violet-900 bg-white dark:bg-gray-900 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-violet-600 dark:text-violet-400" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Tour-Score KPI Board</h3>
        <span className="ml-auto text-xs text-gray-400">Ø {data.team_avg_score} · Ziel ≥75</span>
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
          <span className="text-xs text-amber-700 dark:text-amber-300">⚠ {data.alert_count} Tour unter Ziel-Score</span>
        </div>
      )}

      {/* Bester Fahrer */}
      <div className="flex items-center gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 p-3">
        <Target className="w-5 h-5 text-emerald-600" />
        <div>
          <p className="text-xs text-gray-400">Bester Score</p>
          <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{data.beste_name}</p>
        </div>
        <span className="ml-auto text-2xl font-bold text-emerald-700 dark:text-emerald-300">{data.beste_score}</span>
      </div>

      {/* Tour-Kacheln */}
      <div className="space-y-3">
        {data.touren.map(t => (
          <div key={t.tour_id} className={`rounded-xl ring-1 ${AMPEL_RING[t.ampel]} bg-white dark:bg-gray-900 p-3 space-y-2`}>
            <div className="flex items-center gap-2">
              <Route className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex-1">{t.fahrer_name}</span>
              <DeltaBadge d={t.delta} />
              <span className={`text-lg font-bold ${AMPEL_SCORE[t.ampel]}`}>{t.score}</span>
            </div>

            {/* Fortschritt */}
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-2 rounded-full ${AMPEL_BAR[t.ampel]}`}
                  style={{ width: `${(t.stopps_erledigt / t.stopps_gesamt) * 100}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 shrink-0">{t.stopps_erledigt}/{t.stopps_gesamt} Stopps</span>
            </div>

            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Zap className="w-3 h-3" />
              <span>ETA ~{t.eta_min} min</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
