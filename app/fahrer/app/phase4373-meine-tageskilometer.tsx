'use client';

import { useState, useEffect, useCallback } from 'react';
import { Map, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  km: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_km: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, km: 48.2, rank_delta: 1, ampel: 'gruen', alert_bottom: false },
  ],
  team_avg_km: 32.0,
  gesamt: 4,
};

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase4373MeineTageskilometer({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-tageskilometer-ranking?location_id=${locationId}&driver_id=${driverId}`
      );
      if (res.ok) {
        const json = await res.json();
        if (!json.error) {
          const me = (json.fahrer as FahrerRow[]).find(f => f.fahrer_id === driverId);
          if (me) setData({ ...json, fahrer: [me] });
        }
      }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId, driverId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  if (!isOnline) return null;

  const me = data.fahrer[0];
  if (!me) return null;

  const ampelColor = me.ampel === 'gruen' ? 'text-blue-600' : me.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-600';
  const ampelBg    = me.ampel === 'gruen' ? 'bg-blue-50'   : me.ampel === 'gelb' ? 'bg-yellow-50'   : 'bg-red-50';
  // INVERTED rank_delta: >0 = verbessert = TrendingUp emerald
  const Delta  = me.rank_delta > 0 ? TrendingUp : me.rank_delta < 0 ? TrendingDown : Minus;
  const dColor = me.rank_delta > 0 ? 'text-emerald-500' : me.rank_delta < 0 ? 'text-red-400' : 'text-gray-400';

  const coaching =
    me.ampel === 'rot'
      ? 'Tipp: Deine heutigen Kilometer sind niedrig. Mehr Touren übernehmen steigert deine Tagesleistung!'
      : me.ampel === 'gelb'
      ? 'Gut unterwegs! Noch ein paar Touren und du erreichst die Spitze des Teams.'
      : 'Stark! Du fährst heute die meisten Kilometer — top Tagesleistung!';

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${ampelBg} border-gray-200`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-900">Meine Tageskilometer</span>
        </div>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
      </div>

      <div className="flex items-end gap-3">
        <span className={`text-5xl font-extrabold ${ampelColor}`}>{me.km.toFixed(1)}</span>
        <div className="pb-1 space-y-0.5">
          <span className="text-sm text-gray-500">km heute</span>
          <div className="flex items-center gap-1">
            <span className="text-2xl font-bold text-gray-700">#{me.rang}</span>
            <Delta className={`w-4 h-4 ${dColor}`} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>Team-Ø: <span className="font-semibold text-gray-700">{data.team_avg_km.toFixed(1)} km</span></span>
        <span>{data.gesamt} Fahrer im Ranking</span>
      </div>

      <div className="bg-white/70 rounded-lg px-3 py-2">
        <p className="text-xs text-gray-700">{coaching}</p>
      </div>
    </div>
  );
}
