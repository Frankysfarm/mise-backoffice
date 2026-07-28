'use client';

import { useEffect, useState } from 'react';
import { Clock, WifiOff } from 'lucide-react';

interface ApiResponse {
  fahrer: Array<{
    fahrer_id: string;
    stunden: number[];
    top_stunde: number;
    top_pct: number;
  }>;
}

function fmtHour(h: number): string {
  return `${String(h).padStart(2, '0')}`;
}

export function FahrerPhase4659MeinePeakStunden({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<{ stunden: number[]; top_stunde: number; top_pct: number } | null>(null);

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-peak-stunden${params}`);
        if (!res.ok) throw new Error('fetch failed');
        const json: ApiResponse = await res.json();
        const me = json.fahrer.find(f => f.fahrer_id === driverId);
        if (!cancelled && me) {
          setData({ stunden: me.stunden, top_stunde: me.top_stunde, top_pct: me.top_pct });
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
        <span className="text-sm">Offline — Peak-Stunden nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 animate-pulse h-40" />
    );
  }

  const maxPct = Math.max(...data.stunden, 1);
  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  const coachingTip =
    data.top_pct >= 20
      ? `Top! Deine stärkste Stunde ${fmtHour(data.top_stunde)}:00 macht ${data.top_pct}% aus — nutze diesen Peak weiter.`
      : data.top_pct >= 10
      ? `Dein Peak bei ${fmtHour(data.top_stunde)}:00 (${data.top_pct}%) hat noch Potenzial — bleib in diesem Fenster aktiv.`
      : `Deine Stunden sind sehr gleichmäßig verteilt. Versuch, dich auf Stoßzeiten zu konzentrieren.`;

  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-gray-900 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-indigo-900 dark:text-indigo-300" />
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Meine Peak-Stunden</h3>
      </div>

      {/* 24-Bar Chart */}
      <div className="flex items-end gap-0.5 h-20">
        {HOURS.map(h => {
          const pct = data.stunden[h];
          const isTop = h === data.top_stunde;
          const height = Math.max(2, Math.round((pct / maxPct) * 64));
          return (
            <div key={h} className="flex flex-col items-center flex-1 gap-0.5" title={`${fmtHour(h)}h: ${pct}%`}>
              <div
                className={`w-full rounded-t transition-colors ${isTop ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-indigo-200 dark:bg-indigo-800'}`}
                style={{ height, opacity: isTop ? 1 : 0.6 }}
              />
            </div>
          );
        })}
      </div>

      {/* Hour labels — only every 6th */}
      <div className="flex text-[8px] text-gray-400 gap-0.5">
        {HOURS.map(h => (
          <div key={h} className="flex-1 text-center">
            {h % 6 === 0 ? fmtHour(h) : ''}
          </div>
        ))}
      </div>

      {/* Peak highlight */}
      <div className="flex items-center justify-center gap-2 bg-indigo-50 dark:bg-indigo-950 rounded-lg px-3 py-2">
        <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        <span className="text-sm font-bold text-indigo-900 dark:text-indigo-300">
          Peak: {fmtHour(data.top_stunde)}:00 Uhr
        </span>
        <span className="text-sm text-gray-500">({data.top_pct}% deiner Touren)</span>
      </div>

      <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug">{coachingTip}</p>
    </div>
  );
}
