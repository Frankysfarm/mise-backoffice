'use client';

import { useEffect, useState } from 'react';
import { BarChart2, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  driver_id: string;
  name: string;
  rang: number;
  avg_touren_pro_tag: number;
  alert: string | null;
}

interface ApiResponse {
  ranking: FahrerRow[];
  team_avg: number;
  alert_count: number;
}

export function KitchenPhase5226TourenProTagTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-touren-pro-tag-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-touren-pro-tag-ranking';
    const res = await fetch(url);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data?.ranking?.length) return null;

  const top = data.ranking[0];

  return (
    <div className="rounded-xl border border-cyan-700 bg-cyan-900/60 px-4 py-3 mb-3 flex items-center gap-3">
      <BarChart2 className="w-4 h-4 text-cyan-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-400">Ø Touren/Tag — Meiste</div>
        <div className="text-sm font-bold text-cyan-100 truncate">
          #{top.rang} {top.name} — {top.avg_touren_pro_tag.toFixed(1)}/Tag
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5">
          Team-Ø: {data.team_avg.toFixed(1)}/Tag
          {data.alert_count > 0 && (
            <span className="ml-2 text-red-400 inline-flex items-center gap-0.5">
              <AlertTriangle className="w-3 h-3" />
              {data.alert_count} Alert
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
