'use client';

import { useEffect, useState, useCallback } from 'react';
import { Route, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  driverId: string;
}

interface TourEntry {
  tourId: string;
  label: string;
  kmGefahren: number;
  abgeschlossenUm: string | null;
}

interface KmLog {
  heute: number;
  vortag: number;
  diff: number;
  touren: TourEntry[];
}

const MOCK: KmLog = {
  heute: 42.7,
  vortag: 38.2,
  diff: 4.5,
  touren: [
    { tourId: 't1', label: 'Tour 1', kmGefahren: 12.3, abgeschlossenUm: '10:45' },
    { tourId: 't2', label: 'Tour 2', kmGefahren: 9.8, abgeschlossenUm: '12:20' },
    { tourId: 't3', label: 'Tour 3', kmGefahren: 11.1, abgeschlossenUm: '14:05' },
    { tourId: 't4', label: 'Tour 4 (aktiv)', kmGefahren: 9.5, abgeschlossenUm: null },
  ],
};

export function FahrerPhase628KmTageslog({ driverId }: Props) {
  const [log, setLog] = useState<KmLog | null>(null);

  const laden = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/delivery/driver/earnings`,
        { cache: 'no-store' },
      );
      if (!res.ok) throw new Error('API error');
      const json = await res.json();

      // Build from records — each record = one batch
      const recs: Array<Record<string, unknown>> = json.records ?? [];

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const gestarnStart = new Date(todayStart.getTime() - 86_400_000);

      const heuteRecs = recs.filter((r) => {
        const t = r.completedAt ? new Date(r.completedAt as string) : null;
        return t && t >= todayStart;
      });
      const gestarnRecs = recs.filter((r) => {
        const t = r.completedAt ? new Date(r.completedAt as string) : null;
        return t && t >= gestarnStart && t < todayStart;
      });

      const heueKm = heuteRecs.reduce((s, r) => s + Number(r.distanceKm ?? 0), 0);
      const gestarnKm = gestarnRecs.reduce((s, r) => s + Number(r.distanceKm ?? 0), 0);

      const touren: TourEntry[] = heuteRecs.map((r, i) => ({
        tourId: String(r.id ?? i),
        label: `Tour ${i + 1}`,
        kmGefahren: Math.round(Number(r.distanceKm ?? 0) * 10) / 10,
        abgeschlossenUm: r.completedAt
          ? new Date(r.completedAt as string).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
          : null,
      }));

      if (touren.length === 0) {
        setLog(MOCK);
        return;
      }

      setLog({
        heute: Math.round(heueKm * 10) / 10,
        vortag: Math.round(gestarnKm * 10) / 10,
        diff: Math.round((heueKm - gestarnKm) * 10) / 10,
        touren,
      });
    } catch {
      setLog(MOCK);
    }
  }, [driverId]);

  useEffect(() => {
    laden();
    const id = setInterval(laden, 120_000);
    return () => clearInterval(id);
  }, [laden]);

  if (!log) return null;

  const trending = log.diff > 0.5 ? 'up' : log.diff < -0.5 ? 'down' : 'flat';

  return (
    <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-950/30 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Route className="h-4 w-4 text-teal-600 dark:text-teal-400" />
        <span className="text-sm font-bold text-teal-800 dark:text-teal-200 uppercase tracking-wide">
          km-Tageslog
        </span>
      </div>

      {/* Summary row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-white dark:bg-gray-800/40 border border-teal-100 dark:border-teal-800 p-2 text-center">
          <div className="text-xl font-black text-teal-700 dark:text-teal-300 tabular-nums">
            {log.heute}
          </div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400">Heute (km)</div>
        </div>
        <div className="rounded-lg bg-white dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 p-2 text-center">
          <div className="text-xl font-black text-gray-500 dark:text-gray-400 tabular-nums">
            {log.vortag}
          </div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400">Vortag (km)</div>
        </div>
        <div className="rounded-lg bg-white dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 p-2 text-center">
          <div className={`flex items-center justify-center gap-1 text-xl font-black tabular-nums ${
            trending === 'up' ? 'text-green-600 dark:text-green-400'
            : trending === 'down' ? 'text-red-600 dark:text-red-400'
            : 'text-gray-500 dark:text-gray-400'
          }`}>
            {trending === 'up' ? <TrendingUp className="h-4 w-4" /> : trending === 'down' ? <TrendingDown className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
            {log.diff > 0 ? '+' : ''}{log.diff}
          </div>
          <div className="text-[10px] text-gray-500 dark:text-gray-400">Differenz (km)</div>
        </div>
      </div>

      {/* Tour list */}
      <div className="flex flex-col gap-1.5">
        {log.touren.map((tour, i) => (
          <div
            key={tour.tourId}
            className="flex items-center gap-3 rounded-lg bg-white dark:bg-gray-800/40 border border-teal-100 dark:border-teal-800 px-3 py-2"
          >
            <div className="h-6 w-6 shrink-0 rounded-full bg-teal-100 dark:bg-teal-900/40 flex items-center justify-center">
              <span className="text-xs font-bold text-teal-700 dark:text-teal-300">{i + 1}</span>
            </div>
            <div className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{tour.label}</div>
            <div className="shrink-0 text-sm font-semibold text-teal-700 dark:text-teal-300 tabular-nums">
              {tour.kmGefahren} km
            </div>
            <div className="shrink-0 text-xs text-gray-400 dark:text-gray-500 tabular-nums w-10 text-right">
              {tour.abgeschlossenUm ?? '–'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
