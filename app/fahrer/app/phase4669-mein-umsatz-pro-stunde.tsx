'use client';

import { useEffect, useState } from 'react';
import { Euro, WifiOff } from 'lucide-react';

interface FahrerUmsatzRow {
  fahrer_id: string;
  fahrer_name: string;
  umsatz_pro_stunde: number;
  rang: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  fahrer: FahrerUmsatzRow[];
  team_avg_umsatz: number;
}

export function FahrerPhase4669MeinUmsatzProStunde({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<FahrerUmsatzRow | null>(null);
  const [teamAvg, setTeamAvg] = useState<number>(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-umsatz-pro-stunde${params}`);
        if (!res.ok) throw new Error();
        const json: ApiResponse = await res.json();
        const me = json.fahrer.find(f => f.fahrer_id === driverId) ?? json.fahrer[0] ?? null;
        if (!cancelled) {
          setData(me);
          setTeamAvg(json.team_avg_umsatz);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [driverId, locationId, isOnline]);

  if (!isOnline) return null;

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-xs">Umsatz/h nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 animate-pulse h-32" />;
  }

  const coaching =
    data.umsatz_pro_stunde >= 22
      ? `Exzellent! Mit ${data.umsatz_pro_stunde}€/h gehörst du zu den Top-Fahrern. Weiter so!`
      : data.umsatz_pro_stunde >= 16
      ? `Solide! Du liegst bei ${data.umsatz_pro_stunde}€/h. Mit mehr Touren in Stoßzeiten kannst du die 22€/h Marke knacken.`
      : `Dein Umsatz/h liegt bei ${data.umsatz_pro_stunde}€/h. Versuche mehr Mehrfachlieferungen und Stoßzeiten-Schichten für höheren Durchschnitt.`;

  const rangColor =
    data.ampel === 'gruen'
      ? 'text-green-700 dark:text-green-400'
      : data.ampel === 'gelb'
      ? 'text-yellow-600 dark:text-yellow-400'
      : 'text-red-600 dark:text-red-400';

  return (
    <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-white dark:bg-gray-900 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Euro className="w-4 h-4 text-amber-800 dark:text-amber-400" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Mein Umsatz/Stunde</span>
      </div>

      {/* Main KPIs */}
      <div className="flex items-end gap-3">
        <div className="space-y-0">
          <div className="text-[10px] text-amber-700 dark:text-amber-400 font-medium">€/h</div>
          <div className="text-5xl font-extrabold text-amber-800 dark:text-amber-300 leading-none">{data.umsatz_pro_stunde}</div>
        </div>
        <div className="flex flex-col items-start pb-1 gap-0.5">
          <div className="text-[10px] text-gray-500">Rang</div>
          <div className={`text-2xl font-bold leading-none ${rangColor}`}>#{data.rang}</div>
        </div>
      </div>

      {/* Comparison bar */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-amber-700 dark:text-amber-400 w-6 shrink-0">Du</span>
          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2.5">
            <div
              className="bg-amber-500 dark:bg-amber-400 h-2.5 rounded-full transition-all"
              style={{ width: `${Math.min((data.umsatz_pro_stunde / 40) * 100, 100)}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-amber-800 dark:text-amber-300 w-10 text-right">{data.umsatz_pro_stunde}€</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-gray-500 w-6 shrink-0">Ø</span>
          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2.5">
            <div
              className="bg-gray-400 dark:bg-gray-500 h-2.5 rounded-full transition-all"
              style={{ width: `${Math.min((teamAvg / 40) * 100, 100)}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 w-10 text-right">{teamAvg}€</span>
        </div>
      </div>

      <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug border-t border-gray-100 dark:border-gray-800 pt-1.5">
        {coaching}
      </p>
    </div>
  );
}
