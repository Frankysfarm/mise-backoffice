'use client';

import { useEffect, useState } from 'react';
import { Moon, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  touren_pro_std: number;
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_tph: number;
  alert_count: number;
  gesamt: number;
}

export function KitchenPhase5270AbendprodTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-abendprod-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-abendprod-ranking';
    const res = await fetch(url);
    if (res.ok) setData(await res.json());
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
    <div className="rounded-xl border border-indigo-700 bg-indigo-900/60 px-4 py-3 mb-3 flex items-center gap-3">
      <Moon className="w-4 h-4 text-indigo-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-400">Abendproduktivität — Meister</div>
        <div className="text-sm font-bold text-indigo-100 truncate">
          #{top.rang} {top.fahrer_name} — {top.touren_pro_std.toFixed(1)} T/h
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5">
          Team-Ø: {data.team_avg_tph.toFixed(1)} T/h · {data.gesamt} Fahrer erfasst
          {data.alert_count > 0 && (
            <span className="ml-2 text-red-400 inline-flex items-center gap-0.5">
              <AlertTriangle className="w-3 h-3" />
              {data.alert_count} Hoch-Alert
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
