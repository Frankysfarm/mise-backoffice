'use client';

import { useEffect, useState } from 'react';
import { BarChart2, WifiOff } from 'lucide-react';

const TAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;
type Tag = typeof TAGE[number];

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    anteile: Record<Tag, number>;
    top_tag: Tag;
  }>;
}

const BAR_COLORS: Record<string, string> = {
  Mo: 'bg-indigo-400',
  Di: 'bg-indigo-400',
  Mi: 'bg-indigo-400',
  Do: 'bg-indigo-400',
  Fr: 'bg-indigo-400',
  Sa: 'bg-indigo-400',
  So: 'bg-indigo-400',
};

export function FahrerPhase4654MeineWochentagUebersicht({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<{ anteile: Record<Tag, number>; top_tag: Tag } | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-wochentag-uebersicht${params}`);
        if (!res.ok) throw new Error('fetch failed');
        const json: ApiResponse = await res.json();
        const me = json.fahrer.find(f => f.fahrer_id === driverId);
        if (!cancelled && me) {
          setData({ anteile: me.anteile, top_tag: me.top_tag });
        }
      } catch {
        // silent
      }
    }

    load();
    const iv = setInterval(load, 30 * 60 * 1000);
    return () => { cancelled = true; clearInterval(iv); };
  }, [driverId, locationId, isOnline]);

  if (!isOnline) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 flex items-center gap-2 text-gray-400">
        <WifiOff className="w-5 h-5" />
        <span className="text-sm">Offline — Wochentag-Übersicht nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 animate-pulse h-40" />
    );
  }

  const maxPct = Math.max(...TAGE.map(t => data.anteile[t]), 1);

  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-gray-900 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <BarChart2 className="w-5 h-5 text-indigo-900 dark:text-indigo-300" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Meine Wochentag-Übersicht</h3>
      </div>

      <div className="flex items-end gap-1.5 h-24">
        {TAGE.map(tag => {
          const pct = data.anteile[tag];
          const isTop = tag === data.top_tag;
          const height = Math.max(4, Math.round((pct / maxPct) * 80));
          return (
            <div key={tag} className="flex flex-col items-center flex-1 gap-1">
              <span className={`text-[9px] font-medium ${isTop ? 'text-indigo-900 dark:text-indigo-300' : 'text-gray-400'}`}>
                {pct}%
              </span>
              <div
                className={`w-full rounded-t ${isTop ? 'bg-indigo-600 dark:bg-indigo-400' : BAR_COLORS[tag]}`}
                style={{ height, opacity: isTop ? 1 : 0.55 }}
              />
              <span className={`text-[9px] ${isTop ? 'font-bold text-indigo-900 dark:text-indigo-300' : 'text-gray-400'}`}>
                {tag}
              </span>
            </div>
          );
        })}
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Top-Tag:{' '}
        <span className="font-semibold text-indigo-900 dark:text-indigo-300">{data.top_tag}</span>
        {' · '}
        {data.anteile[data.top_tag]}% deiner Touren
      </div>
    </div>
  );
}
