'use client';

import { useEffect, useState } from 'react';
import { Moon, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  sonntag_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  hoechste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

const AMPEL_COLOR: Record<string, string> = {
  gruen: 'bg-green-500',
  gelb: 'bg-yellow-400',
  rot: 'bg-red-500',
};

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-4 h-4 text-green-500" />;
  if (delta < 0) return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
}

export function DispatchPhase4648SonntagNachtBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-sonntag-nacht-ranking${params}`);
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
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-5 h-5" />
        <span className="text-sm">Sonntagnacht-Board nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 animate-pulse h-48" />
    );
  }

  return (
    <div className="rounded-2xl border border-purple-200 dark:border-purple-900 bg-white dark:bg-gray-900 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Moon className="w-5 h-5 text-purple-900 dark:text-purple-300" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Sonntagnacht-Ranking</h3>
        {data.alert_count > 0 && (
          <span className="ml-auto text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-2 py-0.5 rounded-full">
            {data.alert_count} Alert{data.alert_count > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-purple-50 dark:bg-purple-950 rounded-xl p-2">
          <p className="text-[10px] text-gray-500 dark:text-gray-400">Höchste</p>
          <p className="text-sm font-bold text-purple-900 dark:text-purple-300 truncate">{data.hoechste_name}</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-950 rounded-xl p-2">
          <p className="text-[10px] text-gray-500 dark:text-gray-400">Team-Ø</p>
          <p className="text-sm font-bold text-purple-900 dark:text-purple-300">{data.team_avg}%</p>
        </div>
        <div className="bg-purple-50 dark:bg-purple-950 rounded-xl p-2">
          <p className="text-[10px] text-gray-500 dark:text-gray-400">Niedrigste</p>
          <p className="text-sm font-bold text-purple-900 dark:text-purple-300 truncate">{data.niedrigste_name}</p>
        </div>
      </div>

      {/* Rank Bars */}
      <div className="space-y-2">
        {data.fahrer.map((f) => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            <span className="w-5 text-xs text-gray-400 text-right shrink-0">#{f.rang}</span>
            <DeltaIcon delta={f.rank_delta} />
            <span className="text-xs text-gray-700 dark:text-gray-300 w-20 truncate shrink-0">{f.fahrer_name}</span>
            <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full ${AMPEL_COLOR[f.ampel]}`}
                style={{ width: `${Math.min(f.sonntag_pct, 100)}%` }}
              />
            </div>
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-10 text-right shrink-0">
              {f.sonntag_pct}%
            </span>
            {f.alert_niedrig && (
              <span className="text-[10px] text-red-500 shrink-0">Wenig Sonntagnacht!</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
