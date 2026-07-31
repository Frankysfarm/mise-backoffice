'use client';

import { useEffect, useState } from 'react';
import { Route, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  driver_id: string;
  name: string;
  rang: number;
  avg_km_pro_tour: number;
  alert: string | null;
}

interface ApiResponse {
  ranking: FahrerRow[];
  team_avg: number;
}

const MOCK: ApiResponse = {
  ranking: [
    { driver_id: 'm1', name: 'Tim B.',   rang: 1, avg_km_pro_tour: 18.4, alert: null },
    { driver_id: 'm2', name: 'Sara K.',  rang: 2, avg_km_pro_tour: 15.2, alert: null },
    { driver_id: 'm3', name: 'Max M.',   rang: 3, avg_km_pro_tour: 12.7, alert: null },
    { driver_id: 'm4', name: 'Julia F.', rang: 4, avg_km_pro_tour:  9.3, alert: 'Wenige Kilometer!' },
  ],
  team_avg: 13.9,
};

export function KitchenPhase5353KmTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    const res = await fetch(
      `/api/delivery/admin/fahrer-km-ranking?location_id=${locationId}`
    ).catch(() => null);
    if (res?.ok) setData(await res.json());
    else setData(MOCK);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data?.ranking?.length) return null;

  const top = data.ranking[0];
  const alerts = data.ranking.filter(f => f.alert).length;

  return (
    <div className="rounded-xl border border-blue-700 bg-blue-900/50 px-4 py-3 mb-3 flex items-center gap-3">
      <Route className="w-4 h-4 text-blue-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-400">km-Ranking (30 Tage) — Meiste km</div>
        <div className="text-sm font-bold text-blue-100 truncate">
          #{top.rang} {top.name} — {top.avg_km_pro_tour.toFixed(1)} km/Tour
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5">
          Team-Ø: {data.team_avg.toFixed(1)} km · {data.ranking.length} Fahrer erfasst
          {alerts > 0 && (
            <span className="ml-2 text-red-400 inline-flex items-center gap-0.5">
              <AlertTriangle className="w-3 h-3" />
              {alerts} niedrig
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
