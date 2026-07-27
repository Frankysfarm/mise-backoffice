'use client';

import { useState, useEffect, useCallback } from 'react';
import { Route, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  km_avg: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg: number;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, km_avg:  4.2, rank_delta:  0, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, km_avg:  5.1, rank_delta: -1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, km_avg:  6.8, rank_delta:  1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, km_avg:  9.3, rank_delta:  0, ampel: 'rot',   alert_top: true  },
  ],
  team_avg: 6.35,
  alert_count: 1,
  gesamt: 4,
};

export function DispatchPhase3989KmProTourBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-km-pro-tour-ranking?location_id=${locationId}`);
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

  // ascending: lowest km_avg = Rang 1 = shortest routes = best
  const sorted = [...data.fahrer].sort((a, b) => a.rang - b.rang);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-teal-500" />
          <span className="text-sm font-semibold text-gray-900">km pro Tour</span>
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        {data.alert_count > 0 && (
          <span className="text-[11px] bg-red-100 text-red-700 font-medium px-2 py-0.5 rounded-full">
            {data.alert_count} Alert{data.alert_count > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>Hohe km pro Tour!</span>
        </div>
      )}

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-emerald-600 font-medium">Kürzeste Route</div>
          <div className="text-lg font-black text-emerald-700">{best?.km_avg ?? '–'} km</div>
          <div className="text-[10px] text-emerald-500 truncate">{best?.fahrer_name ?? '–'}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500 font-medium">Team-Ø</div>
          <div className="text-lg font-black text-gray-700">{data.team_avg} km</div>
          <div className="text-[10px] text-gray-400">pro Tour</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-red-500 font-medium">Längste Route</div>
          <div className="text-lg font-black text-red-600">{worst?.km_avg ?? '–'} km</div>
          <div className="text-[10px] text-red-400 truncate">{worst?.fahrer_name ?? '–'}</div>
        </div>
      </div>

      {/* Ranking-Liste */}
      <div className="space-y-1.5">
        {sorted.map((f) => {
          const tColor = f.ampel === 'gruen' ? 'text-emerald-600' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          const bgColor = f.ampel === 'gruen' ? 'bg-emerald-50' : f.ampel === 'gelb' ? 'bg-yellow-50' : 'bg-red-50';
          // rank_delta < 0 = improved position = TrendUp green (UNIVERSAL)
          const DeltaIcon = f.rank_delta < 0
            ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            : f.rank_delta > 0
              ? <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              : <Minus className="w-3.5 h-3.5 text-gray-300" />;
          return (
            <div key={f.fahrer_id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ${bgColor}`}>
              <span className="w-5 text-center text-[11px] font-mono text-gray-400">#{f.rang}</span>
              <span className="flex-1 text-xs font-medium text-gray-800 truncate">{f.fahrer_name}</span>
              <span className={`text-sm font-bold ${tColor}`}>{f.km_avg} km</span>
              {DeltaIcon}
              {f.alert_top && <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
