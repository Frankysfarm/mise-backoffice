'use client';

import { useState, useEffect, useCallback } from 'react';
import { PackageCheck, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerErstlieferung {
  driver_id: string;
  name: string;
  rang: number;
  erstlieferung_pct: number;
  total: number;
  first_success: number;
  balken_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: string | null;
  rank_delta: number;
}

interface ErstlieferungData {
  ranking: FahrerErstlieferung[];
  team_avg: number;
  alert_count: number;
  bester_name: string;
  letzter_name: string;
  gesamt: number;
}

interface Props {
  locationId: string | null;
}

export function DispatchPhase4478ErstlieferungBoard({ locationId }: Props) {
  const [data, setData] = useState<ErstlieferungData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const params = locationId ? `?location_id=${locationId}` : '';
    const res = await fetch(`/api/delivery/admin/fahrer-erstlieferung-ranking${params}`, { cache: 'no-store' });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [locationId]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30 * 60 * 1000);
    return () => clearInterval(iv);
  }, [fetchData]);

  if (loading) return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-52 mb-3" />
      <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded" />)}</div>
    </div>
  );

  if (!data) return null;

  const best = data.ranking[0];
  const worst = data.ranking[data.ranking.length - 1];
  const alerts = data.ranking.filter(d => d.alert);

  const ampelColor = (a: FahrerErstlieferung['ampel']) =>
    a === 'gruen' ? 'text-emerald-600 dark:text-emerald-400' :
    a === 'rot' ? 'text-red-500 dark:text-red-400' : 'text-yellow-500 dark:text-yellow-400';

  const ampelBg = (a: FahrerErstlieferung['ampel']) =>
    a === 'gruen' ? 'bg-emerald-500' : a === 'rot' ? 'bg-red-500' : 'bg-yellow-400';

  const deltaIcon = (delta: number) =>
    delta > 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> :
    delta < 0 ? <TrendingDown className="w-3 h-3 text-red-400" /> :
    <Minus className="w-3 h-3 text-gray-400" />;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <PackageCheck className="w-5 h-5 text-green-600" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Erstlieferung-Erfolgsrate (30 Tage)</h3>
        <span className="ml-auto text-xs text-gray-400">% Erstversuch</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-2">
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{best?.erstlieferung_pct}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Beste ({best?.name})</div>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
          <div className="text-lg font-bold text-gray-700 dark:text-gray-300">{data.team_avg}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Team-Avg</div>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
          <div className="text-lg font-bold text-gray-500 dark:text-gray-400">{worst?.erstlieferung_pct}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Niedrigste ({worst?.name})</div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span className="text-xs text-green-700 dark:text-green-300">
            Niedrige Erstlieferrate: {alerts.map(a => a.name).join(', ')}
          </span>
        </div>
      )}

      <div className="space-y-2">
        {data.ranking.map((f) => (
          <div key={f.driver_id} className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <span className={`text-xs font-bold w-5 ${ampelColor(f.ampel)}`}>#{f.rang}</span>
              <span className="flex-1 font-medium text-gray-800 dark:text-gray-200">{f.name}</span>
              <span className="flex items-center gap-0.5 text-xs text-gray-500">{deltaIcon(f.rank_delta)}</span>
              <span className={`font-semibold text-xs ${ampelColor(f.ampel)}`}>{f.erstlieferung_pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
              <div className={`h-full rounded-full ${ampelBg(f.ampel)}`} style={{ width: `${f.balken_pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-400">Ziel: ≥90% Erstlieferung · {data.gesamt} Fahrer</div>
    </div>
  );
}
