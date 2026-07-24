'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerStreckeRow {
  fahrer_id: string;
  fahrer_name: string;
  km_pro_tour: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
}

interface ApiResponse {
  fahrer: FahrerStreckeRow[];
  team_avg_km: number;
  alert_count: number;
}

export function KitchenPhase3642LieferstreckeProTourTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-lieferstrecke-pro-tour?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {}
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!data || !locationId) return null;

  // ascending: rank 1 = shortest km/tour = most efficient
  const sorted = [...data.fahrer].sort((a, b) => a.km_pro_tour - b.km_pro_tour);
  const effizientester = sorted[0];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-cyan-500" />
        <span className="text-sm font-semibold text-gray-900">Strecke/Tour</span>
        {effizientester && (
          <span className="ml-auto text-sm font-bold text-cyan-700 truncate max-w-[130px]">
            {effizientester.fahrer_name} · {effizientester.km_pro_tour.toFixed(1)} km
          </span>
        )}
      </div>

      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <AlertTriangle className="w-3 h-3" />
          <span>{data.alert_count} Fahrer mit hoher Strecke/Tour!</span>
        </div>
      )}

      <div className="space-y-1">
        {sorted.map((f, i) => (
          <div key={f.fahrer_id} className="flex items-center gap-2 text-xs">
            <span className="w-5 text-gray-400 font-bold">#{i + 1}</span>
            <span className="flex-1 text-gray-800 truncate">{f.fahrer_name}</span>
            <span className={`font-bold w-14 text-right ${f.ampel === 'gruen' ? 'text-cyan-600' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-600'}`}>
              {f.km_pro_tour.toFixed(1)} km
            </span>
            {f.rank_delta < 0 ? (
              <TrendingUp className="w-3 h-3 text-emerald-600" />
            ) : f.rank_delta > 0 ? (
              <TrendingDown className="w-3 h-3 text-red-500" />
            ) : (
              <Minus className="w-3 h-3 text-gray-400" />
            )}
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-400 text-center">
        Team-Ø {data.team_avg_km.toFixed(1)} km · Ziel ≤6 km/Tour
      </div>
    </div>
  );
}
