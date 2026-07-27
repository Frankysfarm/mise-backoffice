'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, AlertTriangle } from 'lucide-react';

interface FahrerKm {
  rang: number;
  name: string;
  avg_km_pro_tour: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: string | null;
}

interface Props {
  locationId: string | null;
}

export function KitchenPhase4451KmTicker({ locationId }: Props) {
  const [ranking, setRanking] = useState<FahrerKm[]>([]);
  const [teamAvg, setTeamAvg] = useState<number>(0);
  const [alertCount, setAlertCount] = useState(0);

  const fetchData = useCallback(async () => {
    const params = locationId ? `?location_id=${locationId}` : '';
    const res = await fetch(`/api/delivery/admin/fahrer-km-ranking${params}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      setRanking(json.ranking ?? []);
      setTeamAvg(json.team_avg ?? 0);
      setAlertCount((json.ranking ?? []).filter((d: FahrerKm) => d.alert).length);
    }
  }, [locationId]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30 * 60 * 1000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const best = ranking[0];
  if (!best) return null;

  const dotColor = (a: FahrerKm['ampel']) =>
    a === 'gruen' ? 'bg-emerald-500' : a === 'rot' ? 'bg-red-500' : 'bg-yellow-400';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <MapPin className="w-4 h-4 text-blue-500" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">KM-Ranking</span>
        {alertCount > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-3 h-3" />{alertCount}
          </span>
        )}
      </div>

      {/* Meistgefahrener */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">#1</span>
        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{best.name}</span>
        <span className="text-sm font-semibold text-blue-700 dark:text-blue-300 ml-auto">{best.avg_km_pro_tour} km</span>
      </div>

      {/* Alle Fahrer */}
      <div className="flex gap-2 flex-wrap">
        {ranking.map(f => (
          <div key={f.name} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${dotColor(f.ampel)}`} />
            <span className="text-xs text-gray-600 dark:text-gray-400">{f.name} {f.avg_km_pro_tour}km</span>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-400">Team-Avg: {teamAvg} km</div>
    </div>
  );
}
