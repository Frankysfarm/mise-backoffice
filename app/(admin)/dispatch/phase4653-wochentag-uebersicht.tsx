'use client';

import { useEffect, useState } from 'react';
import { BarChart2, WifiOff } from 'lucide-react';

const TAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;
type Tag = typeof TAGE[number];

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  anteile: Record<Tag, number>;
  top_tag: Tag;
}

interface TagStat {
  tag: Tag;
  team_avg: number;
  top_fahrer: string;
  top_pct: number;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  tag_stats: TagStat[];
  gesamt: number;
}

function pctColor(pct: number): string {
  if (pct >= 20) return 'bg-indigo-600 dark:bg-indigo-500';
  if (pct >= 12) return 'bg-indigo-400 dark:bg-indigo-400';
  if (pct >= 6) return 'bg-indigo-200 dark:bg-indigo-800';
  return 'bg-gray-100 dark:bg-gray-800';
}

function pctText(pct: number): string {
  if (pct >= 20) return 'text-white';
  if (pct >= 12) return 'text-indigo-900 dark:text-white';
  return 'text-gray-500 dark:text-gray-400';
}

export function DispatchPhase4653WochentagUebersicht({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-wochentag-uebersicht${params}`);
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
        <span className="text-sm">Wochentag-Übersicht nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 animate-pulse h-56" />
    );
  }

  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-gray-900 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <BarChart2 className="w-5 h-5 text-indigo-900 dark:text-indigo-300" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Wochentag-Übersicht</h3>
        <span className="ml-auto text-xs text-gray-400">{data.gesamt} Fahrer · letzte 30 Tage</span>
      </div>

      {/* 7-Column Matrix */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-separate border-spacing-0.5">
          <thead>
            <tr>
              <th className="text-left text-gray-500 dark:text-gray-400 font-normal pb-1 pr-2 min-w-[70px]">Fahrer</th>
              {TAGE.map(tag => (
                <th key={tag} className="text-center text-gray-500 dark:text-gray-400 font-normal pb-1 min-w-[36px]">
                  {tag}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.fahrer.map(f => (
              <tr key={f.fahrer_id}>
                <td className="pr-2 py-0.5 text-gray-700 dark:text-gray-300 font-medium truncate max-w-[70px]">
                  {f.fahrer_name}
                </td>
                {TAGE.map(tag => {
                  const pct = f.anteile[tag];
                  const isTop = tag === f.top_tag;
                  return (
                    <td key={tag} className="py-0.5 text-center">
                      <div
                        className={`mx-auto rounded px-1 py-0.5 text-[10px] font-medium ${pctColor(pct)} ${pctText(pct)} ${isTop ? 'ring-1 ring-indigo-500 dark:ring-indigo-400' : ''}`}
                        style={{ minWidth: 28 }}
                      >
                        {pct}%
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}

            {/* Team-Ø row */}
            <tr className="border-t border-gray-100 dark:border-gray-800">
              <td className="pr-2 pt-1.5 text-indigo-900 dark:text-indigo-300 font-semibold text-[10px]">Team-Ø</td>
              {data.tag_stats.map(ts => (
                <td key={ts.tag} className="text-center pt-1.5">
                  <div className="text-[10px] font-semibold text-indigo-900 dark:text-indigo-300">{ts.team_avg}%</div>
                </td>
              ))}
            </tr>

            {/* Top Fahrer row */}
            <tr>
              <td className="pr-2 pt-0.5 text-gray-400 text-[9px]">Top</td>
              {data.tag_stats.map(ts => (
                <td key={ts.tag} className="text-center pt-0.5">
                  <div className="text-[9px] text-gray-500 dark:text-gray-400 truncate max-w-[36px] mx-auto leading-tight">
                    {ts.top_fahrer.split(' ')[0]}
                  </div>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 text-[10px] text-gray-400 border-t border-gray-100 dark:border-gray-800 pt-2">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-600 inline-block" />≥20%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-400 inline-block" />12–19%</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-200 inline-block" />6–11%</span>
        <span className="ml-auto">Ring = Top-Tag je Fahrer</span>
      </div>
    </div>
  );
}
