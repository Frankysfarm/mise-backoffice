'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerLeerlaufZeit {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  leerlauf_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiResponse {
  fahrer: FahrerLeerlaufZeit[];
  team_avg: number;
  kuerzester_name: string;
  alert_count: number;
}

export function KitchenPhase3592LeerlaufZeitTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  const load = useCallback(async () => {
    try {
      const url = locationId
        ? `/api/delivery/admin/fahrer-leerlauf-zeit?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-leerlauf-zeit';
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } catch {}
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-yellow-500" />
          <span className="font-semibold text-sm text-gray-900">Leerlauf-Zeit Ticker</span>
        </div>
        <div className="text-xs text-gray-500">
          <span className="font-bold text-emerald-700">#1 {data.kuerzester_name}</span>
          <span className="ml-1">{data.fahrer[0]?.leerlauf_min ?? '–'} min</span>
        </div>
      </div>

      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
          <AlertTriangle className="w-3 h-3" />
          <span>Hohe Leerlauf-Zeit!</span>
        </div>
      )}

      <div className="space-y-1">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-2 text-xs">
            <span className="text-gray-400 w-4">#{f.rang}</span>
            <span className="flex-1 truncate font-medium text-gray-800">{f.fahrer_name}</span>
            <span className={`font-bold w-12 text-right ${f.ampel === 'gruen' ? 'text-emerald-600' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-600'}`}>
              {f.leerlauf_min} min
            </span>
            {f.rank_delta < 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> : f.rank_delta > 0 ? <TrendingDown className="w-3 h-3 text-red-500" /> : <Minus className="w-3 h-3 text-gray-300" />}
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-400 text-center">Team-Ø: {data.team_avg} min · Ziel &lt;45 min</div>
    </div>
  );
}
