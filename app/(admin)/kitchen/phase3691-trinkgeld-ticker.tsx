'use client';

import { useState, useEffect, useCallback } from 'react';
import { Banknote, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_tip_eur: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_eur: number;
  alert_count: number;
}

const AMPEL_COLOR: Record<string, string> = {
  gruen: 'text-emerald-600',
  gelb: 'text-yellow-600',
  rot: 'text-red-600',
};

export function KitchenPhase3691TrinkgeldTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-trinkgeld-ranking?location_id=${locationId}`);
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

  const sorted = [...data.fahrer].sort((a, b) => b.avg_tip_eur - a.avg_tip_eur);
  const bester = sorted[0];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Banknote className="w-4 h-4 text-green-600" />
        <span className="font-semibold text-gray-900 text-sm">Trinkgeld Ranking</span>
        {data.alert_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full ml-auto">
            <AlertTriangle className="w-3 h-3" /> Geringes Trinkgeld!
          </span>
        )}
      </div>

      {bester && (
        <div className="flex items-center gap-2 bg-green-50 rounded-lg px-2 py-1.5">
          <span className="text-base">🥇</span>
          <span className="font-semibold text-green-800 text-sm truncate">{bester.fahrer_name}</span>
          <span className="ml-auto font-bold text-green-700 text-sm">{bester.avg_tip_eur.toFixed(2)} €</span>
        </div>
      )}

      <div className="space-y-1">
        {sorted.slice(1).map((f, i) => (
          <div key={f.fahrer_id} className="flex items-center gap-2 px-1 py-0.5">
            <span className="text-xs text-gray-400 w-5 text-right">#{i + 2}</span>
            <span className="text-sm text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
            <span className={`text-sm font-semibold ${AMPEL_COLOR[f.ampel]}`}>{f.avg_tip_eur.toFixed(2)} €</span>
            {f.rank_delta > 0 ? (
              <TrendingUp className="w-3 h-3 text-emerald-500" />
            ) : f.rank_delta < 0 ? (
              <TrendingDown className="w-3 h-3 text-red-500" />
            ) : (
              <Minus className="w-3 h-3 text-gray-400" />
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-between text-xs text-gray-500 pt-1 border-t border-gray-100">
        <span>Team-Ø: {data.team_avg_eur.toFixed(2)} €</span>
        <span>Ziel: ≥ 2.50 €</span>
      </div>
    </div>
  );
}
