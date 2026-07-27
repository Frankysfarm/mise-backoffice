'use client';

import { useState, useEffect, useCallback } from 'react';
import { Target, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow { fahrer_id: string; fahrer_name: string; rang: number; rate_pct: number; rank_delta: number; ampel: 'gruen' | 'gelb' | 'rot'; alert_niedrig: boolean; }
interface ApiData { fahrer: FahrerRow[]; team_avg_pct: number; bester_name: string; letzter_name: string; alert_count: number; gesamt: number; }

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, rate_pct: 95, rank_delta:  2, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, rate_pct: 88, rank_delta:  0, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, rate_pct: 72, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, rate_pct: 58, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_pct: 78,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

interface Props { locationId: string | null; }

export function DispatchPhase4182PuenktlichkeitsBoard({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-puenktlichkeits-ranking?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  const bester = data.fahrer[0];
  const letzter = data.fahrer[data.fahrer.length - 1];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-semibold text-gray-900">Pünktlichkeitsquote</span>
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        {data.alert_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3.5 h-3.5" /> {data.alert_count} Niedrige Pünktlichkeit!
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-violet-50 rounded-lg p-2">
          <p className="text-[10px] text-violet-600 font-medium">Pünktlichster</p>
          <p className="text-sm font-bold text-violet-700">{bester?.rate_pct?.toFixed(0)} %</p>
          <p className="text-[10px] text-violet-500 truncate">{data.bester_name}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-[10px] text-gray-500 font-medium">Team-Ø</p>
          <p className="text-sm font-bold text-gray-700">{data.team_avg_pct?.toFixed(0)} %</p>
          <p className="text-[10px] text-gray-400">{data.gesamt} Fahrer</p>
        </div>
        <div className="bg-red-50 rounded-lg p-2">
          <p className="text-[10px] text-red-500 font-medium">Niedrigster</p>
          <p className="text-sm font-bold text-red-600">{letzter?.rate_pct?.toFixed(0)} %</p>
          <p className="text-[10px] text-red-400 truncate">{data.letzter_name}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {data.fahrer.map((f) => {
          const barW = f.rate_pct;
          const barColor = f.ampel === 'gruen' ? 'bg-violet-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const tColor = f.ampel === 'gruen' ? 'text-violet-600' : f.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
          const Delta = f.rank_delta < 0 ? TrendingUp : f.rank_delta > 0 ? TrendingDown : Minus;
          const dColor = f.rank_delta < 0 ? 'text-emerald-500' : f.rank_delta > 0 ? 'text-red-400' : 'text-gray-300';
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400 w-4 text-right">#{f.rang}</span>
                <Delta className={`w-3 h-3 flex-shrink-0 ${dColor}`} />
                <span className="text-xs text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
                <span className={`text-xs font-bold ${tColor}`}>{f.rate_pct?.toFixed(0)} %</span>
              </div>
              <div className="ml-7 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barW}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100">
        <span>Team-Ø {data.team_avg_pct?.toFixed(0)} % Pünktlichkeit</span>
        <span>#1 = höchste Pünktlichkeit</span>
      </div>
    </div>
  );
}
