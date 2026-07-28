'use client';

import { useEffect, useState } from 'react';
import { Star, AlertTriangle, WifiOff } from 'lucide-react';

interface ApiResponse {
  fahrer: { fahrer_name: string; avg_rating: number; rang: number }[];
  team_avg_rating: number;
  alert_count: number;
  bester_name: string;
}

export function KitchenPhase4676BewertungTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-bewertung-ranking${params}`);
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
        <span className="text-xs">Bewertungs-Ticker nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 animate-pulse h-24" />;
  }

  const leader = data.fahrer[0];

  return (
    <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-gray-900 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Star className="w-4 h-4 text-rose-900 dark:text-rose-400 fill-rose-900 dark:fill-rose-400" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Bewertungs-Ticker</span>
      </div>

      {/* Leader */}
      <div className="flex items-center gap-2">
        <div className="bg-rose-50 dark:bg-rose-950 rounded-lg px-3 py-1.5 flex items-baseline gap-1">
          <span className="text-[9px] text-rose-700 dark:text-rose-400">#1</span>
          <span className="text-lg font-extrabold text-rose-800 dark:text-rose-300">{leader?.avg_rating?.toFixed(1) ?? '–'} ★</span>
        </div>
        <span className="text-[10px] text-gray-600 dark:text-gray-400 font-medium">{leader?.fahrer_name ?? '–'}</span>
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950 rounded-lg px-2 py-1">
          <AlertTriangle className="w-3 h-3 text-red-600 dark:text-red-400 shrink-0" />
          <span className="text-[10px] text-red-700 dark:text-red-300 font-medium">
            {data.alert_count} Fahrer unter 4.0 Sterne
          </span>
        </div>
      )}

      <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-1.5">
        <span>Team-Ø: <span className="font-bold text-gray-700 dark:text-gray-300">{data.team_avg_rating.toFixed(2)} ★</span></span>
        <span className="text-[10px] text-gray-400">30-Min-Update</span>
      </div>
    </div>
  );
}
