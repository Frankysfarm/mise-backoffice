'use client';

import { useCallback, useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

type AmpelWartezeit = 'gruen' | 'gelb' | 'rot';
type TrendWartezeit = 'steigend' | 'fallend' | 'stabil';

type FahrerWartezeitHeute = {
  fahrer_id: string;
  avg_wartezeit_min: number;
  touren_anzahl: number;
  max_wartezeit_min: number;
  avg_wartezeit_vorwoche: number | null;
  trend: TrendWartezeit;
  trend_delta: number;
  ampel: AmpelWartezeit;
  alert: boolean;
};

type ApiData = {
  fahrer: FahrerWartezeitHeute[];
  team_avg_wartezeit_min: number;
};

function ampelTextColor(a: AmpelWartezeit): string {
  if (a === 'gruen') return 'text-green-700 dark:text-green-300';
  if (a === 'gelb') return 'text-yellow-600 dark:text-yellow-300';
  return 'text-red-600 dark:text-red-400';
}

function barColorClass(a: AmpelWartezeit): string {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-400';
  return 'bg-red-500';
}

function trendIcon(t: TrendWartezeit): string {
  if (t === 'steigend') return '↑';
  if (t === 'fallend') return '↓';
  return '→';
}

function coachingTipp(min: number, alert: boolean): string {
  if (alert) return '⏱ Deine Wartezeit am Restaurant ist hoch. Informiere den Dispatcher oder frage in der Küche nach dem Status.';
  if (min >= 5) return '🟡 Mittlere Wartezeit — versuche die Abholzeit besser mit der Küche abzustimmen.';
  return '✅ Super! Kurze Wartezeit — effiziente Abholung!';
}

export function FahrerPhase2323MeineWartezeit({
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
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !driverId || !locationId || !data) return null;

  const mich = data.fahrer.find((f) => f.fahrer_id === driverId) ?? null;
  const min = mich?.avg_wartezeit_min ?? 0;
  const barPct = Math.min((min / 20) * 100, 100);

  return (
    <div className="rounded-xl border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/30 p-4 mb-3">
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-cyan-500" />
          <span className="font-semibold text-cyan-800 dark:text-cyan-200 text-sm">
            Meine Wartezeit heute
          </span>
        </div>
        <span className="text-xs text-cyan-500">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {mich ? (
            <>
              {/* Wartezeit groß */}
              <div className="text-center">
                <div className={`text-4xl font-extrabold ${ampelTextColor(mich.ampel)}`}>
                  {mich.avg_wartezeit_min} Min
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Ø Wartezeit am Restaurant heute
                </div>
              </div>

              {/* Fortschrittsbalken 0–20 Min */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>0 Min</span>
                  <span className="text-yellow-400">5 Min</span>
                  <span className="text-red-400">10 Min</span>
                  <span>20 Min</span>
                </div>
                <div className="relative h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-10"
                    style={{ left: '25%' }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10"
                    style={{ left: '50%' }}
                  />
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColorClass(mich.ampel)}`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white dark:bg-gray-800 p-2.5 text-center border border-cyan-100 dark:border-cyan-900">
                  <div className="text-base font-bold text-gray-700 dark:text-gray-200">
                    {mich.touren_anzahl}
                  </div>
                  <div className="text-xs text-gray-400">Touren</div>
                </div>
                <div className="rounded-lg bg-white dark:bg-gray-800 p-2.5 text-center border border-cyan-100 dark:border-cyan-900">
                  <div className="text-base font-bold text-gray-700 dark:text-gray-200">
                    {mich.max_wartezeit_min} Min
                  </div>
                  <div className="text-xs text-gray-400">Längste Wartezeit</div>
                </div>
                <div className="rounded-lg bg-white dark:bg-gray-800 p-2.5 text-center border border-cyan-100 dark:border-cyan-900">
                  <div className="text-base font-bold text-gray-700 dark:text-gray-200">
                    {trendIcon(mich.trend)}{' '}
                    {mich.avg_wartezeit_vorwoche !== null
                      ? `${mich.trend_delta > 0 ? '+' : ''}${mich.trend_delta} Min`
                      : '—'}
                  </div>
                  <div className="text-xs text-gray-400">Δ Vorwoche</div>
                </div>
                <div className="rounded-lg bg-white dark:bg-gray-800 p-2.5 text-center border border-cyan-100 dark:border-cyan-900">
                  <div className="text-base font-bold text-gray-700 dark:text-gray-200">
                    {data.team_avg_wartezeit_min} Min
                  </div>
                  <div className="text-xs text-gray-400">Team-Ø</div>
                </div>
              </div>

              {/* Coaching-Tipp */}
              <div className="rounded-lg bg-cyan-100 dark:bg-cyan-900/40 p-2.5 text-xs text-cyan-800 dark:text-cyan-200">
                {coachingTipp(mich.avg_wartezeit_min, mich.alert)}
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
              Noch keine Wartezeit heute erfasst.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
