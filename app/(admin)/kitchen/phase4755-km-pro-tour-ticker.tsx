'use client';

import { useEffect, useState } from 'react';
import { Navigation, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  driver_id: string;
  name: string;
  rang: number;
  avg_km_pro_tour: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: string | null;
}

interface ApiResponse {
  ranking: FahrerRow[];
  team_avg: number;
}

export function KitchenPhase4755KmProTourTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-km-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-km-ranking';
    const res = await fetch(url);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!data) return null;

  const ranking = data.ranking ?? [];
  const best = ranking[0];
  const alertCount = ranking.filter(f => f.alert !== null).length;

  return (
    <div className="rounded-xl border border-indigo-800 bg-indigo-950/40 px-4 py-3 mb-3 flex items-center gap-3">
      <Navigation className="w-4 h-4 text-indigo-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-400">KM/Tour Effizienz — Bester</div>
        <div className="text-sm font-bold text-green-400 truncate">
          #{best?.rang} {best?.name} — {best?.avg_km_pro_tour.toFixed(1)} km
        </div>
        <div className="text-xs text-gray-500">Team-Ø: {data.team_avg.toFixed(1)} km/Tour</div>
      </div>
      {alertCount > 0 && (
        <div className="flex items-center gap-1 text-xs text-red-300 shrink-0">
          <AlertTriangle className="w-3 h-3" />
          {alertCount}
        </div>
      )}
    </div>
  );
}
