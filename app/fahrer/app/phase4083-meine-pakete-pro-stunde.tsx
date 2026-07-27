'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface ApiData { pakete_pro_stunde: number; rang: number; rank_delta: number; ampel: 'gruen' | 'gelb' | 'rot'; team_avg: number; fahrer_count: number; }

const MOCK: ApiData = { pakete_pro_stunde: 7.1, rang: 2, rank_delta: 0, ampel: 'gruen', team_avg: 6.3, fahrer_count: 4 };

interface Props { driverId: string; locationId: string | null; isOnline: boolean; }

export function FahrerPhase4083MeinePaketeProStunde({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId || !locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-pakete-pro-stunde-ranking?location_id=${locationId}&driver_id=${driverId}`);
      if (res.ok) {
        const json = await res.json();
        if (!json.error && json.fahrer) {
          const me = json.fahrer.find((f: { fahrer_id: string }) => f.fahrer_id === driverId) ?? json.fahrer[0];
          if (me) setData({ pakete_pro_stunde: me.pakete_pro_stunde, rang: me.rang, rank_delta: me.rank_delta, ampel: me.ampel, team_avg: json.team_avg, fahrer_count: json.gesamt });
        }
      }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [driverId, locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  if (!isOnline) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-xs">Pakete/h-Ranking nicht verfügbar (offline)</span>
      </div>
    );
  }

  const valueColor = data.ampel === 'gruen' ? 'text-emerald-600' : data.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
  const coaching = data.ampel === 'gruen' ? 'Top-Leistung – du lieferst die meisten Pakete pro Stunde!' : data.ampel === 'gelb' ? 'Tipp: Optimiere deine Routen für mehr Pakete pro Stunde.' : 'Achtung: Deine Pakete/h-Rate liegt deutlich unter dem Team.';
  const DeltaIcon = data.rank_delta > 0 ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : data.rank_delta < 0 ? <TrendingDown className="w-4 h-4 text-red-400" /> : <Minus className="w-4 h-4 text-gray-300" />;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-semibold text-gray-900">Meine Pakete/h</span>
        </div>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
      </div>
      <div className="flex items-end gap-3">
        <span className={`text-5xl font-bold tabular-nums ${valueColor}`}>{data.pakete_pro_stunde?.toFixed(1)}<span className="text-2xl font-semibold ml-1">/h</span></span>
        <div className="flex flex-col items-start pb-1">
          <div className="flex items-center gap-1">
            {DeltaIcon}
            <span className={`text-2xl font-semibold ${valueColor}`}>#{data.rang}</span>
          </div>
          <span className="text-[10px] text-gray-400">von {data.fahrer_count} Fahrern</span>
        </div>
      </div>
      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">{coaching}</div>
      <div className="flex justify-between text-[11px] text-gray-400 px-1">
        <span>Team-Ø {data.team_avg?.toFixed(1)} pkg/h</span>
        <span>Rang 1 = meiste Pakete/h</span>
      </div>
    </div>
  );
}
