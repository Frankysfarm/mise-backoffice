'use client';

import { useEffect, useState } from 'react';
import { Moon, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  abend_pct: number;
  alert_wenig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  alert_count: number;
  gesamt: number;
}

export function KitchenPhase5282AbendAnteilTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-abend-anteil-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-abend-anteil-ranking';
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
    <div className="rounded-xl border border-amber-700 bg-amber-900/60 px-4 py-3 mb-3 flex items-center gap-3">
      <Moon className="w-4 h-4 text-amber-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-400">Abendanteil — Höchste</div>
        <div className="text-sm font-bold text-amber-100 truncate">
          #{top.rang} {top.fahrer_name} — {top.abend_pct.toFixed(0)}%
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5">
          Team-Ø: {data.team_avg.toFixed(0)}% · {data.gesamt} Fahrer erfasst
          {data.alert_count > 0 && (
            <span className="ml-2 text-red-400 inline-flex items-center gap-0.5">
              <AlertTriangle className="w-3 h-3" />
              {data.alert_count} Wenig-Alert
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
