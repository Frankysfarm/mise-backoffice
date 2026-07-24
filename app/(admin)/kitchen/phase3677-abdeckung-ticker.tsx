'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  zonen_anzahl: number;
  rang: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_low: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  alert_count: number;
}

const AMPEL_COLOR: Record<string, string> = {
  gruen: 'text-emerald-600',
  gelb: 'text-orange-500',
  rot: 'text-red-600',
};

export function KitchenPhase3677AbdeckungTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-abdeckung?location_id=${locationId}`);
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

  if (loading) return <div className="animate-pulse h-32 bg-gray-100 rounded-xl" />;
  if (!data || !locationId) return null;

  const sorted = [...data.fahrer].sort((a, b) => b.zonen_anzahl - a.zonen_anzahl);
  const bester = sorted[0];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-blue-500" />
        <span className="font-semibold text-gray-900 text-sm">Liefergebiet-Abdeckung</span>
        {data.alert_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full ml-auto">
            <AlertTriangle className="w-3 h-3" /> Geringe Abdeckung!
          </span>
        )}
      </div>

      {bester && (
        <div className="flex items-center gap-2 bg-blue-50 rounded-lg px-2 py-1.5">
          <span className="text-base">🥇</span>
          <span className="font-semibold text-blue-800 text-sm truncate">{bester.fahrer_name}</span>
          <span className="ml-auto font-bold text-blue-700 text-sm">{bester.zonen_anzahl} Zonen</span>
        </div>
      )}

      <div className="space-y-1">
        {sorted.slice(1).map((f) => (
          <div key={f.fahrer_id} className="flex items-center gap-2 px-1 py-0.5">
            <span className="text-xs text-gray-400 w-5 text-right">#{f.rang}</span>
            <span className="text-sm text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
            <span className={`text-sm font-semibold ${AMPEL_COLOR[f.ampel]}`}>{f.zonen_anzahl}</span>
            <span className="w-5 flex justify-end">
              {f.rank_delta > 0 ? (
                <TrendingUp className="w-3 h-3 text-emerald-500" />
              ) : f.rank_delta < 0 ? (
                <TrendingDown className="w-3 h-3 text-red-500" />
              ) : (
                <Minus className="w-3 h-3 text-gray-300" />
              )}
            </span>
          </div>
        ))}
      </div>

      <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-gray-100">
        <span>Team-Ø: {data.team_avg.toFixed(1)} Zonen</span>
        <span>Ziel: ≥3 Zonen</span>
      </div>
    </div>
  );
}
