'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  touren_pro_tag: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_touren: number;
  alert_count: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, touren_pro_tag: 8.2, rank_delta:  1, ampel: 'gruen' },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, touren_pro_tag: 7.1, rank_delta:  0, ampel: 'gruen' },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, touren_pro_tag: 6.5, rank_delta: -1, ampel: 'gelb'  },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, touren_pro_tag: 4.8, rank_delta: -1, ampel: 'rot'   },
  ],
  team_avg_touren: 6.65,
  alert_count: 1,
};

export function DispatchPhase3854TourenProTagBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-touren-pro-tag?location_id=${locationId}`);
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

  const sorted = [...data.fahrer].sort((a, b) => b.touren_pro_tag - a.touren_pro_tag);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-green-500" />
          <h3 className="text-sm font-bold text-gray-900">Touren pro Tag</h3>
          {loading && <span className="w-3 h-3 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        <span className="text-xs text-gray-400">Ziel ≥7/Tag</span>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Meiste</div>
          <div className="text-lg font-black text-emerald-700">{best?.touren_pro_tag ?? '—'}</div>
          <div className="text-[10px] text-gray-600 truncate">{best?.fahrer_name ?? '—'}</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Team-Ø</div>
          <div className="text-lg font-black text-blue-700">{data.team_avg_touren}</div>
          <div className="text-[10px] text-gray-600">Touren</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Wenigste</div>
          <div className="text-lg font-black text-red-600">{worst?.touren_pro_tag ?? '—'}</div>
          <div className="text-[10px] text-gray-600 truncate">{worst?.fahrer_name ?? '—'}</div>
        </div>
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-orange-50 border border-orange-200 rounded-lg text-[11px] text-orange-800">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{data.alert_count} Fahrer mit wenigen Touren!</span>
        </div>
      )}

      {/* Rangliste */}
      <div className="space-y-1.5">
        {sorted.map(f => {
          const tColor = f.ampel === 'gruen' ? 'text-emerald-700' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          const barColor = f.ampel === 'gruen' ? 'bg-emerald-500' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const maxVal = sorted[0]?.touren_pro_tag || 1;
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-4 text-gray-400 font-mono text-[10px]">#{f.rang}</span>
                <span className="flex-1 text-gray-800 font-medium truncate">{f.fahrer_name}</span>
                <span className={`font-bold ${tColor}`}>{f.touren_pro_tag}</span>
                {f.rank_delta > 0
                  ? <TrendingUp className="w-3 h-3 text-emerald-500" />
                  : f.rank_delta < 0
                    ? <TrendingDown className="w-3 h-3 text-red-400" />
                    : <Minus className="w-3 h-3 text-gray-300" />
                }
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden ml-5">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${(f.touren_pro_tag / maxVal) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-[10px] text-gray-400 border-t border-gray-100 pt-1.5 text-right">
        Letzte 30 Tage · abgeschlossene Touren
      </div>
    </div>
  );
}
