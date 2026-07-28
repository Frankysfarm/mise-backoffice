'use client';

import { useEffect, useState } from 'react';
import { Clock, WifiOff } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  stunden: number[]; // pct per hour 0–23
  top_stunde: number;
  top_pct: number;
}

interface StundeStat {
  stunde: number;
  team_avg: number;
  top_fahrer: string;
  top_pct: number;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  stunden_stats: StundeStat[];
  gesamt: number;
}

// Show every 3rd label to avoid crowding
const LABEL_HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 23];

function heatColor(pct: number): string {
  if (pct >= 20) return 'bg-indigo-700 dark:bg-indigo-500';
  if (pct >= 12) return 'bg-indigo-500 dark:bg-indigo-600';
  if (pct >= 6)  return 'bg-indigo-300 dark:bg-indigo-800';
  if (pct >= 2)  return 'bg-indigo-100 dark:bg-indigo-950';
  return 'bg-gray-50 dark:bg-gray-900';
}

function heatText(pct: number): string {
  if (pct >= 12) return 'text-white';
  if (pct >= 6)  return 'text-indigo-900 dark:text-indigo-200';
  return 'text-gray-400 dark:text-gray-600';
}

function fmtHour(h: number): string {
  return `${String(h).padStart(2, '0')}`;
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
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-5 h-5" />
        <span className="text-sm">Peak-Stunden-Board nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 animate-pulse h-64" />
    );
  }

  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-gray-900 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-indigo-900 dark:text-indigo-300" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Peak-Stunden-Heatmap</h3>
        <span className="ml-auto text-xs text-gray-400">{data.gesamt} Fahrer · letzte 30 Tage</span>
      </div>

      {/* Heatmap: rows = fahrer, cols = hours */}
      <div className="overflow-x-auto">
        <table className="text-[9px] border-separate border-spacing-px w-max">
          <thead>
            <tr>
              <th className="text-left text-gray-500 dark:text-gray-400 font-normal pb-1 pr-2 min-w-[60px]" />
              {HOURS.map(h => (
                <th key={h} className="text-center text-gray-400 dark:text-gray-600 font-normal pb-0.5 min-w-[16px]">
                  {LABEL_HOURS.includes(h) ? fmtHour(h) : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.fahrer.map(f => (
              <tr key={f.fahrer_id}>
                <td className="pr-2 py-0.5 text-gray-700 dark:text-gray-300 font-medium truncate max-w-[60px] text-[10px]">
                  {f.fahrer_name}
                </td>
                {HOURS.map(h => {
                  const pct = f.stunden[h];
                  const isTop = h === f.top_stunde;
                  return (
                    <td key={h} className="py-0.5">
                      <div
                        className={`w-4 h-4 rounded-sm flex items-center justify-center ${heatColor(pct)} ${heatText(pct)} ${isTop ? 'ring-1 ring-indigo-500 ring-offset-0' : ''}`}
                        title={`${fmtHour(h)}h: ${pct}%`}
                      >
                        {pct >= 12 ? <span>{pct}</span> : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Team-Ø row */}
            <tr className="border-t border-gray-100 dark:border-gray-800">
              <td className="pr-2 pt-1 text-indigo-900 dark:text-indigo-300 font-semibold text-[9px]">Team-Ø</td>
              {data.stunden_stats.map(st => (
                <td key={st.stunde} className="pt-1">
                  <div
                    className={`w-4 h-1.5 rounded-sm ${st.team_avg >= 10 ? 'bg-indigo-500' : st.team_avg >= 5 ? 'bg-indigo-300' : 'bg-indigo-100 dark:bg-indigo-950'}`}
                    title={`${fmtHour(st.stunde)}h Ø ${st.team_avg}%`}
                  />
                </td>
              ))}
            </tr>

            {/* Top-Fahrer je Stunde row */}
            <tr>
              <td className="pr-2 pt-0.5 text-gray-400 text-[8px]">Top</td>
              {data.stunden_stats.map(st => (
                <td key={st.stunde} className="pt-0.5 text-center">
                  {st.top_pct >= 10 && (
                    <div className="text-[7px] text-gray-500 dark:text-gray-400 leading-tight truncate max-w-[16px]" title={`${st.top_fahrer} ${st.top_pct}%`}>
                      {st.top_fahrer.split(' ')[0].slice(0, 2)}
                    </div>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Top-Stunden Summary */}
      <div className="grid grid-cols-2 gap-2">
        {data.fahrer.slice(0, 4).map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-2 bg-indigo-50 dark:bg-indigo-950 rounded-lg px-3 py-2">
            <span className="text-[10px] font-medium text-gray-600 dark:text-gray-300 truncate flex-1">{f.fahrer_name}</span>
            <span className="text-[10px] font-bold text-indigo-900 dark:text-indigo-300">{fmtHour(f.top_stunde)}h</span>
            <span className="text-[10px] text-gray-500">({f.top_pct}%)</span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[9px] text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-2">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-indigo-700 inline-block" />≥20%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-indigo-500 inline-block" />12–19%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-indigo-300 inline-block" />6–11%</span>
        <span className="ml-auto">Ring = Top-Stunde je Fahrer</span>
      </div>
    </div>
  );
}
