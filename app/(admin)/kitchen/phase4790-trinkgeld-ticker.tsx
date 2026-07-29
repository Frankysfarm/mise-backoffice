'use client';

import { useEffect, useState } from 'react';
import { Euro, AlertTriangle } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    avg_trinkgeld_eur: number;
    ampel: 'gruen' | 'gelb' | 'rot';
  }>;
  team_avg_eur: number;
  bester_name: string;
  alert_count: number;
}

export function KitchenPhase4790TrinkgeldTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-trinkgeld-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-trinkgeld-ranking';
    const res = await fetch(url);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!data) return null;

  const best = data.fahrer[0];

  return (
    <div className="rounded-xl border border-indigo-800 bg-indigo-950/40 p-3 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <Euro className="w-4 h-4 text-indigo-400" />
        <span className="text-xs font-semibold text-indigo-300">Trinkgeld-Ranking</span>
      </div>

      {best && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">#1</span>
          <span className="text-sm font-bold text-green-400 truncate">{best.fahrer_name}</span>
          <span className="text-sm font-bold text-indigo-200 ml-auto">{best.avg_trinkgeld_eur.toFixed(2)} €</span>
        </div>
      )}

      <div className="flex items-center justify-between mt-2 text-xs text-gray-400">
        <span>Team-Ø: <span className="text-indigo-300 font-medium">{data.team_avg_eur.toFixed(2)} €</span></span>
        {data.alert_count > 0 && (
          <span className="flex items-center gap-1 text-red-400">
            <AlertTriangle className="w-3 h-3" />
            {data.alert_count} unter 1,50 €
          </span>
        )}
      </div>
    </div>
  );
}
