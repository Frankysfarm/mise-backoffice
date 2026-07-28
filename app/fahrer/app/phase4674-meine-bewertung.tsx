'use client';

import { useEffect, useState } from 'react';
import { Star, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_rating: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_rating: number;
  gesamt: number;
}

function StarRating({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'w-5 h-5' : 'w-3 h-3';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={`${cls} ${i <= Math.round(value) ? 'text-rose-500 fill-rose-500' : 'text-gray-300 dark:text-gray-600'}`}
        />
      ))}
    </div>
  );
}

export function FahrerPhase4674MeineBewertung({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<FahrerRow | null>(null);
  const [teamAvg, setTeamAvg] = useState<number>(0);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-bewertung-ranking${params}`);
        if (!res.ok) throw new Error();
        const json: ApiResponse = await res.json();
        const me = json.fahrer.find(f => f.fahrer_id === driverId) ?? json.fahrer[0] ?? null;
        if (!cancelled) {
          setData(me);
          setTeamAvg(json.team_avg_rating);
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
        <span className="text-xs">Bewertung nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 animate-pulse h-32" />;
  }

  const coaching =
    data.avg_rating >= 4.8
      ? `Hervorragend! Mit ${data.avg_rating.toFixed(1)} Sternen gehörst du zu den Top-Fahrern. Weiter so!`
      : data.avg_rating >= 4.5
      ? `Gut! Deine Bewertung liegt bei ${data.avg_rating.toFixed(1)} Sternen. Mit freundlichem Auftreten und pünktlicher Lieferung kannst du die 4.8 knacken.`
      : `Deine Bewertung liegt bei ${data.avg_rating.toFixed(1)} Sternen. Achte auf Pünktlichkeit und Freundlichkeit – das macht den Unterschied für Kunden.`;

  const rangColor =
    data.ampel === 'gruen'
      ? 'text-green-700 dark:text-green-400'
      : data.ampel === 'gelb'
      ? 'text-yellow-600 dark:text-yellow-400'
      : 'text-red-600 dark:text-red-400';

  return (
    <div className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-gray-900 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Star className="w-4 h-4 text-rose-900 dark:text-rose-400 fill-rose-900 dark:fill-rose-400" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Meine Bewertung</span>
      </div>

      {/* Main KPIs */}
      <div className="flex items-end gap-3">
        <div className="space-y-0">
          <div className="text-[10px] text-rose-700 dark:text-rose-400 font-medium">Ø Sterne</div>
          <div className="text-5xl font-extrabold text-rose-800 dark:text-rose-300 leading-none">{data.avg_rating.toFixed(1)}</div>
        </div>
        <div className="flex flex-col items-start pb-1 gap-0.5">
          <div className="text-[10px] text-gray-500">Rang</div>
          <div className={`text-2xl font-bold leading-none ${rangColor}`}>#{data.rang}</div>
        </div>
      </div>

      {/* Star visualization */}
      <StarRating value={data.avg_rating} size="lg" />

      {/* Comparison bar */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-rose-700 dark:text-rose-400 w-6 shrink-0">Du</span>
          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2.5">
            <div
              className="bg-rose-500 dark:bg-rose-400 h-2.5 rounded-full transition-all"
              style={{ width: `${(data.avg_rating / 5) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-rose-800 dark:text-rose-300 w-8 text-right">{data.avg_rating.toFixed(1)}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-gray-500 w-6 shrink-0">Ø</span>
          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2.5">
            <div
              className="bg-gray-400 dark:bg-gray-500 h-2.5 rounded-full transition-all"
              style={{ width: `${(teamAvg / 5) * 100}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 w-8 text-right">{teamAvg.toFixed(2)}</span>
        </div>
      </div>

      <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug border-t border-gray-100 dark:border-gray-800 pt-1.5">
        {coaching}
      </p>
    </div>
  );
}
