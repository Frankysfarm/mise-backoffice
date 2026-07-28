'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap, AlertTriangle } from 'lucide-react';

interface FahrerProd {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  deliveries_pro_h: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface Props {
  locationId: string | null;
}

export function KitchenPhase4521ProduktivitaetTicker({ locationId }: Props) {
  const [fahrer, setFahrer] = useState<FahrerProd[]>([]);
  const [teamAvg, setTeamAvg] = useState<number>(0);
  const [alertCount, setAlertCount] = useState(0);

  const fetchData = useCallback(async () => {
    const params = locationId ? `?location_id=${locationId}` : '';
    const res = await fetch(`/api/delivery/admin/fahrer-lieferungen-pro-stunde-ranking${params}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      setFahrer(json.fahrer ?? []);
      setTeamAvg(json.team_avg_pro_h ?? 0);
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

  const dotColor = (a: FahrerProd['ampel']) =>
    a === 'gruen' ? 'bg-orange-500' : a === 'rot' ? 'bg-red-500' : 'bg-yellow-400';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Zap className="w-4 h-4 text-orange-500" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Produktivitäts-Ranking</span>
        {alertCount > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-500 dark:text-red-400">
            <AlertTriangle className="w-3 h-3" />{alertCount}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Produktivste #1</span>
        <span className="text-sm font-bold text-orange-500 dark:text-orange-400">{best.fahrer_name}</span>
        <div className="ml-auto flex items-center gap-1">
          <Zap className="w-3 h-3 text-orange-400" />
          <span className="text-sm font-semibold text-orange-600 dark:text-orange-300">{best.deliveries_pro_h.toFixed(1)}/h</span>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-1">
            <span className={`w-2 h-2 rounded-full ${dotColor(f.ampel)}`} />
            <span className="text-xs text-gray-600 dark:text-gray-400">{f.fahrer_name} {f.deliveries_pro_h.toFixed(1)}/h</span>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-400">Team-Avg: {teamAvg.toFixed(1)}/h · Ziel ≥3.5/h</div>
    </div>
  );
}
