'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerKm {
  rang: number;
  driver_id: string;
  name: string;
  avg_km_pro_tour: number;
  touren: number;
  balken_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: string | null;
  rank_delta: number;
}

interface KmRankingData {
  ranking: FahrerKm[];
  team_avg: number;
  generated_at: string;
}

interface Props {
  locationId: string | null;
}

export function DispatchPhase4447KmRankingBoard({ locationId }: Props) {
  const [data, setData] = useState<KmRankingData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const params = locationId ? `?location_id=${locationId}` : '';
    const res = await fetch(`/api/delivery/admin/fahrer-km-ranking${params}`, { cache: 'no-store' });
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
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-3" />
      <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded" />)}</div>
    </div>
  );

  if (!data) return null;

  const best = data.ranking[0];
  const worst = data.ranking[data.ranking.length - 1];
  const alerts = data.ranking.filter(d => d.alert);

  const ampelColor = (a: FahrerKm['ampel']) =>
    a === 'gruen' ? 'text-emerald-600 dark:text-emerald-400' :
    a === 'rot' ? 'text-red-500 dark:text-red-400' : 'text-yellow-500 dark:text-yellow-400';

  const ampelBg = (a: FahrerKm['ampel']) =>
    a === 'gruen' ? 'bg-emerald-500' : a === 'rot' ? 'bg-red-500' : 'bg-yellow-400';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MapPin className="w-5 h-5 text-blue-500" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">KM-Ranking (30 Tage)</h3>
        <span className="ml-auto text-xs text-gray-400">∅ Tour</span>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-2">
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{best?.avg_km_pro_tour ?? '—'} km</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Meiste ({best?.name})</div>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
          <div className="text-lg font-bold text-gray-700 dark:text-gray-300">{data.team_avg} km</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Team-Avg</div>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
          <div className="text-lg font-bold text-gray-500 dark:text-gray-400">{worst?.avg_km_pro_tour ?? '—'} km</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Wenigste ({worst?.name})</div>
        </div>
      </div>

      {/* Alert */}
      {alerts.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <span className="text-xs text-amber-700 dark:text-amber-300">
            Wenige Kilometer: {alerts.map(a => a.name).join(', ')}
          </span>
        </div>
      )}

      {/* Ranking-Liste */}
      <div className="space-y-2">
        {data.ranking.map(fahrer => (
          <div key={fahrer.driver_id} className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold w-5 text-center ${ampelColor(fahrer.ampel)}`}>#{fahrer.rang}</span>
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 flex-1">{fahrer.name}</span>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">{fahrer.avg_km_pro_tour} km</span>
              <span className="text-xs text-gray-400">{fahrer.touren} Touren</span>
              {fahrer.rank_delta > 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> :
               fahrer.rank_delta < 0 ? <TrendingDown className="w-3 h-3 text-red-400" /> :
               <Minus className="w-3 h-3 text-gray-400" />}
            </div>
            <div className="ml-7 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${ampelBg(fahrer.ampel)}`} style={{ width: `${fahrer.balken_pct}%` }} />
            </div>
          </div>
        ))}
      </div>

      <div className="text-right text-xs text-gray-400">Aktualisiert alle 30 Min</div>
    </div>
  );
}
