'use client';

import { useCallback, useEffect, useState } from 'react';
import { Route } from 'lucide-react';

type FahrerRoutenScore = {
  fahrer_id: string;
  routen_score: number;
  km_je_tour: number;
  km_je_tour_vorwoche: number | null;
  trend: 'besser' | 'gleich' | 'schlechter';
  delta_pct: number;
  touren_heute: number;
  level: 'hoch' | 'mittel' | 'niedrig';
  hinweis: string;
};

type ApiData = {
  fahrer: FahrerRoutenScore[];
  team_ø_score: number;
  team_ø_km_je_tour: number;
};

function scoreColor(level: FahrerRoutenScore['level']): string {
  if (level === 'hoch') return 'text-green-600 dark:text-green-400';
  if (level === 'mittel') return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function trendLabel(trend: FahrerRoutenScore['trend']): string {
  if (trend === 'besser') return '↓ Verbessert';
  if (trend === 'schlechter') return '↑ Verschlechtert';
  return '→ Stabil';
}

export function FahrerPhase2241MeineRoutenEffizienz({
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
      const res = await fetch(`/api/delivery/admin/fahrer-routen-score?location_id=${locationId}`);
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

  const mein = data.fahrer.find((f) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!mein) return null;

  const barWidth = `${mein.routen_score}%`;

  return (
    <div className="rounded-xl border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-950/30 p-4 mb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Route className="w-4 h-4 text-purple-500" />
          <span className="font-semibold text-purple-900 dark:text-purple-200">Meine Routen-Effizienz</span>
        </div>
        <span className={`text-sm font-bold ${scoreColor(mein.level)}`}>{mein.routen_score}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <div className={`text-4xl font-bold ${scoreColor(mein.level)}`}>{mein.routen_score}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Routen-Score heute</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-gray-800 dark:text-white">{mein.km_je_tour.toFixed(1)} km</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">pro Tour · {mein.touren_heute} Touren</div>
            </div>
          </div>

          <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${mein.level === 'hoch' ? 'bg-green-500' : mein.level === 'mittel' ? 'bg-yellow-500' : 'bg-red-500'}`}
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
              <div className="text-xs text-gray-500 dark:text-gray-400">Vorwoche</div>
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                {mein.km_je_tour_vorwoche !== null ? `${mein.km_je_tour_vorwoche.toFixed(1)} km` : '—'}
              </div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 px-2 py-1.5">
              <div className="text-xs text-gray-500 dark:text-gray-400">Team-Ø</div>
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">{data.team_ø_km_je_tour.toFixed(1)} km</div>
            </div>
          </div>

          <div className={`rounded-lg px-3 py-2 text-xs ${mein.level === 'hoch' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' : mein.level === 'mittel' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
            💡 {mein.hinweis}
          </div>
        </div>
      )}
    </div>
  );
}
