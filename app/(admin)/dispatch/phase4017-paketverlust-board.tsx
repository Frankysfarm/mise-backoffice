'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertOctagon, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  verlust_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_verlust_pct: number;
  bester_name: string;
  schlechtester_name: string;
  alert_count: number;
  ziel_pct: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, verlust_pct:  0.5, rank_delta:  0, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, verlust_pct:  1.2, rank_delta:  1, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, verlust_pct:  2.8, rank_delta: -1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, verlust_pct:  5.5, rank_delta:  0, ampel: 'rot',   alert_top: true  },
  ],
  team_avg_verlust_pct: 2.5,
  bester_name: 'Julia F.',
  schlechtester_name: 'Tim B.',
  alert_count: 1,
  ziel_pct: 1.0,
};

const AMPEL_BAR: Record<string, string> = {
  gruen: 'bg-emerald-500',
  gelb:  'bg-amber-400',
  rot:   'bg-red-500',
};

const RANK_BADGE: Record<number, string> = {
  1: 'bg-amber-400 text-white',
  2: 'bg-gray-300 text-gray-800',
  3: 'bg-orange-300 text-white',
};

interface Props {
  locationId: string | null;
}

export function DispatchPhase4017PaketverlustBoard({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-paketverlust-ranking?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // Mock-Fallback
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const bester    = data.fahrer[0];
  const letzter   = data.fahrer[data.fahrer.length - 1];
  const maxPct    = Math.max(...data.fahrer.map(f => f.verlust_pct), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-red-500" />
          <span className="text-sm font-semibold text-gray-900">Paketverlust-Ranking</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {!loading && data.alert_count > 0 && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
              {data.alert_count} Alarm
            </span>
          )}
        </div>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-emerald-50 rounded-lg p-2">
          <div className="text-xs text-gray-500 mb-0.5">Niedrigster</div>
          <div className="text-sm font-bold text-emerald-700">{bester?.verlust_pct ?? 0}%</div>
          <div className="text-xs text-gray-400 truncate">{bester?.fahrer_name ?? '–'}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-xs text-gray-500 mb-0.5">Team-Avg</div>
          <div className="text-sm font-bold text-gray-700">{data.team_avg_verlust_pct}%</div>
          <div className="text-xs text-gray-400">Ziel ≤{data.ziel_pct}%</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2">
          <div className="text-xs text-gray-500 mb-0.5">Höchster</div>
          <div className="text-sm font-bold text-red-700">{letzter?.verlust_pct ?? 0}%</div>
          <div className="text-xs text-gray-400 truncate">{letzter?.fahrer_name ?? '–'}</div>
        </div>
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />
          <span className="text-xs text-red-700 font-medium">Hoher Paketverlust!</span>
        </div>
      )}

      {/* Ranking-Liste */}
      <div className="space-y-2">
        {data.fahrer.map((f) => {
          const barWidth = maxPct > 0 ? Math.round((f.verlust_pct / maxPct) * 100) : 0;
          const delta = f.rank_delta;

          return (
            <div
              key={f.fahrer_id}
              className={`rounded-lg px-3 py-2 ${f.alert_top ? 'bg-red-50 border border-red-100' : 'bg-gray-50'}`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className={`text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center ${RANK_BADGE[f.rang] ?? 'bg-gray-200 text-gray-600'}`}>
                  {f.rang}
                </span>
                <span className="text-xs font-medium text-gray-800 flex-1 truncate">{f.fahrer_name}</span>
                <span className={`text-xs font-bold ${
                  f.ampel === 'gruen' ? 'text-emerald-600' :
                  f.ampel === 'gelb'  ? 'text-amber-600'  : 'text-red-600'
                }`}>
                  {f.verlust_pct}%
                </span>
                {delta < 0 ? (
                  <TrendingUp className="w-3 h-3 text-emerald-500" />
                ) : delta > 0 ? (
                  <TrendingDown className="w-3 h-3 text-red-400" />
                ) : (
                  <Minus className="w-3 h-3 text-gray-400" />
                )}
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1">
                <div
                  className={`h-1 rounded-full ${AMPEL_BAR[f.ampel]}`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-gray-100">
        <span>Ziel ≤{data.ziel_pct}%</span>
        <span>Team-Avg {data.team_avg_verlust_pct}%</span>
      </div>
    </div>
  );
}
