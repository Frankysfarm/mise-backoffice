'use client';

import { useState, useEffect, useCallback } from 'react';
import { Moon, AlertTriangle } from 'lucide-react';

interface NachtData {
  fahrer: Array<{
    fahrer_id: string;
    fahrer_name: string;
    rang: number;
    nacht_pct: number;
    ampel: 'gruen' | 'gelb' | 'rot';
  }>;
  team_avg: number;
  alert_count: number;
}

interface Props {
  locationId: string | null;
}

export function KitchenPhase4561NachtAnteilTicker({ locationId }: Props) {
  const [data, setData] = useState<NachtData | null>(null);

  const fetchData = useCallback(async () => {
    const params = locationId ? `?location_id=${locationId}` : '';
    const res = await fetch(`/api/delivery/admin/fahrer-nacht-anteil-ranking${params}`, { cache: 'no-store' });
    if (res.ok) setData(await res.json());
  }, [locationId]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30 * 60 * 1000);
    return () => clearInterval(iv);
  }, [fetchData]);

  if (!data) return null;

  const top = data.fahrer[0];

  const dotColor = (a: string) =>
    a === 'gruen' ? 'bg-emerald-500' :
    a === 'gelb'  ? 'bg-yellow-400'  : 'bg-red-500';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Moon className="w-4 h-4 text-indigo-500" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Nacht-Lieferungs-Anteil</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-500">
            <AlertTriangle className="w-3 h-3" />
            {data.alert_count}
          </span>
        )}
      </div>

      {top && (
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xs text-gray-500 dark:text-gray-400">#1</span>
          <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{top.fahrer_name}</span>
          <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{top.nacht_pct}%</span>
        </div>
      )}

      <div className="space-y-1">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor(f.ampel)}`} />
            <span className="text-xs text-gray-600 dark:text-gray-400 truncate flex-1">{f.fahrer_name}</span>
            <span className="text-xs tabular-nums font-medium text-gray-700 dark:text-gray-300">
              {f.nacht_pct}%
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">
        Team-Avg {data.team_avg}% · Ziel ≥30%
      </div>
    </div>
  );
}
