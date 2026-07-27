'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow { fahrer_id: string; fahrer_name: string; rang: number; stopps_pro_km: number; rank_delta: number; ampel: 'gruen' | 'gelb' | 'rot'; alert_bottom: boolean; }
interface ApiData { fahrer: FahrerRow[]; team_avg: number; bester_name: string; letzter_name: string; alert_count: number; gesamt: number; }

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, stopps_pro_km: 0.85, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, stopps_pro_km: 0.71, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, stopps_pro_km: 0.54, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, stopps_pro_km: 0.32, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg: 0.61, bester_name: 'Julia F.', letzter_name: 'Tim B.', alert_count: 1, gesamt: 4,
};

interface Props { locationId: string | null; }

export function DispatchPhase4132LieferdichteBoard({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-lieferdichte-ranking?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  const maxStkm = Math.max(...data.fahrer.map(f => f.stopps_pro_km), 0.01);
  const besterFahrer = data.fahrer[0];
  const letzterFahrer = data.fahrer[data.fahrer.length - 1];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-semibold text-gray-900">Lieferdichte-Ranking</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {!loading && data.alert_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-600 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" /> {data.alert_count} Alert{data.alert_count > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-emerald-50 rounded-lg p-2">
          <div className="text-[10px] text-emerald-600 font-medium mb-0.5">Dichteste</div>
          <div className="text-sm font-bold text-emerald-700 truncate">{data.bester_name}</div>
          <div className="text-xs text-emerald-600">{besterFahrer?.stopps_pro_km?.toFixed(2)} Stkm</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-[10px] text-gray-500 font-medium mb-0.5">Team-Ø</div>
          <div className="text-sm font-bold text-gray-700">{data.team_avg?.toFixed(2)} Stkm</div>
          <div className="text-xs text-gray-500">{data.gesamt} Fahrer</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2">
          <div className="text-[10px] text-red-600 font-medium mb-0.5">Niedrigste</div>
          <div className="text-sm font-bold text-red-700 truncate">{data.letzter_name}</div>
          <div className="text-xs text-red-600">{letzterFahrer?.stopps_pro_km?.toFixed(2)} Stkm</div>
        </div>
      </div>

      <div className="space-y-2">
        {data.fahrer.map((f) => {
          const barW = maxStkm > 0 ? (f.stopps_pro_km / maxStkm) * 100 : 0;
          const barColor = f.ampel === 'gruen' ? 'bg-emerald-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const tColor   = f.ampel === 'gruen' ? 'text-emerald-600' : f.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
          const DeltaIcon = f.rank_delta > 0 ? TrendingUp : f.rank_delta < 0 ? TrendingDown : Minus;
          const deltaColor = f.rank_delta > 0 ? 'text-emerald-500' : f.rank_delta < 0 ? 'text-red-400' : 'text-gray-400';
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-4 text-right">#{f.rang}</span>
                  <span className="text-xs font-medium text-gray-800 truncate max-w-[120px]">{f.fahrer_name}</span>
                  <DeltaIcon className={`w-3 h-3 ${deltaColor}`} />
                  {f.alert_bottom && <AlertTriangle className="w-3 h-3 text-red-400" />}
                </div>
                <span className={`text-xs font-bold ${tColor}`}>{f.stopps_pro_km?.toFixed(2)} Stkm</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${barW}%` }} />
              </div>
              {f.alert_bottom && (
                <p className="text-[10px] text-red-500 font-medium">Niedrige Lieferdichte!</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100">
        <span>Team-Ø {data.team_avg?.toFixed(2)} Stkm</span>
        <span>#1 = höchste Lieferdichte</span>
      </div>
    </div>
  );
}
