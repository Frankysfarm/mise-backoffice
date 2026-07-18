'use client';

import { useCallback, useEffect, useState } from 'react';
import { Timer } from 'lucide-react';

type FahrerReaktionszeit = {
  driver_id: string;
  name: string;
  avg_min: number;
  auftraege: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  trend_delta: number;
  alert: boolean;
};

type ApiData = {
  fahrer: FahrerReaktionszeit[];
  team_avg_min: number;
};

function calcLevel(avg: number): 'schnell' | 'mittel' | 'langsam' {
  if (avg < 3) return 'schnell';
  if (avg < 6) return 'mittel';
  return 'langsam';
}

function scoreColor(level: 'schnell' | 'mittel' | 'langsam'): string {
  if (level === 'schnell') return 'text-green-600 dark:text-green-400';
  if (level === 'mittel') return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function trendLabel(trend: FahrerReaktionszeit['trend']): string {
  if (trend === 'besser') return '↓ Verbessert';
  if (trend === 'schlechter') return '↑ Verschlechtert';
  return '→ Stabil';
}

function calcTipp(level: 'schnell' | 'mittel' | 'langsam', trend: FahrerReaktionszeit['trend']): string {
  if (level === 'schnell' && trend === 'besser') return 'Blitzschnell — weiter so! Du bist einer der schnellsten.';
  if (level === 'schnell') return 'Sehr schnelle Reaktion — top Leistung!';
  if (level === 'mittel' && trend === 'schlechter') return 'Reaktionszeit steigt — Benachrichtigungen prüfen.';
  if (level === 'mittel') return 'Reaktionszeit okay — noch schneller möglich!';
  return 'Aufträge schneller annehmen — App-Benachrichtigungen aktivieren.';
}

export function FahrerPhase2246MeineReaktionszeit({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId || !driverId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-reaktionszeit?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId, driverId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !driverId || !data) return null;

  const mein = data.fahrer.find((f) => f.driver_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const level = calcLevel(mein.avg_min);
  const barWidth = `${Math.max(5, Math.min(100, Math.round((1 - mein.avg_min / 15) * 100)))}%`;

  return (
    <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-4 mb-3">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-orange-900 dark:text-orange-200">Meine Reaktionszeit</span>
        </div>
        <span className={`text-sm font-bold ${scoreColor(level)}`}>{mein.avg_min.toFixed(1)} Min.</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <div className={`text-4xl font-bold ${scoreColor(level)}`}>{mein.avg_min.toFixed(1)}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Ø Reaktionszeit (Min.) heute</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-gray-800 dark:text-white">{mein.auftraege}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Aufträge heute</div>
            </div>
          </div>

          <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${level === 'schnell' ? 'bg-green-500' : level === 'mittel' ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ width: barWidth }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-white dark:bg-gray-800 px-2 py-1.5">
              <div className="text-xs text-gray-500 dark:text-gray-400">Trend</div>
              <div className={`text-sm font-semibold ${mein.trend === 'besser' ? 'text-green-600 dark:text-green-400' : mein.trend === 'schlechter' ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                {trendLabel(mein.trend)}
              </div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 px-2 py-1.5">
              <div className="text-xs text-gray-500 dark:text-gray-400">Δ Vorwoche</div>
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {mein.trend_delta !== 0 ? `${mein.trend_delta > 0 ? '+' : ''}${mein.trend_delta.toFixed(1)} Min.` : '—'}
              </div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 px-2 py-1.5">
              <div className="text-xs text-gray-500 dark:text-gray-400">Team-Ø</div>
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">{data.team_avg_min.toFixed(1)} Min.</div>
            </div>
          </div>

          <div className={`rounded-lg px-3 py-2 text-xs ${level === 'schnell' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : level === 'mittel' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
            💡 {calcTipp(level, mein.trend)}
          </div>
        </div>
      )}
    </div>
  );
}
