'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

type FahrerWartezeit = {
  fahrer_id: string;
  name: string;
  avg_wartezeit_min: number;
  auftraege_ueber5min: number;
  auftraege_gesamt: number;
  trend_7tage: number;
};

type ApiData = {
  drivers: FahrerWartezeit[];
  team_avg_wartezeit: number;
};

interface Props {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}

function coachingTipp(avg: number, teamAvg: number): string {
  if (avg < 5) return 'Top — du wartest kaum! Weiter so 🚀';
  if (avg < teamAvg) return 'Gut — du liegst unter dem Team-Ø. Noch etwas Luft nach oben.';
  if (avg < 15) return 'Tipp: Melde dich früher beim Restaurant ab, um Wartezeit zu reduzieren.';
  return 'Wartezeit hoch — bitte mit Dispatcher abstimmen, ob Timing angepasst werden kann.';
}

export function FahrerPhase2223MeineWartezeitBilanz({ driverId, locationId, isOnline }: Props) {
  const [data, setData] = useState<ApiData | null>(null);
  const [open, setOpen] = useState(false);

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
    if (!isOnline) return;
    load();
    const id = setInterval(load, 60 * 60 * 1000);
    return () => clearInterval(id);
  }, [isOnline, load]);

  if (!isOnline || !locationId || !data) return null;

  const meinEintrag = data.drivers.find((f) => f.fahrer_id === driverId) ?? null;
  const teamAvg = data.team_avg_wartezeit;
  const avg = meinEintrag?.avg_wartezeit_min ?? 0;
  const trend = meinEintrag ? avg - meinEintrag.trend_7tage : 0;
  const farbe = avg < 10 ? 'text-green-600 dark:text-green-400' : avg < 15 ? 'text-yellow-600 dark:text-yellow-400' : 'text-red-600 dark:text-red-400';

  return (
    <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-4 mb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-orange-500" />
          <span className="font-semibold text-orange-900 dark:text-orange-200">Meine Wartezeit-Bilanz</span>
          {meinEintrag && (
            <span className={`text-xs font-bold ${farbe}`}>{avg} Min.</span>
          )}
        </div>
        <span className="text-orange-600 text-sm">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {meinEintrag ? (
            <>
              {/* Kennzahlen */}
              <div className="flex gap-3">
                <div className="flex-1 rounded-lg bg-white dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 p-3 text-center">
                  <div className={`text-2xl font-bold ${farbe}`}>{avg} Min.</div>
                  <div className="text-xs text-orange-700 dark:text-orange-400">Meine Ø Wartezeit</div>
                  <div className={`text-xs font-medium mt-0.5 ${trend > 0 ? 'text-red-500' : 'text-green-500'}`}>
                    {trend > 0 ? `+${trend.toFixed(1)}` : trend.toFixed(1)} vs. 7-Tage-Ø
                  </div>
                </div>
                <div className="flex-1 rounded-lg bg-white dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 p-3 text-center">
                  <div className="text-2xl font-bold text-gray-700 dark:text-gray-200">{teamAvg} Min.</div>
                  <div className="text-xs text-orange-700 dark:text-orange-400">Team-Ø</div>
                  <div className={`text-xs font-medium mt-0.5 ${avg <= teamAvg ? 'text-green-500' : 'text-red-500'}`}>
                    {avg <= teamAvg ? `${(teamAvg - avg).toFixed(1)} Min. besser` : `${(avg - teamAvg).toFixed(1)} Min. schlechter`}
                  </div>
                </div>
              </div>

              {/* Coaching-Tipp */}
              <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-3 py-2 text-sm text-blue-800 dark:text-blue-200">
                💡 {coachingTipp(avg, teamAvg)}
              </div>

              <div className="text-xs text-gray-400 dark:text-gray-500 text-center">
                {meinEintrag.auftraege_ueber5min} von {meinEintrag.auftraege_gesamt} Aufträgen &gt;5 Min. gewartet
              </div>
            </>
          ) : (
            <div className="text-sm text-gray-400 dark:text-gray-500 text-center py-2">
              Noch keine Wartezeit-Daten für heute
            </div>
          )}
        </div>
      )}
    </div>
  );
}
