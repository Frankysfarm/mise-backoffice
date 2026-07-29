'use client';

import { useEffect, useState } from 'react';
import { WifiOff, Zap } from 'lucide-react';

interface ApiResponse {
  fahrer: { fahrer_name: string; effizienz_pro_stunde: number; rang: number }[];
  team_avg_effizienz: number;
  beste_name: string;
  alert_count: number;
}

export function KitchenPhase4726SchichtEffizienzTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-schicht-effizienz-ranking${params}`);
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
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-xs">Schicht-Effizienz-Ticker nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 animate-pulse h-24" />;
  }

  const leader = data.fahrer[0];

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-white dark:bg-gray-900 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Zap className="w-4 h-4 text-amber-700 dark:text-amber-400" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Schicht-Effizienz-Ticker</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="bg-amber-50 dark:bg-amber-950 rounded-lg px-3 py-1.5 flex items-baseline gap-1">
          <span className="text-[9px] text-amber-700 dark:text-amber-400">#1</span>
          <span className="text-lg font-extrabold text-amber-800 dark:text-amber-300">
            {leader?.effizienz_pro_stunde.toFixed(0)}€/h
          </span>
        </div>
        <span className="text-[10px] text-gray-600 dark:text-gray-400 font-medium">{leader?.fahrer_name ?? '–'}</span>
      </div>

      {data.alert_count > 0 && (
        <div className="text-[10px] text-amber-600 dark:text-amber-400">
          {data.alert_count} Fahrer mit niedriger Schicht-Effizienz (&lt;20€/h)
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-1.5">
        <span>Team-Ø: <span className="font-bold text-gray-700 dark:text-gray-300">{data.team_avg_effizienz.toFixed(1)}€/h</span></span>
        <span className="text-[10px] text-gray-400">30-Min-Update</span>
      </div>
    </div>
  );
}
