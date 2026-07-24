'use client';

import { useState, useEffect, useCallback } from 'react';
import { Navigation, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  gesamt_km: number;
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_gesamt_km: number;
  alert_count: number;
}

export function KitchenPhase3617KilometerstandTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-kilometerstand?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {}
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!data || !locationId) return null;

  const sorted = [...data.fahrer].sort((a, b) => b.gesamt_km - a.gesamt_km);
  const meister = sorted[0];
  const total = sorted.length;
  const teamAvg = total > 0 ? Math.round((data.team_gesamt_km / total) * 10) / 10 : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Navigation className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-sm text-gray-900">Kilometerstand Ticker</span>
        </div>
        <div className="text-xs text-gray-500">
          <span className="font-bold text-blue-700">#1 {meister?.fahrer_name}</span>
          <span className="ml-1">{meister?.gesamt_km.toFixed(1) ?? '–'} km</span>
        </div>
      </div>

      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
          <AlertTriangle className="w-3 h-3" />
          <span>Hohe Kilometerleistung!</span>
        </div>
      )}

      <div className="space-y-1">
        {sorted.map((f, i) => (
          <div key={f.fahrer_id} className="flex items-center gap-2 text-xs">
            <span className="text-gray-400 w-4">#{i + 1}</span>
            <span className="flex-1 truncate font-medium text-gray-800">{f.fahrer_name}</span>
            <span className={`font-bold w-16 text-right ${f.ampel === 'gruen' ? 'text-emerald-600' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-600'}`}>
              {f.gesamt_km.toFixed(1)} km
            </span>
            {f.trend_delta < 0 ? (
              <TrendingDown className="w-3 h-3 text-emerald-500" />
            ) : f.trend_delta > 0 ? (
              <TrendingUp className="w-3 h-3 text-red-400" />
            ) : (
              <Minus className="w-3 h-3 text-gray-300" />
            )}
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-400 text-center">Team-Ø: {teamAvg.toFixed(1)} km · Ziel ≤120 km/Tag</div>
    </div>
  );
}
