'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  endzeit_str: string;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_str: string;
  fruehester_name: string;
  alert_count: number;
}

const AMPEL_TEXT: Record<string, string> = {
  gruen: 'text-green-600',
  gelb: 'text-yellow-600',
  rot: 'text-red-600',
};

export function KitchenPhase3550SchichtEndzeitTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const url = locationId
        ? `/api/delivery/admin/fahrer-schicht-endzeit?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-schicht-endzeit';
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
        <Clock className="w-4 h-4 text-orange-500" />
        <span className="text-sm font-semibold text-gray-800">Schicht-Ende</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-600">
            <AlertTriangle className="w-3 h-3" /> Lange Schicht!
          </span>
        )}
      </div>

      <div className="text-xs text-gray-500">
        Frühestes Ende: <span className="font-semibold text-green-700">{data.fahrer[0]?.fahrer_name} {data.fahrer[0]?.endzeit_str}</span>
      </div>

      <div className="space-y-1">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-2 text-xs">
            <span className="w-5 text-center font-bold text-gray-400">#{f.rang}</span>
            <span className="flex-1 truncate text-gray-700">{f.fahrer_name}</span>
            <span className={`font-semibold ${AMPEL_TEXT[f.ampel]}`}>{f.endzeit_str}</span>
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
        <span>Team-Ø {data.team_avg_str}</span>
        <span>Ziel: pünktlich</span>
      </div>
    </div>
  );
}
