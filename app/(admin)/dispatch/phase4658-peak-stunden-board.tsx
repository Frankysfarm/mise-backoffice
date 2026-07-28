'use client';

import { useEffect, useState } from 'react';
import { Clock, WifiOff } from 'lucide-react';

interface StundenStat {
  stunde: number;
  team_avg: number;
  top_fahrer: string;
  top_pct: number;
}

interface ApiResponse {
  stunden_stats: StundenStat[];
  gesamt: number;
}

function fmt(h: number) {
  return `${String(h).padStart(2, '0')}h`;
}

export function DispatchPhase4658PeakStundenBoard({ locationId }: { locationId: string | null }) {
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
        <span className="text-xs">Peak-Stunden-Board nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 animate-pulse h-40" />;
  }

  const stats = data.stunden_stats;
  const maxAvg = Math.max(...stats.map(s => s.team_avg), 1);
  const topStunde = stats.reduce((best, s) => s.team_avg > best.team_avg ? s : best, stats[0]);

  // Group into blocks of 6 for readability
  const blocks: StundenStat[][] = [];
  for (let i = 0; i < 24; i += 6) {
    blocks.push(stats.slice(i, i + 6));
  }

  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-gray-900 p-3 space-y-2">
      <div className="flex items-center gap-1.5 justify-between">
        <div className="flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-indigo-900 dark:text-indigo-300" />
          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Peak-Stunden-Board</span>
        </div>
        <span className="text-[10px] text-gray-400">{data.gesamt} Fahrer · 30 Tage</span>
      </div>

      {topStunde && (
        <div className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950 rounded-lg px-2 py-1.5">
          <span className="text-base font-extrabold text-indigo-900 dark:text-indigo-300">{fmt(topStunde.stunde)}</span>
          <span className="text-xs text-gray-600 dark:text-gray-400 truncate">Top: {topStunde.top_fahrer}</span>
          <span className="ml-auto text-xs font-bold text-indigo-900 dark:text-indigo-300">{topStunde.top_pct}%</span>
        </div>
      )}

      {/* 24-hour heatmap grid: 4 rows × 6 columns */}
      <div className="space-y-1">
        {blocks.map((block, bi) => (
          <div key={bi} className="flex gap-0.5">
            {block.map(s => {
              const ratio = s.team_avg / maxAvg;
              const isTop = s.stunde === topStunde?.stunde;
              const bg = isTop
                ? 'bg-indigo-700 dark:bg-indigo-500'
                : ratio >= 0.75
                ? 'bg-indigo-400 dark:bg-indigo-700'
                : ratio >= 0.4
                ? 'bg-indigo-200 dark:bg-indigo-900'
                : 'bg-gray-100 dark:bg-gray-800';
              return (
                <div
                  key={s.stunde}
                  className={`flex-1 rounded text-center ${bg} flex flex-col items-center justify-center py-1 gap-0`}
                  title={`${fmt(s.stunde)} — Ø ${s.team_avg}% · Top: ${s.top_fahrer} ${s.top_pct}%`}
                >
                  <span className={`text-[8px] leading-tight font-medium ${isTop ? 'text-white' : 'text-gray-600 dark:text-gray-400'}`}>
                    {fmt(s.stunde)}
                  </span>
                  <span className={`text-[9px] font-bold leading-tight ${isTop ? 'text-white' : 'text-indigo-900 dark:text-indigo-300'}`}>
                    {s.team_avg}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-1.5">
        <span>Peak: <span className="font-medium text-indigo-900 dark:text-indigo-300">{fmt(topStunde?.stunde ?? 0)}</span></span>
        <span>Team-Ø: <span className="font-medium">{Math.round(stats.reduce((s, v) => s + v.team_avg, 0) / 24)}% je Std.</span></span>
      </div>
    </div>
  );
}
