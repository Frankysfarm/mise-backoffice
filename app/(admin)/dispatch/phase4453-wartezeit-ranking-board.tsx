'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerWartezeit {
  rang: number;
  driver_id: string;
  name: string;
  avg_wartezeit_min: number;
  stopps: number;
  balken_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: string | null;
  rank_delta: number;
}

interface WartezeitRankingData {
  ranking: FahrerWartezeit[];
  team_avg: number;
  generated_at: string;
}

interface Props {
  locationId: string | null;
}

export function DispatchPhase4453WartezeitRankingBoard({ locationId }: Props) {
  const [data, setData] = useState<WartezeitRankingData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const params = locationId ? `?location_id=${locationId}` : '';
    const res = await fetch(`/api/delivery/admin/fahrer-wartezeit-ranking${params}`, { cache: 'no-store' });
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

  const ampelColor = (a: FahrerWartezeit['ampel']) =>
    a === 'gruen' ? 'text-emerald-600 dark:text-emerald-400' :
    a === 'rot' ? 'text-red-500 dark:text-red-400' : 'text-yellow-500 dark:text-yellow-400';

  const ampelBg = (a: FahrerWartezeit['ampel']) =>
    a === 'gruen' ? 'bg-emerald-500' : a === 'rot' ? 'bg-red-500' : 'bg-yellow-400';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-orange-500" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Wartezeit/Stopp-Ranking (30 Tage)</h3>
        <span className="ml-auto text-xs text-gray-400">∅ Wartezeit</span>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-2">
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{best?.avg_wartezeit_min ?? '—'} min</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Schnellste ({best?.name})</div>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
          <div className="text-lg font-bold text-gray-700 dark:text-gray-300">{data.team_avg} min</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Team-Avg</div>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
          <div className="text-lg font-bold text-gray-500 dark:text-gray-400">{worst?.avg_wartezeit_min ?? '—'} min</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Langsamste ({worst?.name})</div>
        </div>
      </div>

      {/* Alert */}
      {alerts.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
          <span className="text-xs text-orange-700 dark:text-orange-300">
            Hohe Wartezeit: {alerts.map(a => a.name).join(', ')}
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
              <span className="text-sm font-bold text-orange-600 dark:text-orange-400">{fahrer.avg_wartezeit_min} min</span>
              <span className="text-xs text-gray-400">{fahrer.stopps} Stopps</span>
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
