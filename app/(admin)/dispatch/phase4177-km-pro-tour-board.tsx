'use client';

import { useState, useEffect, useCallback } from 'react';
import { Route, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow { fahrer_id: string; fahrer_name: string; rang: number; km_avg: number; rank_delta: number; ampel: 'gruen' | 'gelb' | 'rot'; alert_top: boolean; }
interface ApiData { fahrer: FahrerRow[]; team_avg: number; bester_name: string; letzter_name: string; alert_count: number; gesamt: number; }

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, km_avg:  4.2, rank_delta:  0, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, km_avg:  5.1, rank_delta: -1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, km_avg:  6.8, rank_delta:  1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, km_avg:  9.3, rank_delta:  0, ampel: 'rot',   alert_top: true  },
  ],
  team_avg: 6.35,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

interface Props { locationId: string | null; }

export function DispatchPhase4177KmProTourBoard({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-km-pro-tour-ranking?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  const maxKm = Math.max(...data.fahrer.map(f => f.km_avg), 1);
  const bester = data.fahrer[0];
  const letzter = data.fahrer[data.fahrer.length - 1];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-teal-500" />
          <span className="text-sm font-semibold text-gray-900">Ø km / Tour</span>
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        {data.alert_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3.5 h-3.5" /> {data.alert_count} Hohe km/Tour!
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-emerald-50 rounded-lg p-2">
          <p className="text-[10px] text-emerald-600 font-medium">Effizienteste</p>
          <p className="text-sm font-bold text-emerald-700">{bester?.km_avg?.toFixed(1)} km</p>
          <p className="text-[10px] text-emerald-500 truncate">{data.bester_name}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-[10px] text-gray-500 font-medium">Team-Ø</p>
          <p className="text-sm font-bold text-gray-700">{data.team_avg?.toFixed(1)} km</p>
          <p className="text-[10px] text-gray-400">{data.gesamt} Fahrer</p>
        </div>
        <div className="bg-red-50 rounded-lg p-2">
          <p className="text-[10px] text-red-500 font-medium">Höchste km</p>
          <p className="text-sm font-bold text-red-600">{letzter?.km_avg?.toFixed(1)} km</p>
          <p className="text-[10px] text-red-400 truncate">{data.letzter_name}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {data.fahrer.map((f) => {
          const barW = maxKm > 0 ? (f.km_avg / maxKm) * 100 : 0;
          const barColor = f.ampel === 'gruen' ? 'bg-emerald-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const tColor = f.ampel === 'gruen' ? 'text-emerald-600' : f.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
          const Delta = f.rank_delta < 0 ? TrendingUp : f.rank_delta > 0 ? TrendingDown : Minus;
          const dColor = f.rank_delta < 0 ? 'text-emerald-500' : f.rank_delta > 0 ? 'text-red-400' : 'text-gray-300';
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400 w-4 text-right">#{f.rang}</span>
                <Delta className={`w-3 h-3 flex-shrink-0 ${dColor}`} />
                <span className="text-xs text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
                <span className={`text-xs font-bold ${tColor}`}>{f.km_avg?.toFixed(1)} km</span>
              </div>
              <div className="ml-7 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barW}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100">
        <span>Team-Ø {data.team_avg?.toFixed(1)} km/Tour</span>
        <span>#1 = wenigste km/Tour</span>
      </div>
    </div>
  );
}
