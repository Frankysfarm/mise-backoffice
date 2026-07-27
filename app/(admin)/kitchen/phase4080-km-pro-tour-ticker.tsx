'use client';

import { useState, useEffect, useCallback } from 'react';
import { Route, AlertTriangle } from 'lucide-react';

interface FahrerRow { fahrer_id: string; fahrer_name: string; rang: number; km_avg: number; ampel: 'gruen' | 'gelb' | 'rot'; alert_top: boolean; }
interface ApiData { fahrer: FahrerRow[]; team_avg: number; bester_name: string; alert_count: number; }

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, km_avg: 4.2, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, km_avg: 5.1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, km_avg: 6.8, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, km_avg: 9.3, ampel: 'rot',   alert_top: true  },
  ],
  team_avg: 6.35,
  bester_name: 'Julia F.',
  alert_count: 1,
};

interface Props { locationId: string | null; }

export function KitchenPhase4080KmProTourTicker({ locationId }: Props) {
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

  const bester = data.fahrer[0];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Route className="w-3.5 h-3.5 text-violet-500" />
          <span className="text-xs font-semibold text-gray-900">km/Tour</span>
        </div>
        <div className="flex items-center gap-1.5">
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {!loading && data.alert_count > 0 && (
            <span className="flex items-center gap-0.5 text-[10px] text-red-600 font-semibold">
              <AlertTriangle className="w-3 h-3" /> {data.alert_count}
            </span>
          )}
          <span className="text-[10px] text-violet-600 font-medium">
            #{bester?.rang} {data.bester_name ?? bester?.fahrer_name} {bester?.km_avg?.toFixed(1)}km
          </span>
        </div>
      </div>
      <div className="space-y-1">
        {data.fahrer.map((f) => {
          const dotColor = f.ampel === 'gruen' ? 'bg-emerald-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const tColor = f.ampel === 'gruen' ? 'text-emerald-600' : f.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
          return (
            <div key={f.fahrer_id} className="flex items-center gap-1.5">
              <span className="text-[10px] text-gray-400 w-3 text-right">#{f.rang}</span>
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
              <span className="text-[10px] text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
              <span className={`text-[10px] font-bold ${tColor}`}>{f.km_avg?.toFixed(1)}km</span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 px-0.5 pt-0.5 border-t border-gray-100">
        <span>Ø {data.team_avg?.toFixed(1)} km/Tour</span>
        <span>#1 = kürzeste km/Tour</span>
      </div>
    </div>
  );
}
