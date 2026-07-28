'use client';

import { useEffect, useState } from 'react';
import { Moon, WifiOff } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    mittwoch_pct: number;
    ampel: 'gruen' | 'gelb' | 'rot';
  }>;
  team_avg: number;
  hoechste_name: string;
  gesamt: number;
}

const DOT_COLOR: Record<string, string> = {
  gruen: 'bg-green-500',
  gelb: 'bg-yellow-400',
  rot: 'bg-red-500',
};

const ZIEL = 20;

export function KitchenPhase4631MittwochNachtTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-mittwoch-nacht-ranking${params}`);
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
        <span className="text-xs">Mittwochnacht-Ticker nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 animate-pulse h-24" />
    );
  }

  const top = data.fahrer[0];
  const zielDiff = Math.round((data.team_avg - ZIEL) * 10) / 10;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-gray-900 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Moon className="w-4 h-4 text-slate-700 dark:text-slate-300" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Mittwochnacht-Ticker</span>
      </div>

      {top && (
        <div className="flex items-center gap-2">
          <span className="text-lg font-extrabold text-slate-700 dark:text-slate-300">#1</span>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{top.fahrer_name}</span>
          <span className="ml-auto text-sm font-bold text-slate-700 dark:text-slate-300">{top.mittwoch_pct}%</span>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-1 text-[10px] text-gray-600 dark:text-gray-400">
            <span className={`w-1.5 h-1.5 rounded-full ${DOT_COLOR[f.ampel]}`} />
            <span className="truncate max-w-[60px]">{f.fahrer_name}</span>
            <span className="font-medium">{f.mittwoch_pct}%</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-1.5">
        <span>Team-Ø {data.team_avg}%</span>
        <span>Ziel ≥{ZIEL}%</span>
        <span className={zielDiff >= 0 ? 'text-green-500' : 'text-red-500'}>
          {zielDiff >= 0 ? `+${zielDiff}%` : `${zielDiff}%`}
        </span>
      </div>
    </div>
  );
}
