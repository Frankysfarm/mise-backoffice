'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  wartezeit_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
  alert_top: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  alert_count: number;
}

export function KitchenPhase3682WartezeitProStoppTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-wartezeit-stopp-ranking?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {}
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!data || !locationId) return null;

  const sorted = [...data.fahrer].sort((a, b) => a.wartezeit_min - b.wartezeit_min);
  const schnellster = sorted[0];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-orange-500" />
        <span className="text-sm font-semibold text-gray-900">Wartezeit/Stopp</span>
        {schnellster && (
          <span className="ml-auto text-sm font-bold text-emerald-700 truncate max-w-[120px]">
            {schnellster.fahrer_name} · {schnellster.wartezeit_min.toFixed(1)} min
          </span>
        )}
      </div>

      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <AlertTriangle className="w-3 h-3" />
          <span>{data.alert_count} Fahrer mit hoher Wartezeit/Stopp!</span>
        </div>
      )}

      <div className="space-y-1">
        {sorted.map((f, i) => (
          <div key={f.fahrer_id} className="flex items-center gap-2 text-xs">
            <span className="w-5 text-gray-400 font-bold">#{i + 1}</span>
            <span className="flex-1 text-gray-800 truncate">{f.fahrer_name}</span>
            <span className={`font-bold w-14 text-right ${f.ampel === 'gruen' ? 'text-emerald-600' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-600'}`}>
              {f.wartezeit_min.toFixed(1)} min
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
        Team-Ø {data.team_avg.toFixed(1)} min · Ziel ≤3 min/Stopp
      </div>
    </div>
  );
}
