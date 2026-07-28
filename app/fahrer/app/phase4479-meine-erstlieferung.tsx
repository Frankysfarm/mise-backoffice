'use client';

import { useState, useEffect, useCallback } from 'react';
import { PackageCheck, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerErstlieferung {
  driver_id: string;
  name: string;
  rang: number;
  erstlieferung_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rank_delta: number;
}

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase4479MeineErstlieferung({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<FahrerErstlieferung | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!isOnline) return;
    const params = new URLSearchParams();
    if (locationId) params.set('location_id', locationId);
    if (driverId) params.set('driver_id', driverId);
    const res = await fetch(`/api/delivery/admin/fahrer-erstlieferung-ranking?${params.toString()}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json.ranking) ? json.ranking as FahrerErstlieferung[] : [];
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
      <span className="text-sm text-gray-500 dark:text-gray-400">Erstlieferung — Offline nicht verfügbar</span>
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
    data.erstlieferung_pct >= 95 ? 'Ausgezeichnet! Du lieferst fast immer beim Erstversuch — weiter so!' :
    data.erstlieferung_pct >= 85 ? 'Gut! Klingeln, kurz warten und Kundenanruf können die Erstlieferrate weiter steigern.' :
    'Tipp: Ruf den Kunden kurz vor Ankunft an und hinterlasse eine Nachricht, damit beim Erstversuch jemand öffnet.';

  const deltaIcon =
    data.rank_delta > 0 ? <TrendingUp className="w-4 h-4 text-emerald-500" /> :
    data.rank_delta < 0 ? <TrendingDown className="w-4 h-4 text-red-400" /> :
    <Minus className="w-4 h-4 text-gray-400" />;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <PackageCheck className="w-5 h-5 text-green-600" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Meine Erstlieferung</h3>
      </div>

      <div className="flex items-end gap-4">
        <div>
          <div className="text-5xl font-extrabold text-green-600 dark:text-green-400">{data.erstlieferung_pct}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Erstversuch-Erfolgsrate (30 Tage)</div>
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

      <div className="rounded-lg bg-green-50 dark:bg-green-900/20 px-3 py-2 text-xs text-green-700 dark:text-green-300">
        {coaching}
      </div>

      <div className="text-xs text-gray-400">Ziel: ≥90% · Sehr gut: ≥95%</div>
    </div>
  );
}
