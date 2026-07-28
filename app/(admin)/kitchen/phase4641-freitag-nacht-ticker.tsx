'use client';

import { useEffect, useState } from 'react';
import { Moon } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  freitag_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  hoechste_name: string;
  gesamt: number;
}

const DOT_COLOR: Record<string, string> = {
  gruen: 'bg-green-500',
  gelb: 'bg-yellow-400',
  rot: 'bg-red-500',
};

const ZIEL = 22;

export function KitchenPhase4641FreitagNachtTicker({
  locationId,
}: {
  locationId: string | null;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-freitag-nacht-ranking${params}`);
        if (!res.ok) throw new Error('fetch failed');
        const json: ApiResponse = await res.json();
        if (!cancelled) setData(json);
      } catch {
        // silent
      }
    }

    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (!data) {
    return <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 animate-pulse h-24" />;
  }

  const top = data.fahrer[0];
  const zielDiff = data.team_avg - ZIEL;

  return (
    <div className="rounded-xl border border-emerald-200 dark:border-emerald-900 bg-white dark:bg-gray-900 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Moon className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200">Freitagnacht</span>
        <span className="ml-auto text-xs text-gray-400">Fr 22–02</span>
      </div>

      {top && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">#1</span>
          <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300">{top.fahrer_name}</span>
          <span className="text-sm font-bold text-gray-700 dark:text-gray-200 ml-auto">{top.freitag_pct}%</span>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${DOT_COLOR[f.ampel]}`} />
            <span className="text-xs text-gray-600 dark:text-gray-400">{f.fahrer_name.split(' ')[0]}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-800">
        <span className="text-xs text-gray-400">Avg {data.team_avg}% · Ziel ≥{ZIEL}%</span>
        <span className={`text-xs font-semibold ${zielDiff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
          {zielDiff >= 0 ? '+' : ''}{zielDiff}%
        </span>
      </div>
    </div>
  );
}
