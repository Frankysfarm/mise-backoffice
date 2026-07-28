'use client';

import { useEffect, useState } from 'react';
import { Clock, WifiOff } from 'lucide-react';

interface StundeStat {
  stunde: number;
  team_avg: number;
  top_fahrer: string;
  top_pct: number;
}

interface ApiResponse {
  stunden_stats: StundeStat[];
  gesamt: number;
}

function fmtHour(h: number): string {
  return `${String(h).padStart(2, '0')}`;
}

export function KitchenPhase4661PeakStundenTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-peak-stunden${params}`);
        if (!res.ok) throw new Error('fetch failed');
        const json: ApiResponse = await res.json();
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setError(true);
      }
    }

    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [locationId]);

  if (error) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-4 h-4" />
        <span className="text-xs">Peak-Stunden-Ticker nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 animate-pulse h-24" />
    );
  }

  const topStunde = data.stunden_stats.reduce(
    (best, st) => st.top_pct > best.top_pct ? st : best,
    data.stunden_stats[0],
  );

  const maxAvg = Math.max(...data.stunden_stats.map(st => st.team_avg), 1);
  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-gray-900 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Clock className="w-4 h-4 text-indigo-900 dark:text-indigo-300" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Peak-Stunden-Ticker</span>
      </div>

      {topStunde && (
        <div className="flex items-center gap-2">
          <span className="text-lg font-extrabold text-indigo-900 dark:text-indigo-300">
            {fmtHour(topStunde.stunde)}:00
          </span>
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{topStunde.top_fahrer}</span>
          <span className="ml-auto text-sm font-bold text-indigo-900 dark:text-indigo-300">{topStunde.top_pct}%</span>
        </div>
      )}

      {/* 24h mini-bar chart — team average per hour */}
      <div className="flex items-end gap-px h-8">
        {HOURS.map(h => {
          const st = data.stunden_stats[h];
          const barH = Math.max(1, Math.round((st.team_avg / maxAvg) * 28));
          const isTop = h === topStunde?.stunde;
          return (
            <div key={h} className="flex flex-col items-center flex-1">
              <div
                className={`w-full rounded-t ${isTop ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-indigo-200 dark:bg-indigo-800'}`}
                style={{ height: barH }}
                title={`${fmtHour(h)}h Ø ${st.team_avg}%`}
              />
            </div>
          );
        })}
      </div>

      {/* Hour axis labels every 6h */}
      <div className="flex text-[7px] text-gray-400 gap-px">
        {HOURS.map(h => (
          <div key={h} className="flex-1 text-center">
            {h % 6 === 0 ? fmtHour(h) : ''}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-1.5">
        <span>Stärkste Stunde: <span className="font-medium text-indigo-900 dark:text-indigo-300">{fmtHour(topStunde?.stunde ?? 0)}:00</span></span>
        <span>{data.gesamt} Fahrer · 30 Tage</span>
      </div>
    </div>
  );
}
