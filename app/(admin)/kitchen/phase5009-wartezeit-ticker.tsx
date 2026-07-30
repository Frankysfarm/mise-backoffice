'use client';

import { useEffect, useState } from 'react';
import { Timer, AlertTriangle } from 'lucide-react';

interface ApiResponse {
  ranking: Array<{
    rang: number;
    driver_id: string;
    name: string;
    avg_wartezeit_min: number;
    ampel: 'gruen' | 'gelb' | 'rot';
    alert: string | null;
  }>;
  team_avg: number;
}

export function KitchenPhase5009WartezeitTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-wartezeit-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-wartezeit-ranking';
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

  const top = data.ranking[0];
  const alertCount = data.ranking.filter(r => r.alert).length;

  return (
    <div className="rounded-xl border border-purple-700 bg-purple-900/60 px-4 py-3 mb-3 flex items-center gap-3">
      <Timer className="w-4 h-4 text-purple-300 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-400">Wartezeit-Ranking — Kürzeste Wartezeit</div>
        <div className="text-sm font-bold text-purple-100 truncate">
          #{top?.rang} {top?.name} — {top?.avg_wartezeit_min} min
        </div>
        <div className="text-xs text-gray-500">Team-Ø: {data.team_avg} min · Ziel ≤5 min</div>
      </div>
      {alertCount > 0 && (
        <div className="flex items-center gap-1 text-xs text-red-400 shrink-0">
          <AlertTriangle className="w-3 h-3" />
          {alertCount}
        </div>
      )}
    </div>
  );
}
