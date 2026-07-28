'use client';

import { useEffect, useState } from 'react';
import { Calendar, TrendingDown, TrendingUp, Minus, WifiOff } from 'lucide-react';

interface FahrerVergleich {
  fahrer_id: string;
  fahrer_name: string;
  pct_wochenend: number;
  pct_wochentag: number;
  delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiResponse {
  fahrer: FahrerVergleich[];
  gesamt: number;
}

export function FahrerPhase4664MeinWochenendVergleich({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<FahrerVergleich | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!isOnline) return;
    let cancelled = false;

    async function load() {
      try {
        const params = locationId ? `?location_id=${locationId}` : '';
        const res = await fetch(`/api/delivery/admin/fahrer-wochenend-vergleich${params}`);
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
        <span className="text-xs">WE-Vergleich nicht verfügbar</span>
      </div>
    );
  }

  if (!data) {
    return <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 animate-pulse h-32" />;
  }

  const coaching =
    data.delta >= 10
      ? `Stark! Du fährst deutlich mehr am Wochenende (+${data.delta}%) — genau dort, wo die Nachfrage am höchsten ist.`
      : data.delta >= 0
      ? `Du bist am Wochenende etwas aktiver (+${data.delta}%). Mehr WE-Schichten können deine Einnahmen steigern.`
      : `Du fährst mehr unter der Woche (${data.delta}%). Wochenend-Schichten sind oft lukrativer — probiere es aus!`;

  const DeltaIcon = data.delta >= 5
    ? <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
    : data.delta <= -5
    ? <TrendingDown className="w-5 h-5 text-red-500 dark:text-red-400" />
    : <Minus className="w-5 h-5 text-gray-400" />;

  return (
    <div className="rounded-2xl border border-violet-200 dark:border-violet-900 bg-white dark:bg-gray-900 p-3 space-y-2">
      <div className="flex items-center gap-1.5">
        <Calendar className="w-4 h-4 text-violet-900 dark:text-violet-300" />
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">Mein WE vs. Wochentag</span>
      </div>

      {/* Main KPIs */}
      <div className="flex items-end gap-3">
        <div className="space-y-0">
          <div className="text-[10px] text-violet-600 dark:text-violet-400 font-medium">Wochenende</div>
          <div className="text-5xl font-extrabold text-violet-900 dark:text-violet-300 leading-none">{data.pct_wochenend}%</div>
        </div>
        <div className="flex flex-col items-center pb-1">
          {DeltaIcon}
          <span className={`text-sm font-bold ${data.delta >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {data.delta >= 0 ? '+' : ''}{data.delta}%
          </span>
        </div>
        <div className="space-y-0">
          <div className="text-[10px] text-gray-500 font-medium">Wochentag</div>
          <div className="text-3xl font-bold text-gray-600 dark:text-gray-400 leading-none">{data.pct_wochentag}%</div>
        </div>
      </div>

      {/* Mini bar comparison */}
      <div className="space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-violet-600 dark:text-violet-400 w-6 shrink-0">WE</span>
          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2.5">
            <div
              className="bg-violet-600 dark:bg-violet-400 h-2.5 rounded-full transition-all"
              style={{ width: `${Math.min(data.pct_wochenend * 1.5, 100)}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-violet-900 dark:text-violet-300 w-8 text-right">{data.pct_wochenend}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-gray-500 w-6 shrink-0">WT</span>
          <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2.5">
            <div
              className="bg-gray-400 dark:bg-gray-500 h-2.5 rounded-full transition-all"
              style={{ width: `${Math.min(data.pct_wochentag * 1.5, 100)}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 w-8 text-right">{data.pct_wochentag}%</span>
        </div>
      </div>

      <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-snug border-t border-gray-100 dark:border-gray-800 pt-1.5">
        {coaching}
      </p>
    </div>
  );
}
