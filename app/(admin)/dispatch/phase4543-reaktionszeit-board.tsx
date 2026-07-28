'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerReaktion {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  reaktionszeit_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_langsam: boolean;
}

interface ReaktionData {
  fahrer: FahrerReaktion[];
  team_avg_min: number;
  alert_count: number;
  schnellste_name: string;
  langsamste_name: string;
  gesamt: number;
}

interface Props {
  locationId: string | null;
}

export function DispatchPhase4543ReaktionszeitBoard({ locationId }: Props) {
  const [data, setData] = useState<ReaktionData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const params = locationId ? `?location_id=${locationId}` : '';
    const res = await fetch(`/api/delivery/admin/fahrer-problem-reaktionszeit-ranking${params}`, { cache: 'no-store' });
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

  const best  = data.fahrer[0];
  const worst = data.fahrer[data.fahrer.length - 1];
  const alerts = data.fahrer.filter(d => d.alert_langsam);
  const minVal = best?.reaktionszeit_min ?? 1;

  const ampelColor = (a: FahrerReaktion['ampel']) =>
    a === 'gruen' ? 'text-yellow-500 dark:text-yellow-400' :
    a === 'rot'   ? 'text-red-500 dark:text-red-400' : 'text-orange-500 dark:text-orange-400';

  const ampelBg = (a: FahrerReaktion['ampel']) =>
    a === 'gruen' ? 'bg-yellow-500' : a === 'rot' ? 'bg-red-500' : 'bg-orange-400';

  const deltaIcon = (delta: number) =>
    delta > 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> :
    delta < 0 ? <TrendingDown className="w-3 h-3 text-red-400" /> :
    <Minus className="w-3 h-3 text-gray-400" />;

  const maxVal = Math.max(...data.fahrer.map(f => f.reaktionszeit_min));

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-yellow-500" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Problem-Reaktionszeit-Ranking (30 Tage)</h3>
        <span className="ml-auto text-xs text-gray-400">Rang 1 = schnellste Reaktion</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 p-2">
          <div className="text-lg font-bold text-yellow-500 dark:text-yellow-400">{best?.reaktionszeit_min?.toFixed(1)} min</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Schnellste ({best?.fahrer_name})</div>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
          <div className="text-lg font-bold text-gray-700 dark:text-gray-300">{data.team_avg_min?.toFixed(1)} min</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Team-Avg</div>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
          <div className="text-lg font-bold text-gray-500 dark:text-gray-400">{worst?.reaktionszeit_min?.toFixed(1)} min</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Langsamste ({worst?.fahrer_name})</div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <span className="text-xs text-red-700 dark:text-red-300">
            Langsame Reaktion (&gt;30 min): {alerts.map(a => a.fahrer_name).join(', ')}
          </span>
        </div>
      )}

      <div className="space-y-2">
        {data.fahrer.map((f) => (
          <div key={f.fahrer_id} className="space-y-1">
            <div className="flex items-center gap-2 text-sm">
              <span className={`text-xs font-bold w-5 ${ampelColor(f.ampel)}`}>#{f.rang}</span>
              <span className="flex-1 font-medium text-gray-800 dark:text-gray-200">{f.fahrer_name}</span>
              <span className="flex items-center gap-0.5 text-xs text-gray-500">{deltaIcon(f.rank_delta)}</span>
              <Zap className="w-3 h-3 text-yellow-500" />
              <span className={`font-semibold text-xs ${ampelColor(f.ampel)}`}>{f.reaktionszeit_min?.toFixed(1)} min</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className={`h-full rounded-full ${ampelBg(f.ampel)}`}
                style={{ width: `${maxVal > 0 ? Math.round((f.reaktionszeit_min / maxVal) * 100) : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-400">Ziel: ≤15 min · {data.gesamt} Fahrer</div>
    </div>
  );
}
