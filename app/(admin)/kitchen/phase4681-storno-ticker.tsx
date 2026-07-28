'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, WifiOff } from 'lucide-react';

interface ApiResponse {
  fahrer: { fahrer_name: string; storno_pct: number; ampel: string }[];
  team_avg_pct: number;
  bester_name: string;
  alert_count: number;
}

export function KitchenPhase4681StornoTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-storno-ranking${params}`);
        if (!res.ok) throw new Error('fetch failed');
        const json: ApiResponse = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (error) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 flex items-center gap-1.5 text-gray-400">
        <WifiOff className="w-3.5 h-3.5" />
        <span className="text-[10px]">Storno-Daten nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-2 animate-pulse h-12" />;
  }

  const best = data.fahrer[0];

  return (
    <div className="rounded-xl border border-orange-200 dark:border-orange-900 bg-orange-50 dark:bg-orange-950 px-3 py-2 flex items-center gap-3 flex-wrap">
      <span className="text-[10px] font-semibold text-orange-900 dark:text-orange-200 uppercase tracking-wide shrink-0">
        Storno
      </span>
      {best && (
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[9px] text-gray-500">#1</span>
          <span className="text-[11px] font-bold text-orange-900 dark:text-orange-200">{best.fahrer_name}</span>
          <span className="text-[11px] font-black text-green-600 dark:text-green-400">{best.storno_pct.toFixed(1)}%</span>
        </div>
      )}
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[9px] text-gray-500">Team-Ø</span>
        <span className="text-[11px] font-bold text-orange-900 dark:text-orange-200">{data.team_avg_pct.toFixed(1)}%</span>
      </div>
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 rounded-full px-2 py-0.5 shrink-0">
          <AlertTriangle className="w-3 h-3" />
          <span className="text-[9px] font-semibold">{data.alert_count} Hohe Storno</span>
        </div>
      )}
    </div>
  );
}
