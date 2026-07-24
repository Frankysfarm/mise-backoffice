'use client';

import { useState, useEffect, useCallback } from 'react';
import { Route, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  touren_pro_schicht: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  alert_count: number;
}

const AMPEL_COLOR: Record<string, string> = {
  gruen: 'text-emerald-600',
  gelb: 'text-yellow-600',
  rot: 'text-red-600',
};

export function KitchenPhase3737TourenProSchichtTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-touren-pro-schicht?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (loading) return <div className="animate-pulse h-28 bg-gray-100 rounded-xl" />;
  if (!data || !locationId) return null;

  const sorted = [...data.fahrer].sort((a, b) => b.touren_pro_schicht - a.touren_pro_schicht);
  const bester = sorted[0];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-sm text-gray-900">Touren pro Schicht</span>
        </div>
        {bester && (
          <div className="flex items-center gap-1 text-xs text-emerald-700 font-medium">
            <span>🥇 {bester.fahrer_name}</span>
            <span className="font-bold">{bester.touren_pro_schicht}</span>
          </div>
        )}
      </div>

      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <AlertTriangle className="w-3 h-3" />
          <span>Wenige Touren/Schicht!</span>
        </div>
      )}

      <div className="space-y-1">
        {sorted.map((f, i) => (
          <div key={f.fahrer_id} className="flex items-center gap-2 text-xs">
            <span className="text-gray-400 w-5 font-mono">#{i + 1}</span>
            <span className="flex-1 text-gray-800 truncate">{f.fahrer_name}</span>
            <span className={`font-bold w-8 text-right ${AMPEL_COLOR[f.ampel]}`}>{f.touren_pro_schicht}</span>
            {f.rank_delta > 0 ? (
              <TrendingUp className="w-3 h-3 text-emerald-600" />
            ) : f.rank_delta < 0 ? (
              <TrendingDown className="w-3 h-3 text-red-500" />
            ) : (
              <Minus className="w-3 h-3 text-gray-300" />
            )}
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-400 text-center">Team-Ø {data.team_avg} · Ziel ≥4 Touren/Schicht</div>
    </div>
  );
}
