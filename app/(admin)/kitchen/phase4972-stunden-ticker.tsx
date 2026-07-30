'use client';

import { useEffect, useState } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    stunden_gesamt: number;
    ampel: 'gruen' | 'gelb' | 'rot';
  }>;
  team_avg_stunden: number;
  alert_count: number;
}

export function KitchenPhase4972StundenTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-stunden-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-stunden-ranking';
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
    <div className="rounded-xl border border-violet-700 bg-violet-900/60 px-4 py-3 mb-3 flex items-center gap-3">
      <Clock className="w-4 h-4 text-violet-300 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-400">Stunden-Ranking — Champion</div>
        <div className="text-sm font-bold text-violet-100 truncate">
          #{top?.rang} {top?.fahrer_name} — {top?.stunden_gesamt}h
        </div>
        <div className="text-xs text-gray-500">Team-Ø: {data.team_avg_stunden}h · Ziel ≥40h/Monat</div>
      </div>
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-xs text-violet-300 shrink-0">
          <AlertTriangle className="w-3 h-3" />
          {data.alert_count}
        </div>
      )}
    </div>
  );
}
