'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, AlertTriangle } from 'lucide-react';

interface FahrerBewertung {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_rating: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface Props {
  locationId: string | null;
}

export function KitchenPhase4496BewertungTicker({ locationId }: Props) {
  const [fahrer, setFahrer] = useState<FahrerBewertung[]>([]);
  const [teamAvg, setTeamAvg] = useState<number>(0);
  const [alertCount, setAlertCount] = useState(0);

  const fetchData = useCallback(async () => {
    const params = locationId ? `?location_id=${locationId}` : '';
    const res = await fetch(`/api/delivery/admin/fahrer-bewertung-ranking${params}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      setFahrer(json.fahrer ?? []);
      setTeamAvg(json.team_avg_rating ?? 0);
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

  const dotColor = (a: FahrerBewertung['ampel']) =>
    a === 'gruen' ? 'bg-emerald-500' : a === 'rot' ? 'bg-red-500' : 'bg-yellow-400';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Star className="w-4 h-4 text-yellow-500" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Bewertungs-Ranking</span>
        {alertCount > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
            <AlertTriangle className="w-3 h-3" />{alertCount}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Bester #1</span>
        <span className="text-sm font-bold text-yellow-500 dark:text-yellow-400">{best.fahrer_name}</span>
        <div className="ml-auto flex items-center gap-1">
          <Star className="w-3 h-3 text-yellow-400" />
          <span className="text-sm font-semibold text-yellow-600 dark:text-yellow-300">{best.avg_rating.toFixed(2)}</span>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${dotColor(f.ampel)}`} />
            <span className="text-xs text-gray-600 dark:text-gray-400">{f.fahrer_name} {f.avg_rating.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-400">Team-Avg: {teamAvg.toFixed(2)} · Ziel ≥4.5</div>
    </div>
  );
}
