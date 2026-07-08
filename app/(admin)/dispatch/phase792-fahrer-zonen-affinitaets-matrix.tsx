'use client';

import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ZoneScore {
  affinityScore: number;
  totalDeliveries: number;
  onTimeCount: number;
  avgStars: number | null;
  ratingCount: number;
  combinedScore: number;
}

type ZoneName = 'A' | 'B' | 'C' | 'D';

interface FahrerRow {
  driverId: string;
  driverName: string;
  zones: Record<ZoneName, ZoneScore | null>;
  bestZone: ZoneName | null;
  totalDeliveries: number;
}

interface TopDriver {
  driverId: string;
  driverName: string;
  score: number;
}

interface ApiResponse {
  ok: boolean;
  rows: FahrerRow[];
  topDriverPerZone: Record<ZoneName, TopDriver | null>;
  total: number;
}

interface Props {
  locationId: string | null;
}

const ZONE_COLORS: Record<ZoneName, string> = {
  A: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  B: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  C: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  D: 'bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300',
};

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500 text-white';
  if (score >= 60) return 'bg-lime-400 text-lime-900';
  if (score >= 40) return 'bg-amber-400 text-amber-900';
  if (score >= 20) return 'bg-orange-400 text-orange-900';
  return 'bg-stone-200 text-stone-500 dark:bg-stone-700 dark:text-stone-400';
}

export function DispatchPhase792FahrerZonenAffinitaetsMatrix({ locationId }: Props) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!locationId) return;
    let active = true;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/delivery/admin/fahrer-zonen-affinitaet?location_id=${locationId}`
        );
        if (!res.ok) return;
        const json = await res.json();
        if (active && json.ok) setData(json);
      } catch {
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 120_000);
    return () => { active = false; clearInterval(id); };
  }, [locationId]);

  if (!locationId) return null;
  if (!loading && (!data || data.rows.length === 0)) return null;

  const zones: ZoneName[] = ['A', 'B', 'C', 'D'];
  const topDriverPerZone = data?.topDriverPerZone ?? { A: null, B: null, C: null, D: null };

  return (
    <div className="rounded-2xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-100 dark:border-stone-800">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400">
          <MapPin className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-black uppercase tracking-wide text-stone-700 dark:text-stone-200">
            Fahrer-Zonen-Affinität
          </div>
          <div className="text-[10px] text-stone-400 dark:text-stone-500">
            Bester Fahrer je Zone · historisch 7d
          </div>
        </div>
        <span className="text-[10px] text-stone-400">2 Min</span>
      </div>

      {/* Top-Fahrer je Zone */}
      <div className="grid grid-cols-4 divide-x divide-stone-100 dark:divide-stone-800 border-b border-stone-100 dark:border-stone-800">
        {zones.map((z) => {
          const top = topDriverPerZone[z];
          return (
            <div key={z} className="px-2 py-2 text-center">
              <span className={cn('text-[9px] font-black px-1.5 py-0.5 rounded-full', ZONE_COLORS[z])}>
                Zone {z}
              </span>
              {top ? (
                <>
                  <div className="mt-1 text-[10px] font-bold text-stone-700 dark:text-stone-200 truncate">
                    {top.driverName.split(' ')[0]}
                  </div>
                  <div className="text-[9px] text-stone-400 tabular-nums">{top.score} Pkt</div>
                </>
              ) : (
                <div className="mt-1 text-[9px] text-stone-400">–</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Matrix table */}
      <div className="overflow-x-auto">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="border-b border-stone-100 dark:border-stone-800">
              <th className="text-left px-3 py-1.5 font-semibold text-stone-500 dark:text-stone-400">Fahrer</th>
              {zones.map((z) => (
                <th key={z} className="text-center px-2 py-1.5 font-semibold text-stone-500 dark:text-stone-400">
                  Zone {z}
                </th>
              ))}
              <th className="text-center px-2 py-1.5 font-semibold text-stone-500 dark:text-stone-400">Best</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50 dark:divide-stone-800/50">
            {(data?.rows ?? []).slice(0, 8).map((row) => (
              <tr key={row.driverId} className="hover:bg-stone-50 dark:hover:bg-stone-800/30 transition-colors">
                <td className="px-3 py-1.5 font-medium text-stone-700 dark:text-stone-200 truncate max-w-[80px]">
                  {row.driverName}
                </td>
                {zones.map((z) => {
                  const s = row.zones[z];
                  return (
                    <td key={z} className="px-2 py-1.5 text-center">
                      {s ? (
                        <span
                          className={cn(
                            'inline-block rounded px-1 py-0.5 text-[9px] font-bold tabular-nums',
                            scoreColor(s.combinedScore),
                          )}
                          title={`${s.totalDeliveries} Lieferungen, ${s.onTimeCount} pünktlich${s.avgStars != null ? `, Ø ${s.avgStars.toFixed(1)}★` : ''}`}
                        >
                          {s.combinedScore}
                        </span>
                      ) : (
                        <span className="text-stone-300 dark:text-stone-600">–</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 text-center">
                  {row.bestZone ? (
                    <span className={cn('inline-block rounded-full px-1.5 py-0.5 text-[9px] font-black', ZONE_COLORS[row.bestZone])}>
                      {row.bestZone}
                    </span>
                  ) : (
                    <span className="text-stone-300 dark:text-stone-600">–</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="px-4 py-2 border-t border-stone-100 dark:border-stone-800 flex items-center gap-3 flex-wrap">
        {[
          { label: '≥80 Sehr gut', cls: 'bg-emerald-500' },
          { label: '≥60 Gut', cls: 'bg-lime-400' },
          { label: '≥40 Mittel', cls: 'bg-amber-400' },
          { label: '<40 Gering', cls: 'bg-stone-200 dark:bg-stone-700' },
        ].map(({ label, cls }) => (
          <span key={label} className="flex items-center gap-1 text-[9px] text-stone-400">
            <span className={cn('h-2 w-2 rounded-sm inline-block', cls)} />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
