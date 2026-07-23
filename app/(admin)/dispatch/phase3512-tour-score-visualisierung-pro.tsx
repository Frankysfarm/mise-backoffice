'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Trophy, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerTourScore {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  score: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
  trend: 'up' | 'down' | 'neutral';
}

interface ApiResponse {
  fahrer: FahrerTourScore[];
  team_avg: number;
  bester_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  team_avg: 72,
  bester_name: 'Marcus R.',
  niedrigster_name: 'Tom B.',
  alert_count: 1,
  gesamt: 5,
  fahrer: [
    { fahrer_id: 'd1', fahrer_name: 'Marcus R.', rang: 1, score: 91, rank_delta: 0,  ampel: 'gruen', alert_bottom: false, trend: 'up' },
    { fahrer_id: 'd2', fahrer_name: 'Julia F.',  rang: 2, score: 84, rank_delta: 1,  ampel: 'gruen', alert_bottom: false, trend: 'up' },
    { fahrer_id: 'd3', fahrer_name: 'Kai W.',    rang: 3, score: 73, rank_delta: -1, ampel: 'gruen', alert_bottom: false, trend: 'down' },
    { fahrer_id: 'd4', fahrer_name: 'Sarah M.',  rang: 4, score: 61, rank_delta: 0,  ampel: 'gelb',  alert_bottom: false, trend: 'neutral' },
    { fahrer_id: 'd5', fahrer_name: 'Tom B.',    rang: 5, score: 44, rank_delta: 0,  ampel: 'rot',   alert_bottom: true,  trend: 'down' },
  ],
};

const AMPEL_COLOR: Record<string, string> = {
  gruen: 'text-emerald-600',
  gelb:  'text-yellow-600',
  rot:   'text-red-600',
};
const AMPEL_BG: Record<string, string> = {
  gruen: 'bg-emerald-500',
  gelb:  'bg-yellow-400',
  rot:   'bg-red-500',
};
const RANK_BADGE: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function scoreColor(s: number): string {
  if (s >= 80) return 'text-emerald-600';
  if (s >= 60) return 'text-yellow-600';
  return 'text-red-600';
}

export function DispatchPhase3512TourScoreVisualisierungPro({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse>(MOCK);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-tour-score?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch {}
  }, [locationId]);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(iv);
  }, [load]);

  const maxScore = Math.max(...data.fahrer.map(f => f.score), 1);

  return (
    <div className="border rounded-lg bg-white dark:bg-gray-900 shadow-sm mb-3">
      <button
        className="w-full flex items-center justify-between p-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          <Trophy className="w-4 h-4 text-amber-500" />
          Tour-Score Visualisierung
          {data.alert_count > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs font-bold">
              {data.alert_count} ⚠
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {data.alert_count > 0 && (
            <div className="flex items-center gap-1.5 p-2 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs border border-red-200">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Niedriger Tour-Score! {data.alert_count} Fahrer unter 50 Punkten
            </div>
          )}

          {/* KPI-Header */}
          <div className="grid grid-cols-3 gap-2 py-1">
            <div className="text-center">
              <div className="text-[10px] text-gray-500 uppercase">Bester</div>
              <div className="text-xs font-semibold text-emerald-600 truncate">{data.bester_name}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-gray-500 uppercase">Team-Ø</div>
              <div className={`text-xs font-semibold ${scoreColor(data.team_avg)}`}>{data.team_avg}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-gray-500 uppercase">Letzter</div>
              <div className="text-xs font-semibold text-red-600 truncate">{data.niedrigster_name}</div>
            </div>
          </div>

          {/* Tour-Score Bars */}
          <div className="space-y-1.5">
            {data.fahrer.map(f => (
              <div key={f.fahrer_id} className="flex items-center gap-2">
                <span className="text-xs w-5 text-center flex-shrink-0">
                  {RANK_BADGE[f.rang] ?? <span className="text-gray-500 text-[10px]">{f.rang}</span>}
                </span>
                <span className="text-xs w-20 truncate flex-shrink-0">{f.fahrer_name}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2.5 relative">
                  <div
                    className={`h-2.5 rounded-full transition-all ${AMPEL_BG[f.ampel]}`}
                    style={{ width: `${(f.score / maxScore) * 100}%` }}
                  />
                </div>
                <span className={`text-xs font-mono font-bold w-8 text-right flex-shrink-0 ${AMPEL_COLOR[f.ampel]}`}>
                  {f.score}
                </span>
                <span className="flex-shrink-0 w-5">
                  {f.trend === 'up' ? (
                    <TrendingUp className="w-3 h-3 text-emerald-500" />
                  ) : f.trend === 'down' ? (
                    <TrendingDown className="w-3 h-3 text-red-500" />
                  ) : (
                    <Minus className="w-3 h-3 text-gray-400" />
                  )}
                </span>
              </div>
            ))}
          </div>

          {/* Score-Legende */}
          <div className="flex gap-3 text-[9px] text-gray-400 pt-1 border-t">
            <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> ≥80 Sehr gut</span>
            <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> 60–79 Gut</span>
            <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &lt;60 Verbesserung</span>
          </div>
        </div>
      )}
    </div>
  );
}
