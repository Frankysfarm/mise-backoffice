'use client';

import { useEffect, useState } from 'react';
import { Trophy, WifiOff } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    routen_score: number;
    level: 'hoch' | 'mittel' | 'niedrig';
  }>;
  team_ø_score: number;
}

const DOT_COLOR: Record<string, string> = {
  hoch: 'bg-green-500',
  mittel: 'bg-yellow-400',
  niedrig: 'bg-red-500',
};

const ZIEL = 75;

export function KitchenPhase4616TourScoreKpiTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-routen-score${params}`);
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
        <span className="text-xs">Tour-Score-Ticker nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 animate-pulse h-24" />
    );
  }

  const top = data.fahrer[0];
  const teamAvg = Math.round(data.team_ø_score);
  const zielDiff = teamAvg - ZIEL;

  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Trophy className="w-4 h-4 text-indigo-500" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Tour-Score-KPI-Ticker</span>
      </div>

      {top && (
        <div className="flex items-center gap-2">
          <span className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">#1</span>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{top.fahrer_name}</span>
          <span className="ml-auto text-sm font-bold text-indigo-500">{top.routen_score}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-1 text-[10px] text-gray-600 dark:text-gray-400">
            <span className={`w-1.5 h-1.5 rounded-full ${DOT_COLOR[f.level]}`} />
            <span className="truncate max-w-[60px]">{f.fahrer_name}</span>
            <span className="font-medium">{f.routen_score}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-1.5">
        <span>Team-Ø {teamAvg}</span>
        <span>Ziel ≥{ZIEL}</span>
        <span className={zielDiff >= 0 ? 'text-green-500' : 'text-red-500'}>
          {zielDiff >= 0 ? `+${zielDiff}` : `${zielDiff}`}
        </span>
      </div>
    </div>
  );
}
