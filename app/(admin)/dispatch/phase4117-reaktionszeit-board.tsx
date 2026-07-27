'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow { fahrer_id: string; fahrer_name: string; rang: number; avg_min: number; rank_delta: number; ampel: 'gruen' | 'gelb' | 'rot'; alert_hoch: boolean; }
interface ApiData { fahrer: FahrerRow[]; team_avg_min: number; schnellster_name: string; langsamster_name: string; alert_count: number; gesamt: number; ziel_min: number; }

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_min: 3,  rank_delta:  0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_min: 4,  rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_min: 6,  rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_min: 8,  rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg_min: 5, schnellster_name: 'Julia F.', langsamster_name: 'Tim B.', alert_count: 1, gesamt: 4, ziel_min: 5,
};

interface Props { locationId: string | null; }

export function DispatchPhase4117ReaktionszeitBoard({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-reaktionszeit-ranking?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  const maxMin = Math.max(...data.fahrer.map(f => f.avg_min), 1);
  const bester = data.fahrer[0];
  const letzter = data.fahrer[data.fahrer.length - 1];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-cyan-500" />
          <span className="text-sm font-semibold text-gray-900">Reaktionszeit-Ranking</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {!loading && data.alert_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-600 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" /> {data.alert_count} Hohe Reaktionszeit!
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-cyan-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500">Schnellste</div>
          <div className="text-sm font-bold text-cyan-600">{bester?.avg_min} min</div>
          <div className="text-[10px] text-gray-500 truncate">{bester?.fahrer_name}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500">Team-Avg</div>
          <div className="text-sm font-bold text-gray-700">{data.team_avg_min} min</div>
          <div className="text-[10px] text-gray-400">{data.gesamt} Fahrer</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500">Langsamste</div>
          <div className="text-sm font-bold text-red-500">{letzter?.avg_min} min</div>
          <div className="text-[10px] text-gray-500 truncate">{letzter?.fahrer_name}</div>
        </div>
      </div>

      <div className="space-y-1.5">
        {data.fahrer.map((f) => {
          const barW = `${(f.avg_min / maxMin) * 100}%`;
          const dotColor = f.ampel === 'gruen' ? 'bg-emerald-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const tColor = f.ampel === 'gruen' ? 'text-emerald-600' : f.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
          const DeltaIcon = f.rank_delta < 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : f.rank_delta > 0 ? <TrendingDown className="w-3 h-3 text-red-400" /> : <Minus className="w-3 h-3 text-gray-300" />;
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-gray-400 w-4 text-right">#{f.rang}</span>
                {DeltaIcon}
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                <span className="text-xs text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
                <span className={`text-xs font-bold ${tColor}`}>{f.avg_min} min</span>
                {f.alert_hoch && <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />}
              </div>
              <div className="ml-7 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${f.ampel === 'gruen' ? 'bg-emerald-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: barW }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-[10px] text-gray-400 px-1 pt-1 border-t border-gray-100">
        <span>Rang 1 = schnellste Reaktion · Ziel &lt;{data.ziel_min} min</span>
        <span>Team-Avg {data.team_avg_min} min</span>
      </div>
    </div>
  );
}
