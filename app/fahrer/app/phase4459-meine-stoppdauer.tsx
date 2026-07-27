'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerStoppdauer {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_sec: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

function secToMin(sec: number): string {
  return (Math.round(sec / 6) / 10).toFixed(1);
}

export function FahrerPhase4459MeineStoppdauer({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<FahrerStoppdauer | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!isOnline) return;
    const params = new URLSearchParams();
    if (locationId) params.set('location_id', locationId);
    if (driverId) params.set('driver_id', driverId);
    const res = await fetch(`/api/delivery/admin/fahrer-stoppdauer-ranking?${params.toString()}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json.fahrer) ? json.fahrer as FahrerStoppdauer[] : [];
      const mein = list.find((d) => d.fahrer_id === driverId || d.fahrer_name === driverId) ?? list[0];
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
      <span className="text-sm text-gray-500 dark:text-gray-400">Stoppdauer-Ranking — Offline nicht verfügbar</span>
    </div>
  );

  if (loading) return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
      <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded" />
    </div>
  );

  if (!data) return null;

  const avgMin = parseFloat(secToMin(data.avg_sec));

  const rangColor = data.ampel === 'gruen' ? 'text-emerald-600 dark:text-emerald-400' :
                    data.ampel === 'rot' ? 'text-red-500 dark:text-red-400' : 'text-yellow-500 dark:text-yellow-400';

  const coaching =
    avgMin <= 5 ? 'Ausgezeichnet! Deine Stoppdauer ist sehr kurz — weiter so!' :
    avgMin <= 8 ? 'Gut! Bereite alles vor dem Aussteigen vor, um die Zeit am Stopp zu reduzieren.' :
    'Tipp: Beleg und Wechselgeld bereits im Auto vorbereiten spart wertvolle Sekunden am Stopp.';

  const deltaIcon =
    data.rank_delta < 0 ? <TrendingUp className="w-4 h-4 text-emerald-500" /> :
    data.rank_delta > 0 ? <TrendingDown className="w-4 h-4 text-red-400" /> :
    <Minus className="w-4 h-4 text-gray-400" />;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Timer className="w-5 h-5 text-violet-500" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Meine Stoppdauer</h3>
      </div>

      <div className="flex items-end gap-4">
        <div>
          <div className="text-5xl font-extrabold text-violet-600 dark:text-violet-400">{secToMin(data.avg_sec)}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">min pro Stopp (Ø 30 Tage)</div>
        </div>
        <div className="pb-1">
          <div className={`text-2xl font-bold ${rangColor}`}>#{data.rang}</div>
          <div className="flex items-center gap-1 text-xs mt-0.5">
            {deltaIcon}
            <span className="text-gray-500 dark:text-gray-400">
              {data.rank_delta === 0 ? 'Keine Änderung' : data.rank_delta < 0 ? `+${Math.abs(data.rank_delta)} Plätze` : `-${data.rank_delta} Plätze`}
            </span>
          </div>
        </div>
      </div>

      <div className="rounded-lg bg-violet-50 dark:bg-violet-900/20 px-3 py-2 text-xs text-violet-700 dark:text-violet-300">
        {coaching}
      </div>

      <div className="text-xs text-gray-400">Ziel: ≤5 min · Gut: ≤8 min</div>
    </div>
  );
}
