'use client';

/**
 * LieferdienstZoneDifficultyKarte — Phase 356
 *
 * Kompakte Karte für Lieferdienst-Übersicht: zeigt Zonen-Schwierigkeit
 * als Balkendiagramm und hebt kritische Zonen hervor.
 * Pollt alle 10 Minuten.
 */

import { useEffect, useState } from 'react';
import { MapPin, TrendingDown } from 'lucide-react';

interface ZoneCacheEntry {
  zone: string;
  avg_difficulty: number;
  stop_count_modifier: number;
  detour_modifier: number;
  sample_count: number;
}

const ZONE_BADGE: Record<string, { bg: string; text: string }> = {
  A: { bg: 'bg-matcha-100', text: 'text-matcha-800' },
  B: { bg: 'bg-blue-100',   text: 'text-blue-800' },
  C: { bg: 'bg-amber-100',  text: 'text-amber-800' },
  D: { bg: 'bg-red-100',    text: 'text-red-800' },
};

function barColor(diff: number): string {
  if (diff >= 4.5) return 'bg-red-500';
  if (diff >= 3.5) return 'bg-amber-500';
  if (diff >= 2.5) return 'bg-yellow-400';
  return 'bg-matcha-500';
}

export function LieferdienstZoneDifficultyKarte({ locationId }: { locationId?: string }) {
  const [entries, setEntries] = useState<ZoneCacheEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      try {
        const url = locationId
          ? `/api/delivery/admin/zone-difficulty?action=cache&location_id=${locationId}`
          : '/api/delivery/admin/zone-difficulty?action=cache';
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json() as { cache?: ZoneCacheEntry[] };
        if (active) setEntries(json.cache ?? []);
      } catch { /* ignore */ } finally {
        if (active) setLoading(false);
      }
    };
    fetchData();
    const t = setInterval(fetchData, 10 * 60 * 1000);
    return () => { active = false; clearInterval(t); };
  }, [locationId]);

  const criticalZones = entries.filter((e) => e.avg_difficulty >= 3.5);

  return (
    <div className="rounded-2xl border border-stone-200 bg-white">
      <div className="flex items-center gap-3 border-b border-stone-100 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <MapPin className="h-4 w-4" />
        </div>
        <div>
          <div className="text-sm font-bold text-char">Zonen-Schwierigkeit</div>
          <div className="text-xs text-stone-400">
            {loading ? 'Lade…' : entries.length === 0 ? 'Kein Feedback vorhanden' : `${entries.length} Zonen analysiert`}
          </div>
        </div>
        {criticalZones.length > 0 && (
          <div className="ml-auto flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5">
            <TrendingDown className="h-3 w-3 text-amber-600" />
            <span className="text-[10px] font-bold text-amber-700">
              {criticalZones.length} Zone{criticalZones.length > 1 ? 'n' : ''} erhöht
            </span>
          </div>
        )}
      </div>

      <div className="p-5">
        {entries.length === 0 && !loading && (
          <p className="text-center text-sm text-stone-400">
            Noch kein Tour-Feedback für Zonen-Analyse vorhanden.
          </p>
        )}
        <div className="space-y-3">
          {entries.map((e) => {
            const badge = ZONE_BADGE[e.zone] ?? ZONE_BADGE.A;
            return (
              <div key={e.zone}>
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${badge.bg} ${badge.text}`}>
                      Zone {e.zone}
                    </span>
                    {e.avg_difficulty >= 3.5 && (
                      <span className="text-[10px] text-amber-600 font-semibold">Erhöht</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-stone-500">
                    <span>{e.avg_difficulty.toFixed(1)}/5</span>
                    <span className="text-stone-300">·</span>
                    <span>n={e.sample_count}</span>
                  </div>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-stone-100">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${barColor(e.avg_difficulty)}`}
                    style={{ width: `${(e.avg_difficulty / 5) * 100}%` }}
                  />
                </div>
                {(e.stop_count_modifier < 1.0 || e.detour_modifier < 1.0) && (
                  <div className="mt-0.5 flex gap-2 text-[9px] text-stone-400">
                    {e.stop_count_modifier < 1.0 && (
                      <span>Kapazität −{Math.round((1 - e.stop_count_modifier) * 100)}%</span>
                    )}
                    {e.detour_modifier < 1.0 && (
                      <span>Detour −{Math.round((1 - e.detour_modifier) * 100)}%</span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default LieferdienstZoneDifficultyKarte;
