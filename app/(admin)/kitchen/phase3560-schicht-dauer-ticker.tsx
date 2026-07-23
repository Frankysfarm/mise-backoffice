'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  dauer_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  kuerzester_name: string;
  alert_count: number;
}

const AMPEL_TEXT: Record<string, string> = {
  gruen: 'text-green-600',
  gelb: 'text-yellow-600',
  rot: 'text-red-600',
};

export function KitchenPhase3560SchichtDauerTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const url = locationId
        ? `/api/delivery/admin/fahrer-schicht-dauer?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-schicht-dauer';
      const res = await fetch(url);
      if (!res.ok) return;
      setData(await res.json());
    } catch {
      // keep stale
    }
  }, [locationId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (!data) return null;

  return (
    <div className="rounded-xl border bg-white shadow-sm p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Timer className="w-4 h-4 text-purple-500" />
        <span className="text-sm font-semibold text-gray-800">Schicht-Dauer</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-600">
            <AlertTriangle className="w-3 h-3" /> Lange Schicht-Dauer!
          </span>
        )}
      </div>

      <div className="text-xs text-gray-500">
        Kürzester: <span className="font-semibold text-green-700">{data.fahrer[0]?.fahrer_name} {data.fahrer[0]?.dauer_min} min</span>
      </div>

      <div className="space-y-1">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-2 text-xs">
            <span className="w-5 text-center font-bold text-gray-400">#{f.rang}</span>
            <span className="flex-1 truncate text-gray-700">{f.fahrer_name}</span>
            <span className={`font-semibold ${AMPEL_TEXT[f.ampel]}`}>{f.dauer_min} min</span>
            <span className="w-4">
              {f.rank_delta === 0 ? (
                <Minus className="w-3 h-3 text-gray-400" />
              ) : f.rank_delta < 0 ? (
                <TrendingUp className="w-3 h-3 text-green-500" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-500" />
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="flex justify-between text-xs text-gray-400 pt-1 border-t">
        <span>Team-Ø {data.team_avg} min</span>
        <span>Ziel: effizient</span>
      </div>
    </div>
  );
}
