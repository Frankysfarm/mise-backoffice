'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, WifiOff } from 'lucide-react';

interface FahrerFenster {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  fenster_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rank_delta: number;
}

interface Props {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}

export function FahrerPhase4549MeineLieferfenster({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<FahrerFenster | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!isOnline) return;
    const params = new URLSearchParams();
    if (locationId) params.set('location_id', locationId);
    if (driverId) params.set('driver_id', driverId);
    const res = await fetch(`/api/delivery/admin/fahrer-lieferfenster-ranking?${params.toString()}`, { cache: 'no-store' });
    if (res.ok) {
      const json = await res.json();
      const list = Array.isArray(json.fahrer) ? json.fahrer as FahrerFenster[] : [];
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
      <span className="text-sm text-gray-500 dark:text-gray-400">Mein Lieferfenster — Offline nicht verfügbar</span>
    </div>
  );

  if (loading) return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 animate-pulse">
      <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded" />
    </div>
  );

  if (!data) return null;

  const rangColor =
    data.ampel === 'gruen' ? 'text-teal-500 dark:text-teal-400' :
    data.ampel === 'rot'   ? 'text-red-500 dark:text-red-400' : 'text-yellow-500 dark:text-yellow-400';

  const coaching =
    data.fenster_pct >= 90 ? 'Ausgezeichnet! Du lieferst nahezu immer im versprochenen Zeitfenster — das macht Kunden glücklich!' :
    data.fenster_pct >= 80 ? 'Gut! Plane deine Route sorgfältig und informiere Kunden frühzeitig bei Verzögerungen.' :
    'Tipp: Starte Touren rechtzeitig und nutze die Routenoptimierung — pünktliche Lieferungen erhöhen deine Bewertung stark.';

  const deltaIcon =
    data.rank_delta > 0 ? <TrendingUp className="w-4 h-4 text-emerald-500" /> :
    data.rank_delta < 0 ? <TrendingDown className="w-4 h-4 text-red-400" /> :
    <Minus className="w-4 h-4 text-gray-400" />;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-teal-500" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">Meine Lieferfenster-Genauigkeit</h3>
      </div>

      <div className="flex items-end gap-4">
        <div>
          <div className={`text-5xl font-extrabold ${rangColor}`}>{data.fenster_pct?.toFixed(1)}%</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Im Zeitfenster (30 Tage)</div>
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

      <div className="rounded-lg bg-teal-50 dark:bg-teal-900/20 px-3 py-2 text-xs text-teal-800 dark:text-teal-300">
        {coaching}
      </div>

      <div className="text-xs text-gray-400">Ziel: ≥88% · Sehr gut: ≥90%</div>
    </div>
  );
}
