'use client';

import { useEffect, useState } from 'react';
import { Clock, WifiOff } from 'lucide-react';

interface FahrerPeakStunden {
  fahrer_id: string;
  fahrer_name: string;
  stunden: number[];
  top_stunde: number;
  top_pct: number;
  gesamt_touren: number;
}

interface ApiResponse {
  fahrer: FahrerPeakStunden[];
  gesamt: number;
}

function fmt(h: number) {
  return `${String(h).padStart(2, '0')}:00`;
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
  const [data, setData] = useState<FahrerPeakStunden | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-peak-stunden${params}`);
        if (!res.ok) throw new Error();
        const json: ApiResponse = await res.json();
        const me = json.fahrer.find(f => f.fahrer_id === driverId) ?? json.fahrer[0] ?? null;
        if (!cancelled) setData(me);
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
        <span className="text-xs">Peak-Stunden nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 animate-pulse h-32" />;
  }

  const maxPct = Math.max(...data.stunden, 1);

  // Coaching text
  const coaching =
    data.top_pct >= 20
      ? `Stark! Du bist am häufigsten um ${fmt(data.top_stunde)} Uhr aktiv — nutze diese Zeit optimal.`
      : data.top_pct >= 10
      ? `Um ${fmt(data.top_stunde)} Uhr bist du am aktivsten. Mehr Schichten in dieser Zeit steigern deine Einnahmen.`
      : `Versuche, deine Peak-Zeit auf ${fmt(data.top_stunde)} Uhr zu legen — dann ist die Nachfrage am höchsten.`;

  return (
    <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900 bg-white dark:bg-gray-900 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Clock className="w-4 h-4 text-indigo-900 dark:text-indigo-300" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Meine Peak-Stunden</span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className="text-4xl font-extrabold text-indigo-900 dark:text-indigo-300">{fmt(data.top_stunde)}</span>
        <span className="text-xl font-bold text-gray-500">{data.top_pct}%</span>
      </div>

      {/* 24-bar chart: hours 0–23 */}
      <div className="flex items-end gap-px h-10">
        {data.stunden.map((pct, h) => {
          const barH = Math.max(2, Math.round((pct / maxPct) * 36));
          const isTop = h === data.top_stunde;
          return (
            <div key={h} className="flex flex-col items-center flex-1" title={`${fmt(h)}: ${pct}%`}>
              <div
                className={`w-full rounded-t ${isTop ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-indigo-200 dark:bg-indigo-800'}`}
                style={{ height: barH }}
              />
            </div>
          );
        })}
      </div>

      {/* Hour labels: show 0,6,12,18,23 */}
      <div className="flex text-[8px] text-gray-400 justify-between px-0.5">
        <span>00h</span>
        <span>06h</span>
        <span>12h</span>
        <span>18h</span>
        <span>23h</span>
      </div>

      <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug border-t border-gray-100 dark:border-gray-800 pt-1.5">
        {coaching}
      </p>

      <div className="text-[10px] text-gray-400">{data.gesamt_touren} Touren · 30 Tage</div>
    </div>
  );
}
