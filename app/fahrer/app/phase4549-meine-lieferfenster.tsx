'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, WifiOff } from 'lucide-react';

interface FensterData {
  fahrer: Array<{
    fahrer_id: string;
    rang: number;
    fenster_pct: number;
    ampel: 'gruen' | 'gelb' | 'rot';
  }>;
  team_avg_pct: number;
  gesamt: number;
}

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase4549MeineLieferfenster({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<FensterData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    if (locationId) params.set('location_id', locationId);
    params.set('driver_id', driverId);
    const res = await fetch(`/api/delivery/admin/fahrer-lieferfenster-ranking?${params}`, { cache: 'no-store' });
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [driverId, locationId]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 30 * 60 * 1000);
    return () => clearInterval(iv);
  }, [fetchData]);

  if (!isOnline) return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 flex items-center gap-3">
      <WifiOff className="w-5 h-5 text-gray-400" />
      <span className="text-sm text-gray-500 dark:text-gray-400">Offline — Lieferfenster nicht verfügbar</span>
    </div>
  );

  if (loading) return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-3" />
      <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded" />
    </div>
  );

  const me = data?.fahrer?.find(f => f.fahrer_id === driverId) ?? data?.fahrer?.[0];
  if (!me) return null;

  const colorClass = me.ampel === 'gruen'
    ? 'text-emerald-600 dark:text-emerald-400'
    : me.ampel === 'gelb'
    ? 'text-yellow-500 dark:text-yellow-400'
    : 'text-red-500 dark:text-red-400';

  const coaching =
    me.fenster_pct >= 90 ? { text: 'Ausgezeichnet! Du hältst Lieferfenster sehr zuverlässig ein.', cls: 'text-emerald-600 dark:text-emerald-400' } :
    me.fenster_pct >= 80 ? { text: 'Gut! Noch etwas Verbesserung bringt dich in die Top-Gruppe.',  cls: 'text-yellow-600 dark:text-yellow-400' } :
                           { text: 'Lieferfenster häufig überschritten — prüfe Route und Zeitpuffer.', cls: 'text-red-500 dark:text-red-400' };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-5 h-5 text-teal-500" />
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Meine Lieferfenster-Genauigkeit</h3>
      </div>

      <div className="flex items-end gap-4 mb-3">
        <div className={`text-5xl font-bold tabular-nums ${colorClass}`}>
          {me.fenster_pct.toFixed(1)}%
        </div>
        <div className="pb-1">
          <div className={`text-2xl font-bold tabular-nums ${colorClass}`}>#{me.rang}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">von {data?.gesamt ?? '–'}</div>
        </div>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Team-Avg: <span className="font-medium text-gray-700 dark:text-gray-300">{data?.team_avg_pct?.toFixed(1) ?? '–'}%</span>
      </div>

      <p className={`text-xs font-medium ${coaching.cls}`}>{coaching.text}</p>
    </div>
  );
}
