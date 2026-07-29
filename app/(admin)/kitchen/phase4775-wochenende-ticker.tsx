'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, AlertTriangle } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    avg_euro_tour: number;
    ampel: 'gruen' | 'gelb' | 'rot';
  }>;
  team_avg_euro: number;
  bester_name: string;
  alert_count: number;
}

export function KitchenPhase4775WochenendetTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-wochenend-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-wochenend-ranking';
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
    <div className="rounded-xl border border-teal-800 bg-teal-950/40 px-4 py-3 mb-3 flex items-center gap-3">
      <CalendarDays className="w-4 h-4 text-teal-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-400">Wochenende — Effizientester Fahrer</div>
        <div className="text-sm font-bold text-teal-300 truncate">
          #{top?.rang} {top?.fahrer_name} — {top?.avg_euro_tour.toFixed(2)}€/Tour
        </div>
        <div className="text-xs text-gray-500">Team-Ø: {data.team_avg_euro.toFixed(2)}€/Tour</div>
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
