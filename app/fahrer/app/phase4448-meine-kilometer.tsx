'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerKm {
  rang: number;
  name: string;
  avg_km_pro_tour: number;
  touren: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rank_delta: number;
}

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase4448MeineKilometer({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<FahrerKm | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!isOnline) return;
    const params = locationId ? `?location_id=${locationId}` : '';
    const res = await fetch(`/api/delivery/admin/fahrer-km-ranking${params}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      const mein = (json.ranking as FahrerKm[]).find((d: FahrerKm) => d.name === driverId || d.rang === 1);
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
      <span className="text-sm text-gray-500 dark:text-gray-400">KM-Ranking — Offline nicht verfügbar</span>
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
    data.avg_km_pro_tour >= 15 ? 'Top! Du fährst viele Kilometer pro Tour. Weiter so!' :
    data.avg_km_pro_tour >= 10 ? 'Gut! Nimm längere Touren an, um deinen Km-Schnitt zu steigern.' :
    'Tipp: Akzeptiere Touren mit mehr Stopps für mehr Kilometer pro Fahrt.';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="w-5 h-5 text-blue-500" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Meine KM/Tour</h3>
      </div>

      <div className="flex items-end gap-4">
        <div>
          <div className="text-5xl font-extrabold text-blue-600 dark:text-blue-400">{data.avg_km_pro_tour}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">km pro Tour (Ø 30 Tage)</div>
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

      <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
        {coaching}
      </div>

      <div className="text-right text-xs text-gray-400">{data.touren} Touren analysiert · 30 Min Polling</div>
    </div>
  );
}
