'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package, WifiOff } from 'lucide-react';

interface MehrfachData {
  fahrer: Array<{
    fahrer_id: string;
    rang: number;
    avg_lieferungen: number;
    ampel: 'gruen' | 'gelb' | 'rot';
  }>;
  team_avg_lieferungen: number;
  gesamt: number;
}

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase4554MeineMehrfach({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<MehrfachData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams();
    if (locationId) params.set('location_id', locationId);
    params.set('driver_id', driverId);
    const res = await fetch(`/api/delivery/admin/fahrer-mehrfach-ranking?${params}`, { cache: 'no-store' });
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
      <span className="text-sm text-gray-500 dark:text-gray-400">Offline — Bündelungs-Effizienz nicht verfügbar</span>
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
    me.avg_lieferungen >= 3.5 ? { text: 'Top-Bündelung! Du nutzt jede Tour optimal aus.', cls: 'text-emerald-600 dark:text-emerald-400' } :
    me.avg_lieferungen >= 2.5 ? { text: 'Solide! Versuche mehrere Bestellungen pro Tour zu bündeln.', cls: 'text-yellow-600 dark:text-yellow-400' } :
                                 { text: 'Geringe Bündelung — bitte Dispatch um Mehrfach-Touren.', cls: 'text-red-500 dark:text-red-400' };

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Package className="w-5 h-5 text-purple-500" />
        <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Meine Bündelungs-Effizienz</h3>
      </div>

      <div className="flex items-end gap-4 mb-3">
        <div className={`text-5xl font-bold tabular-nums ${colorClass}`}>
          {me.avg_lieferungen.toFixed(1)}
        </div>
        <div className="pb-1">
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Ø Lieferungen/Tour</div>
          <div className={`text-2xl font-bold tabular-nums ${colorClass}`}>#{me.rang}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">von {data?.gesamt ?? '–'}</div>
        </div>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
        Team-Avg: <span className="font-medium text-gray-700 dark:text-gray-300">{data?.team_avg_lieferungen?.toFixed(1) ?? '–'}/Tour</span>
      </div>

      <p className={`text-xs font-medium ${coaching.cls}`}>{coaching.text}</p>
    </div>
  );
}
