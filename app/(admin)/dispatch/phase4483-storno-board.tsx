'use client';

import { useState, useEffect, useCallback } from 'react';
import { XCircle, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerStorno {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  storno_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface StornoData {
  fahrer: FahrerStorno[];
  team_avg_pct: number;
  alert_count: number;
  bester_name: string;
  letzter_name: string;
  gesamt: number;
}

interface Props {
  locationId: string | null;
}

export function DispatchPhase4483StornoBoard({ locationId }: Props) {
  const [data, setData] = useState<StornoData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const params = locationId ? `?location_id=${locationId}` : '';
    const res = await fetch(`/api/delivery/admin/fahrer-storno-ranking${params}`, { cache: 'no-store' });
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

  const best = data.fahrer[0];
  const worst = data.fahrer[data.fahrer.length - 1];
  const alerts = data.fahrer.filter(d => d.alert_hoch);
  const maxPct = worst?.storno_pct ?? 1;

  const ampelColor = (a: FahrerStorno['ampel']) =>
    a === 'gruen' ? 'text-emerald-600 dark:text-emerald-400' :
    a === 'rot' ? 'text-red-500 dark:text-red-400' : 'text-yellow-500 dark:text-yellow-400';

  const ampelBg = (a: FahrerStorno['ampel']) =>
    a === 'gruen' ? 'bg-emerald-500' : a === 'rot' ? 'bg-red-500' : 'bg-yellow-400';

  const deltaIcon = (delta: number) =>
    delta > 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> :
    delta < 0 ? <TrendingDown className="w-3 h-3 text-red-400" /> :
    <Minus className="w-3 h-3 text-gray-400" />;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <XCircle className="w-5 h-5 text-rose-500" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Storno-Quote-Ranking (30 Tage)</h3>
        <span className="ml-auto text-xs text-gray-400">% Stornos</span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-2">
          <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{best?.storno_pct.toFixed(1)}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Niedrigste ({best?.fahrer_name})</div>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
          <div className="text-lg font-bold text-gray-700 dark:text-gray-300">{data.team_avg_pct.toFixed(1)}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Team-Avg</div>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2">
          <div className="text-lg font-bold text-gray-500 dark:text-gray-400">{worst?.storno_pct.toFixed(1)}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Höchste ({worst?.fahrer_name})</div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 px-3 py-2">
          <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
          <span className="text-xs text-rose-700 dark:text-rose-300">
            Hohe Storno-Quote: {alerts.map(a => a.fahrer_name).join(', ')}
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
              <span className={`font-semibold text-xs ${ampelColor(f.ampel)}`}>{f.storno_pct.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800">
              <div
                className={`h-full rounded-full ${ampelBg(f.ampel)}`}
                style={{ width: `${maxPct > 0 ? Math.round((f.storno_pct / maxPct) * 100) : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-400">Ziel: ≤3% Storno · {data.gesamt} Fahrer</div>
    </div>
  );
}
