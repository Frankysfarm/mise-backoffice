'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, AlertTriangle } from 'lucide-react';

interface FahrerVarianz {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  stddev_min: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface Props {
  locationId: string | null;
}

export function KitchenPhase4516VarianzTicker({ locationId }: Props) {
  const [fahrer, setFahrer] = useState<FahrerVarianz[]>([]);
  const [teamAvg, setTeamAvg] = useState<number>(0);
  const [alertCount, setAlertCount] = useState(0);

  const fetchData = useCallback(async () => {
    const params = locationId ? `?location_id=${locationId}` : '';
    const res = await fetch(`/api/delivery/admin/fahrer-lieferzeit-varianz-ranking${params}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      setFahrer(json.fahrer ?? []);
      setTeamAvg(json.team_avg_stddev ?? 0);
      setAlertCount(json.alert_count ?? 0);
    }
  }, [locationId]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30 * 60 * 1000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const best = fahrer[0];
  if (!best) return null;

  const dotColor = (a: FahrerVarianz['ampel']) =>
    a === 'gruen' ? 'bg-purple-500' : a === 'rot' ? 'bg-red-500' : 'bg-yellow-400';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Activity className="w-4 h-4 text-purple-500" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Zeitvarianz-Ranking</span>
        {alertCount > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
            <AlertTriangle className="w-3 h-3" />{alertCount}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Konsistentester #1</span>
        <span className="text-sm font-bold text-purple-600 dark:text-purple-400">{best.fahrer_name}</span>
        <div className="ml-auto flex items-center gap-1">
          <Activity className="w-3 h-3 text-purple-500" />
          <span className="text-sm font-semibold text-purple-600 dark:text-purple-300">{best.stddev_min.toFixed(1)} min</span>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${dotColor(f.ampel)}`} />
            <span className="text-xs text-gray-600 dark:text-gray-400">{f.fahrer_name} {f.stddev_min.toFixed(1)} min</span>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-400">Team-Avg: {teamAvg.toFixed(1)} min · Ziel ≤6 min Varianz</div>
    </div>
  );
}
