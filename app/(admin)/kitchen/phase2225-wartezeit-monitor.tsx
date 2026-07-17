'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Clock } from 'lucide-react';

type FahrerWartezeit = {
  fahrer_id: string;
  name: string;
  avg_wartezeit_min: number;
  auftraege_ueber5min: number;
  auftraege_gesamt: number;
};

type ApiData = {
  drivers: FahrerWartezeit[];
  team_avg_wartezeit: number;
};

export function KitchenPhase2225WartezeitMonitor({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-wartezeit?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const langeFahrer = useMemo(
    () => (data?.drivers ?? []).filter((f) => f.avg_wartezeit_min >= 15),
    [data],
  );

  const teamAvg = useMemo(() => data?.team_avg_wartezeit ?? 0, [data]);

  if (!locationId) return null;

  return (
    <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-4 mb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-orange-900 dark:text-orange-200">Wartezeit-Monitor</span>
          {langeFahrer.length > 0 && (
            <span className="text-xs bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {langeFahrer.length} &gt;15 Min.
            </span>
          )}
        </div>
        <span className="text-orange-600 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {langeFahrer.length > 0 && (
            <div className="flex items-start gap-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Dispatcher informieren:</strong>{' '}
                {langeFahrer.map((f) => `${f.name} (${f.avg_wartezeit_min} Min.)`).join(', ')} warten lange — Küche-Timing prüfen!
              </span>
            </div>
          )}

          {(data?.drivers ?? []).length === 0 ? (
            <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">
              Keine Fahrer-Daten verfügbar
            </div>
          ) : (
            (data?.drivers ?? [])
              .filter((f) => f.avg_wartezeit_min > 0)
              .sort((a, b) => b.avg_wartezeit_min - a.avg_wartezeit_min)
              .map((f) => {
                const rot = f.avg_wartezeit_min >= 15;
                const gelb = f.avg_wartezeit_min >= 10 && !rot;
                return (
                  <div
                    key={f.fahrer_id}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                      rot
                        ? 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700'
                        : gelb
                        ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700'
                        : 'bg-white dark:bg-gray-800/20 border border-gray-100 dark:border-gray-700'
                    }`}
                  >
                    <span className={`font-medium ${rot ? 'text-red-800 dark:text-red-200' : 'text-gray-700 dark:text-gray-300'}`}>
                      {f.name}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">
                        {f.auftraege_ueber5min}/{f.auftraege_gesamt} &gt;5 Min.
                      </span>
                      <span className={`font-bold ${rot ? 'text-red-600 dark:text-red-400' : gelb ? 'text-yellow-600 dark:text-yellow-400' : 'text-green-600 dark:text-green-400'}`}>
                        {f.avg_wartezeit_min} Min.
                      </span>
                    </div>
                  </div>
                );
              })
          )}

          <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 pt-1">
            <span>Team-Ø: {teamAvg} Min.</span>
            <span>Grün &lt;10 · Gelb &lt;15 · Rot ≥15</span>
          </div>
        </div>
      )}
    </div>
  );
}
