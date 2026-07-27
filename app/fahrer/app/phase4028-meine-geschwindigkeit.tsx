'use client';

import { useState, useEffect, useCallback } from 'react';
import { Gauge, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface ApiData {
  avg_kmh: number;
  rang: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  team_avg_kmh: number;
  ziel_kmh: number;
  fahrer_count: number;
}

const MOCK: ApiData = {
  avg_kmh: 25,
  rang: 2,
  rank_delta: 0,
  ampel: 'gruen',
  team_avg_kmh: 22,
  ziel_kmh: 25,
  fahrer_count: 4,
};

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase4028MeineGeschwindigkeit({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!driverId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ driver_id: driverId });
      if (locationId) params.set('location_id', locationId);
      const res = await fetch(`/api/delivery/admin/fahrer-geschwindigkeit-ranking?${params}`);
      if (res.ok) {
        const json = await res.json();
        if (json.fahrer_single) {
          setData({ ...json.fahrer_single, team_avg_kmh: json.team_avg_kmh, ziel_kmh: json.ziel_kmh, fahrer_count: json.gesamt });
        }
      }
    } catch {
      // Mock-Fallback
    } finally {
      setLoading(false);
    }
  }, [driverId, locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-xs">Geschwindigkeit nicht verfügbar (offline)</span>
      </div>
    );
  }

  const valueColor =
    data.ampel === 'gruen' ? 'text-emerald-600' :
    data.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';

  const coaching =
    data.ampel === 'gruen'
      ? 'Top – deine Durchschnittsgeschwindigkeit ist sehr gut!'
      : data.ampel === 'gelb'
      ? 'Tipp: Optimiere deine Routen für bessere Geschwindigkeit.'
      : 'Achtung: Deine Durchschnittsgeschwindigkeit ist zu niedrig.';

  const DeltaIcon =
    data.rank_delta < 0
      ? <TrendingUp className="w-4 h-4 text-emerald-500" />
      : data.rank_delta > 0
      ? <TrendingDown className="w-4 h-4 text-red-400" />
      : <Minus className="w-4 h-4 text-gray-300" />;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-900">Meine Geschwindigkeit</span>
        </div>
        {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
      </div>

      <div className="flex items-end gap-3">
        <span className={`text-5xl font-bold tabular-nums ${valueColor}`}>
          {data.avg_kmh}
        </span>
        <div className="flex flex-col items-start pb-1">
          <span className="text-base text-gray-500">km/h</span>
          <div className="flex items-center gap-1">
            {DeltaIcon}
            <span className={`text-2xl font-semibold ${valueColor}`}>#{data.rang}</span>
          </div>
          <span className="text-[10px] text-gray-400">von {data.fahrer_count} Fahrern</span>
        </div>
      </div>

      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2">{coaching}</div>

      <div className="flex justify-between text-[11px] text-gray-400 px-1">
        <span>Team-Ø {data.team_avg_kmh} km/h</span>
        <span>Ziel ≥{data.ziel_kmh ?? 25} km/h</span>
      </div>
    </div>
  );
}
