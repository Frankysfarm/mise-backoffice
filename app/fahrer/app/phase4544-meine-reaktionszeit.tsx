'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerReaktion {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  reaktionszeit_min: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rank_delta: number;
}

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase4544MeineReaktionszeit({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<FahrerReaktion | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!isOnline) return;
    const params = new URLSearchParams();
    if (locationId) params.set('location_id', locationId);
    if (driverId) params.set('driver_id', driverId);
    const res = await fetch(`/api/delivery/admin/fahrer-problem-reaktionszeit-ranking?${params.toString()}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json.fahrer) ? json.fahrer as FahrerReaktion[] : [];
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
      <span className="text-sm text-gray-500 dark:text-gray-400">Meine Reaktionszeit — Offline nicht verfügbar</span>
    </div>
  );

  if (loading) return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
      <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded" />
    </div>
  );

  if (!data) return null;

  const rangColor =
    data.ampel === 'gruen' ? 'text-yellow-500 dark:text-yellow-400' :
    data.ampel === 'rot'   ? 'text-red-500 dark:text-red-400' : 'text-orange-500 dark:text-orange-400';

  const coaching =
    data.reaktionszeit_min <= 10 ? 'Ausgezeichnet! Du reagierst blitzschnell auf Probleme — das schafft Vertrauen bei Kunden und Dispatch.' :
    data.reaktionszeit_min <= 20 ? 'Gut! Versuche bei Problemfällen noch schneller zu antworten — Ziel ist unter 15 Minuten.' :
    'Tipp: Melde Probleme sofort über die App und halte Dispatch immer auf dem Laufenden — schnelle Reaktion verbessert dein Ranking.';

  const deltaIcon =
    data.rank_delta > 0 ? <TrendingUp className="w-4 h-4 text-emerald-500" /> :
    data.rank_delta < 0 ? <TrendingDown className="w-4 h-4 text-red-400" /> :
    <Minus className="w-4 h-4 text-gray-400" />;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="w-5 h-5 text-yellow-500" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Meine Problem-Reaktionszeit</h3>
      </div>

      <div className="flex items-end gap-4">
        <div>
          <div className={`text-5xl font-extrabold ${rangColor}`}>{data.reaktionszeit_min?.toFixed(1)}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Minuten Ø Reaktionszeit (30 Tage)</div>
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

      <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 text-xs text-yellow-800 dark:text-yellow-300">
        {coaching}
      </div>

      <div className="text-xs text-gray-400">Ziel: ≤15 min · Sehr gut: ≤10 min</div>
    </div>
  );
}
