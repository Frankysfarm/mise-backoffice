'use client';

import { useEffect, useState } from 'react';
import { Zap, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  effizienz_score: number;
  touren_pro_stunde: number;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_score: number;
  alert_count: number;
  gesamt: number;
}

export function KitchenPhase5313TourenEffizienzTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-touren-effizienz-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-touren-effizienz-ranking';
    const res = await fetch(url).catch(() => null);
    if (res?.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data?.fahrer?.length) return null;

  const top = data.fahrer[0];

  return (
    <div className="rounded-xl border border-yellow-700 bg-yellow-900/50 px-4 py-3 mb-3 flex items-center gap-3">
      <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-400">Touren-Effizienz — Effizienteste/r</div>
        <div className="text-sm font-bold text-yellow-100 truncate">
          #{top.rang} {top.fahrer_name} — Score {top.effizienz_score} ({top.touren_pro_stunde}/h)
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5">
          Team-Ø Score: {data.team_avg_score} · {data.gesamt} Fahrer erfasst
          {data.alert_count > 0 && (
            <span className="ml-2 text-red-400 inline-flex items-center gap-0.5">
              <AlertTriangle className="w-3 h-3" />
              {data.alert_count} Niedrig
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
