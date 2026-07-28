'use client';

import { useState, useEffect, useCallback } from 'react';
import { PackageCheck, AlertTriangle } from 'lucide-react';

interface FahrerErstlieferung {
  driver_id: string;
  name: string;
  rang: number;
  erstlieferung_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface Props {
  locationId: string | null;
}

export function KitchenPhase4481ErstlieferungTicker({ locationId }: Props) {
  const [fahrer, setFahrer] = useState<FahrerErstlieferung[]>([]);
  const [teamAvg, setTeamAvg] = useState<number>(0);
  const [alertCount, setAlertCount] = useState(0);

  const fetchData = useCallback(async () => {
    const params = locationId ? `?location_id=${locationId}` : '';
    const res = await fetch(`/api/delivery/admin/fahrer-erstlieferung-ranking${params}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      setFahrer(json.ranking ?? []);
      setTeamAvg(json.team_avg ?? 0);
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

  const dotColor = (a: FahrerErstlieferung['ampel']) =>
    a === 'gruen' ? 'bg-emerald-500' : a === 'rot' ? 'bg-red-500' : 'bg-yellow-400';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <PackageCheck className="w-4 h-4 text-green-600" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Erstlieferung-Ranking</span>
        {alertCount > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
            <AlertTriangle className="w-3 h-3" />{alertCount}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Bester #1</span>
        <span className="text-sm font-bold text-green-600 dark:text-green-400">{best.name}</span>
        <span className="text-sm font-semibold text-green-700 dark:text-green-300 ml-auto">{best.erstlieferung_pct.toFixed(1)}%</span>
      </div>

      <div className="flex gap-2 flex-wrap">
        {fahrer.map(f => (
          <div key={f.driver_id} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${dotColor(f.ampel)}`} />
            <span className="text-xs text-gray-600 dark:text-gray-400">{f.name} {f.erstlieferung_pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-400">Team-Avg: {teamAvg.toFixed(1)}% · Ziel ≥90%</div>
    </div>
  );
}
