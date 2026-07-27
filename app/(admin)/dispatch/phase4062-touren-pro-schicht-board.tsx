'use client';

import { useState, useEffect, useCallback } from 'react';
import { Truck, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  touren_pro_schicht: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_wenig: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  wenigster_name: string;
  alert_count: number;
  ziel: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, touren_pro_schicht: 8.5, rank_delta:  1, ampel: 'gruen', alert_wenig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, touren_pro_schicht: 7.2, rank_delta:  0, ampel: 'gruen', alert_wenig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, touren_pro_schicht: 5.8, rank_delta: -1, ampel: 'gelb',  alert_wenig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, touren_pro_schicht: 3.9, rank_delta:  0, ampel: 'rot',   alert_wenig: true  },
  ],
  team_avg: 6.35,
  bester_name: 'Julia F.',
  wenigster_name: 'Tim B.',
  alert_count: 1,
  ziel: 6.0,
};

interface Props { locationId: string | null; }

export function DispatchPhase4062TourenProSchichtBoard({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-touren-pro-schicht-ranking?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  const bester = data.fahrer[0];
  const letzter = data.fahrer[data.fahrer.length - 1];
  const maxScore = Math.max(...data.fahrer.map(f => f.touren_pro_schicht), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-gray-900">Touren/Schicht-Ranking</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {!loading && data.alert_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-600 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" /> {data.alert_count} Wenige Touren!
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-indigo-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-indigo-600 font-medium">Meiste Touren/h</div>
          <div className="text-xs font-bold text-indigo-700 truncate">{data.bester_name ?? bester?.fahrer_name ?? '–'}</div>
          <div className="text-[10px] text-indigo-500">{bester?.touren_pro_schicht?.toFixed(1) ?? '0.0'}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500 font-medium">Team-Ø</div>
          <div className="text-sm font-bold text-gray-700">{data.team_avg?.toFixed(1)}</div>
          <div className="text-[10px] text-gray-400">Ziel ≥{data.ziel?.toFixed(1)}</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-red-500 font-medium">Wenigste Touren</div>
          <div className="text-xs font-bold text-red-700 truncate">{data.wenigster_name ?? letzter?.fahrer_name ?? '–'}</div>
          <div className="text-[10px] text-red-400">{letzter?.touren_pro_schicht?.toFixed(1) ?? '0.0'}</div>
        </div>
      </div>
      <div className="space-y-2">
        {data.fahrer.map((f) => {
          const tColor = f.ampel === 'gruen' ? 'text-emerald-600' : f.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
          const barColor = f.ampel === 'gruen' ? 'bg-emerald-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const DeltaIcon = f.rank_delta > 0 ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> : f.rank_delta < 0 ? <TrendingDown className="w-3.5 h-3.5 text-red-400" /> : <Minus className="w-3.5 h-3.5 text-gray-300" />;
          return (
            <div key={f.fahrer_id} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-4 text-right">#{f.rang}</span>
              <span className="text-xs text-gray-700 w-20 truncate">{f.fahrer_name}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${(f.touren_pro_schicht / maxScore) * 100}%` }} />
              </div>
              <span className={`text-xs font-bold w-10 text-right ${tColor}`}>{f.touren_pro_schicht?.toFixed(1)}</span>
              {DeltaIcon}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] text-gray-400 px-1">
        <span>Team-Ø {data.team_avg?.toFixed(1)} | Ziel ≥{data.ziel?.toFixed(1)}</span>
        <span>Rang 1 = meiste Touren/Schicht</span>
      </div>
    </div>
  );
}
