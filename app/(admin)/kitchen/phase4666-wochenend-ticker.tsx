'use client';

import { useEffect, useState } from 'react';
import { Calendar, TrendingDown, TrendingUp, Minus, WifiOff } from 'lucide-react';

interface ApiResponse {
  team_avg_we: number;
  team_avg_wt: number;
  team_avg_delta: number;
  we_leader_name: string;
  we_leader_pct: number;
  alert_wochenende: boolean;
  gesamt: number;
}

export function KitchenPhase4666WochenendTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-wochenend-vergleich${params}`);
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
        <span className="text-xs">WE-Ticker nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 animate-pulse h-24" />;
  }

  const DeltaIcon = data.team_avg_delta >= 5
    ? <TrendingUp className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
    : data.team_avg_delta <= -5
    ? <TrendingDown className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
    : <Minus className="w-3.5 h-3.5 text-gray-400" />;

  return (
    <div className="rounded-2xl border border-violet-200 dark:border-violet-900 bg-white dark:bg-gray-900 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Calendar className="w-4 h-4 text-violet-900 dark:text-violet-300" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">WE vs. Wochentag</span>
      </div>

      {/* Main team averages */}
      <div className="flex items-center gap-3">
        <div className="text-center">
          <div className="text-lg font-extrabold text-violet-900 dark:text-violet-300">{data.team_avg_we}%</div>
          <div className="text-[9px] text-gray-500">Team WE-Ø</div>
        </div>
        <div className="flex items-center gap-0.5">
          {DeltaIcon}
          <span className={`text-sm font-bold ${data.team_avg_delta >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {data.team_avg_delta >= 0 ? '+' : ''}{data.team_avg_delta}%
          </span>
        </div>
        <div className="text-center">
          <div className="text-lg font-extrabold text-gray-600 dark:text-gray-400">{data.team_avg_wt}%</div>
          <div className="text-[9px] text-gray-500">Team WT-Ø</div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-1.5">
        <span>WE-Leader: <span className="font-medium text-violet-900 dark:text-violet-300">{data.we_leader_name}</span></span>
        <span className="font-bold text-violet-900 dark:text-violet-300">{data.we_leader_pct}%</span>
      </div>
    </div>
  );
}
