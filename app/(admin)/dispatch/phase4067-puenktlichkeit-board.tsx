'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

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

export function DispatchPhase4067PuenktlichkeitBoard({ locationId }: Props) {
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

  const maxPct = Math.max(...data.fahrer.map(f => f.rate_pct), 1);
  const bester = data.fahrer[0];
  const letzter = data.fahrer[data.fahrer.length - 1];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-green-500" />
          <span className="text-sm font-semibold text-gray-900">Pünktlichkeits-Ranking</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {!loading && data.alert_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-600 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" /> {data.alert_count} Niedrige Pünktlichkeit!
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-green-50 rounded-lg p-2">
          <p className="text-[10px] text-gray-500 mb-0.5">Pünktlichste</p>
          <p className="text-sm font-bold text-green-700">{bester?.rate_pct ?? 0}%</p>
          <p className="text-[10px] text-gray-400 truncate">{data.bester_name}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-[10px] text-gray-500 mb-0.5">Team-Ø</p>
          <p className="text-sm font-bold text-gray-700">{data.team_avg_pct}%</p>
          <p className="text-[10px] text-gray-400">Ziel ≥85%</p>
        </div>
        <div className="bg-red-50 rounded-lg p-2">
          <p className="text-[10px] text-gray-500 mb-0.5">Niedrigste</p>
          <p className="text-sm font-bold text-red-600">{letzter?.rate_pct ?? 0}%</p>
          <p className="text-[10px] text-gray-400 truncate">{data.letzter_name}</p>
        </div>
      </div>

      <div className="space-y-2">
        {data.fahrer.map((f) => {
          const barColor = f.ampel === 'gruen' ? 'bg-emerald-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const tColor = f.ampel === 'gruen' ? 'text-emerald-600' : f.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
          const DeltaIcon = f.rank_delta > 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : f.rank_delta < 0 ? <TrendingDown className="w-3 h-3 text-red-400" /> : <Minus className="w-3 h-3 text-gray-300" />;
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-400 w-4 text-right">#{f.rang}</span>
                {DeltaIcon}
                <span className="text-xs text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
                <span className={`text-xs font-bold ${tColor}`}>{f.rate_pct}%</span>
              </div>
              <div className="ml-6 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${(f.rate_pct / maxPct) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-[11px] text-gray-400 px-1 pt-1 border-t border-gray-100">
        <span>Team-Ø {data.team_avg_pct}% | Ziel ≥85%</span>
        <span>Rang 1 = höchste Pünktlichkeit</span>
      </div>
    </div>
  );
}
