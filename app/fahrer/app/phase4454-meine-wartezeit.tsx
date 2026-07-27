'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerWartezeit {
  rang: number;
  name: string;
  avg_wartezeit_min: number;
  stopps: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rank_delta: number;
}

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase4454MeineWartezeit({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<FahrerWartezeit | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!isOnline) return;
    const params = locationId ? `?location_id=${locationId}` : '';
    const res = await fetch(`/api/delivery/admin/fahrer-wartezeit-ranking${params}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      const mein = (json.ranking as FahrerWartezeit[]).find((d: FahrerWartezeit) => d.name === driverId || d.rang === 1);
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
      <span className="text-sm text-gray-500 dark:text-gray-400">Wartezeit-Ranking — Offline nicht verfügbar</span>
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
    data.avg_wartezeit_min <= 2 ? 'Ausgezeichnet! Du wartest kaum an Stopps — weiter so!' :
    data.avg_wartezeit_min <= 5 ? 'Gut! Versuche, Kunden vorab per Anruf bereitzumachen, um die Wartezeit zu kürzen.' :
    'Tipp: Klingeln beim Anfahren und Kunden kurz per Anruf informieren reduziert die Wartezeit deutlich.';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-orange-500" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Meine Wartezeit/Stopp</h3>
      </div>

      <div className="flex items-end gap-4">
        <div>
          <div className="text-5xl font-extrabold text-orange-600 dark:text-orange-400">{data.avg_wartezeit_min}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">min pro Stopp (Ø 30 Tage)</div>
        </div>
        <div className="pb-1">
          <div className={`text-2xl font-bold ${rangColor}`}>#{data.rang}</div>
          <div className="flex items-center gap-1 text-xs mt-0.5">
            {data.rank_delta > 0 ? <><TrendingUp className="w-3 h-3 text-emerald-500" /><span className="text-emerald-600 dark:text-emerald-400">+{data.rank_delta}</span></> :
             data.rank_delta < 0 ? <><TrendingDown className="w-3 h-3 text-red-400" /><span className="text-red-500">{data.rank_delta}</span></> :
             <><Minus className="w-3 h-3 text-gray-400" /><span className="text-gray-400">±0</span></>}
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-orange-50 dark:bg-orange-900/20 px-3 py-2 text-xs text-orange-700 dark:text-orange-300">
        {coaching}
      </div>

      <div className="text-right text-xs text-gray-400">{data.stopps} Stopps analysiert · 30 Min Polling</div>
    </div>
  );
}
