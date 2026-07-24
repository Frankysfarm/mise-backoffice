'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  avg_bestellwert: number;
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

export function KitchenPhase3667BestellwertTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-bestellwert?location_id=${locationId}`);
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

  const sorted = [...data.fahrer].sort((a, b) => b.avg_bestellwert - a.avg_bestellwert);
  const bester = sorted[0];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-emerald-500" />
        <span className="font-semibold text-gray-900 text-sm">Ø Bestellwert</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-600">
            <AlertTriangle className="w-3 h-3" /> {data.alert_count}
          </span>
        )}
      </div>

      {bester && (
        <div className="bg-emerald-50 rounded-lg px-3 py-2 flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-500">Bester #1</span>
            <div className="font-semibold text-gray-900 text-sm">{bester.fahrer_name}</div>
          </div>
          <span className="text-lg font-black text-emerald-600">{bester.avg_bestellwert.toFixed(2)} €</span>
        </div>
      )}

      {data.alert_count > 0 && (
        <div className="text-xs text-red-600 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" /> Niedriger Bestellwert!
        </div>
      )}

      <div className="space-y-1">
        {sorted.map((f) => {
          const DeltaIcon = f.rank_delta > 0 ? TrendingUp : f.rank_delta < 0 ? TrendingDown : Minus;
          const deltaColor = f.rank_delta > 0 ? 'text-emerald-500' : f.rank_delta < 0 ? 'text-red-500' : 'text-gray-400';
          return (
            <div key={f.fahrer_id} className="flex items-center gap-2 text-xs">
              <span className="text-gray-400 w-5">#{f.rang}</span>
              <span className="flex-1 truncate text-gray-700">{f.fahrer_name}</span>
              <span className={`font-semibold ${AMPEL_COLOR[f.ampel]}`}>{f.avg_bestellwert.toFixed(2)} €</span>
              <DeltaIcon className={`w-3 h-3 ${deltaColor}`} />
              {f.rank_delta !== 0 && (
                <span className={`${deltaColor} w-6`}>
                  {f.rank_delta > 0 ? `+${f.rank_delta}` : f.rank_delta}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-xs text-gray-400 border-t pt-2">
        <span>Team-Ø: {data.team_avg.toFixed(2)} €</span>
        <span>Ziel ≥35 €</span>
      </div>
    </div>
  );
}
