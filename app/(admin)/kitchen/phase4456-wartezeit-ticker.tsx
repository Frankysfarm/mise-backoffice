'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

interface FahrerWartezeit {
  rang: number;
  name: string;
  avg_wartezeit_min: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: string | null;
}

interface Props {
  locationId: string | null;
}

export function KitchenPhase4456WartezeitTicker({ locationId }: Props) {
  const [ranking, setRanking] = useState<FahrerWartezeit[]>([]);
  const [teamAvg, setTeamAvg] = useState<number>(0);
  const [alertCount, setAlertCount] = useState(0);

  const fetchData = useCallback(async () => {
    const params = locationId ? `?location_id=${locationId}` : '';
    const res = await fetch(`/api/delivery/admin/fahrer-wartezeit-ranking${params}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      setRanking(json.ranking ?? []);
      setTeamAvg(json.team_avg ?? 0);
      setAlertCount((json.ranking ?? []).filter((d: FahrerWartezeit) => d.alert).length);
    }
  }, [locationId]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30 * 60 * 1000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const best = ranking[0];
  if (!best) return null;

  const dotColor = (a: FahrerWartezeit['ampel']) =>
    a === 'gruen' ? 'bg-emerald-500' : a === 'rot' ? 'bg-red-500' : 'bg-yellow-400';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 text-orange-500" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Wartezeit-Ranking</span>
        {alertCount > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-orange-600 dark:text-orange-400">
            <AlertTriangle className="w-3 h-3" />{alertCount}
          </span>
        )}
      </div>

      {/* Schnellster */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">#1</span>
        <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{best.name}</span>
        <span className="text-sm font-semibold text-orange-700 dark:text-orange-300 ml-auto">{best.avg_wartezeit_min} min</span>
      </div>

      {/* Alle Fahrer */}
      <div className="flex gap-2 flex-wrap">
        {ranking.map(f => (
          <div key={f.name} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${dotColor(f.ampel)}`} />
            <span className="text-xs text-gray-600 dark:text-gray-400">{f.name} {f.avg_wartezeit_min}min</span>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-400">Team-Avg: {teamAvg} min · Ziel ≤3 min</div>
    </div>
  );
}
