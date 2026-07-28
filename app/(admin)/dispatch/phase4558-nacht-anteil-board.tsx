'use client';

import { useState, useEffect, useCallback } from 'react';
import { Moon, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerNacht {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  nacht_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_kein_nacht: boolean;
}

interface NachtData {
  fahrer: FahrerNacht[];
  team_avg: number;
  alert_count: number;
  hoechste_name: string;
  niedrigste_name: string;
  gesamt: number;
}

interface Props {
  locationId: string | null;
}

export function DispatchPhase4558NachtAnteilBoard({ locationId }: Props) {
  const [data, setData] = useState<NachtData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const params = locationId ? `?location_id=${locationId}` : '';
    const res = await fetch(`/api/delivery/admin/fahrer-nacht-anteil-ranking${params}`, { cache: 'no-store' });
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
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-56 mb-3" />
      <div className="space-y-2">{[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded" />)}</div>
    </div>
  );

  if (!data) return null;

  const maxPct = Math.max(...data.fahrer.map(f => f.nacht_pct), 1);

  const ampelClass = (a: string) =>
    a === 'gruen' ? 'text-emerald-600 dark:text-emerald-400' :
    a === 'gelb'  ? 'text-yellow-500 dark:text-yellow-400'  :
                    'text-red-500 dark:text-red-400';

  const DeltaIcon = ({ d }: { d: number }) =>
    d > 0 ? <TrendingUp className="w-3 h-3 text-emerald-500" /> :
    d < 0 ? <TrendingDown className="w-3 h-3 text-red-400" />   :
             <Minus className="w-3 h-3 text-gray-400" />;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Moon className="w-5 h-5 text-indigo-500" />
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
          Nacht-Lieferungs-Anteil — Ranking
        </h3>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-500 font-medium">
            <AlertTriangle className="w-3 h-3" />
            {data.alert_count} Kein Nachtfahrer!
          </span>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-center">
          <div className="text-xs text-gray-500 dark:text-gray-400">Höchste</div>
          <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 truncate">{data.hoechste_name}</div>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-center">
          <div className="text-xs text-gray-500 dark:text-gray-400">Team-Avg</div>
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">{data.team_avg}%</div>
        </div>
        <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-center">
          <div className="text-xs text-gray-500 dark:text-gray-400">Niedrigste</div>
          <div className="text-sm font-semibold text-red-500 dark:text-red-400 truncate">{data.niedrigste_name}</div>
        </div>
      </div>

      {/* Ranking Table */}
      <div className="space-y-2">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="rounded-lg bg-gray-50 dark:bg-gray-800 px-3 py-2">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 w-5">#{f.rang}</span>
                <DeltaIcon d={f.rank_delta} />
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{f.fahrer_name}</span>
                {f.alert_kein_nacht && <AlertTriangle className="w-3 h-3 text-red-400" />}
              </div>
              <span className={`text-sm font-bold tabular-nums ${ampelClass(f.ampel)}`}>
                {f.nacht_pct}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  f.ampel === 'gruen' ? 'bg-emerald-500' :
                  f.ampel === 'gelb'  ? 'bg-yellow-400'  : 'bg-red-500'
                }`}
                style={{ width: `${(f.nacht_pct / maxPct) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
