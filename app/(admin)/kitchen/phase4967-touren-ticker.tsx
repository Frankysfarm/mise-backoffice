'use client';

import { useEffect, useState } from 'react';
import { Route, AlertTriangle } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    touren_anzahl: number;
    ampel: 'gruen' | 'gelb' | 'rot';
  }>;
  team_avg_touren: number;
  alert_count: number;
}

export function KitchenPhase4967TourenTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-touren-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-touren-ranking';
    const res = await fetch(url);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return null;

  const top = data.fahrer[0];

  return (
    <div className="rounded-xl border border-blue-700 bg-blue-900/60 px-4 py-3 mb-3 flex items-center gap-3">
      <Route className="w-4 h-4 text-blue-300 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-400">Touren-Ranking — Champion</div>
        <div className="text-sm font-bold text-blue-100 truncate">
          #{top?.rang} {top?.fahrer_name} — {top?.touren_anzahl} Touren
        </div>
        <div className="text-xs text-gray-500">Team-Ø: {data.team_avg_touren} Touren · Ziel ≥25/Monat</div>
      </div>
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-xs text-blue-300 shrink-0">
          <AlertTriangle className="w-3 h-3" />
          {data.alert_count}
        </div>
      )}
    </div>
  );
}
