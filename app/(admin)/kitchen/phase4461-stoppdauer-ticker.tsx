'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, AlertTriangle } from 'lucide-react';

interface FahrerStoppdauer {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_sec: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface Props {
  locationId: string | null;
}

function secToMin(sec: number): string {
  return (Math.round(sec / 6) / 10).toFixed(1);
}

export function KitchenPhase4461StoppdauerTicker({ locationId }: Props) {
  const [fahrer, setFahrer] = useState<FahrerStoppdauer[]>([]);
  const [teamAvgSec, setTeamAvgSec] = useState<number>(0);
  const [alertCount, setAlertCount] = useState(0);

  const fetchData = useCallback(async () => {
    const params = locationId ? `?location_id=${locationId}` : '';
    const res = await fetch(`/api/delivery/admin/fahrer-stoppdauer-ranking${params}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      setFahrer(json.fahrer ?? []);
      setTeamAvgSec(json.team_avg_sec ?? 0);
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

  const dotColor = (a: FahrerStoppdauer['ampel']) =>
    a === 'gruen' ? 'bg-emerald-500' : a === 'rot' ? 'bg-red-500' : 'bg-yellow-400';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Timer className="w-4 h-4 text-violet-500" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Stoppdauer-Ranking</span>
        {alertCount > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400">
            <AlertTriangle className="w-3 h-3" />{alertCount}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">#1</span>
        <span className="text-sm font-bold text-violet-600 dark:text-violet-400">{best.fahrer_name}</span>
        <span className="text-sm font-semibold text-violet-700 dark:text-violet-300 ml-auto">{secToMin(best.avg_sec)} min</span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${dotColor(f.ampel)}`} />
            <span className="text-xs text-gray-600 dark:text-gray-400">{f.fahrer_name} {secToMin(f.avg_sec)}min</span>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-400">Team-Avg: {secToMin(teamAvgSec)} min · Ziel ≤5 min</div>
    </div>
  );
}
