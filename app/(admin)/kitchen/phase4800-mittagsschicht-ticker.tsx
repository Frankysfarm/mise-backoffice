'use client';

import { useEffect, useState } from 'react';
import { Sun, AlertTriangle } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    mittagsschicht_anteil_pct: number;
    ampel: 'gruen' | 'gelb' | 'rot';
  }>;
  team_avg_pct: number;
  alert_count: number;
}

export function KitchenPhase4800MittagsschichtTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-mittagsschicht-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-mittagsschicht-ranking';
    const res = await fetch(url);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!data) return null;

  const top = data.fahrer[0];

  return (
    <div className="rounded-xl border border-lime-800 bg-lime-950/40 px-4 py-3 mb-3 flex items-center gap-3">
      <Sun className="w-4 h-4 text-lime-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-400">Mittagsschicht-Anteil — Champion</div>
        <div className="text-sm font-bold text-lime-300 truncate">
          #{top?.rang} {top?.fahrer_name} — {top?.mittagsschicht_anteil_pct.toFixed(1)}% Mittagsschicht
        </div>
        <div className="text-xs text-gray-500">Team-Ø: {data.team_avg_pct.toFixed(1)}%</div>
      </div>
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-xs text-red-300 shrink-0">
          <AlertTriangle className="w-3 h-3" />
          {data.alert_count}
        </div>
      )}
    </div>
  );
}
