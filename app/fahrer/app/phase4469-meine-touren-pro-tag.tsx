'use client';

import { useState, useEffect, useCallback } from 'react';
import { Route, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerTouren {
  driver_id: string;
  name: string;
  rang: number;
  avg_touren_pro_tag: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rank_delta: number;
}

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase4469MeineTourenProTag({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<FahrerTouren | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!isOnline) return;
    const params = new URLSearchParams();
    if (locationId) params.set('location_id', locationId);
    if (driverId) params.set('driver_id', driverId);
    const res = await fetch(`/api/delivery/admin/fahrer-touren-pro-tag-ranking?${params.toString()}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json.ranking) ? json.ranking as FahrerTouren[] : [];
      const mein = list.find((d) => d.driver_id === driverId || d.name === driverId) ?? list[0];
      if (mein) setData(mein);
    }
    setLoading(false);
  }, [driverId, locationId, isOnline]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30 * 60 * 1000);
    return () => clearInterval(iv);
  }, [fetchData]);

  if (!isOnline) return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 flex items-center gap-3">
      <WifiOff className="w-5 h-5 text-gray-400" />
      <span className="text-sm text-gray-500 dark:text-gray-400">Touren/Tag-Ranking — Offline nicht verfügbar</span>
    </div>
  );

  if (loading) return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
      <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded" />
    </div>
  );

  if (!data) return null;

  const rangColor = data.ampel === 'gruen' ? 'text-emerald-600 dark:text-emerald-400' :
                    data.ampel === 'rot' ? 'text-red-500 dark:text-red-400' : 'text-yellow-500 dark:text-yellow-400';

  const coaching =
    data.avg_touren_pro_tag >= 4.5 ? 'Top-Leistung! Du absolvierst überdurchschnittlich viele Touren — weiter so!' :
    data.avg_touren_pro_tag >= 3.5 ? 'Gut! Versuche deine tägliche Tourenzahl zu steigern, um ins Spitzenfeld zu kommen.' :
    'Tipp: Mehr Schichten oder kürzere Pausen helfen dir, mehr Touren pro Tag zu schaffen.';

  const deltaIcon =
    data.rank_delta > 0 ? <TrendingUp className="w-4 h-4 text-emerald-500" /> :
    data.rank_delta < 0 ? <TrendingDown className="w-4 h-4 text-red-400" /> :
    <Minus className="w-4 h-4 text-gray-400" />;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Route className="w-5 h-5 text-teal-500" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Meine Ø Touren/Tag</h3>
      </div>

      <div className="flex items-end gap-4">
        <div>
          <div className="text-5xl font-extrabold text-teal-500 dark:text-teal-400">{data.avg_touren_pro_tag.toFixed(1)}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Touren/Tag (Ø 30 Tage)</div>
        </div>
        <div className="pb-1">
          <div className={`text-2xl font-bold ${rangColor}`}>#{data.rang}</div>
          <div className="flex items-center gap-1 text-xs mt-0.5">
            {deltaIcon}
            <span className="text-gray-500 dark:text-gray-400">
              {data.rank_delta === 0 ? 'Keine Änderung' : data.rank_delta > 0 ? `+${data.rank_delta} Plätze` : `${data.rank_delta} Plätze`}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-teal-50 dark:bg-teal-900/20 px-3 py-2 text-xs text-teal-700 dark:text-teal-300">
        {coaching}
      </div>

      <div className="text-xs text-gray-400">Ziel: ≥4/Tag · Gut: ≥4,5/Tag</div>
    </div>
  );
}
