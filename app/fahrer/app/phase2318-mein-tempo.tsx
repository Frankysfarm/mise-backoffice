'use client';

import { useCallback, useEffect, useState } from 'react';
import { Gauge } from 'lucide-react';

type AmpelTempo = 'gruen' | 'gelb' | 'rot';
type TrendTempo = 'steigend' | 'fallend' | 'stabil';
type AlertTyp = 'tempoverdacht' | 'stau' | null;

type FahrerTempoHeute = {
  fahrer_id: string;
  fahrer_name: string;
  avg_kmh: number;
  touren_anzahl: number;
  fahrzeit_min: number;
  km_gesamt: number;
  avg_kmh_vorwoche: number | null;
  trend: TrendTempo;
  trend_delta: number;
  ampel: AmpelTempo;
  alert_typ: AlertTyp;
  alert: boolean;
};

type ApiData = {
  fahrer: FahrerTempoHeute[];
  team_avg_kmh: number;
};

function ampelTextColor(a: AmpelTempo): string {
  if (a === 'gruen') return 'text-green-700 dark:text-green-300';
  if (a === 'gelb') return 'text-yellow-600 dark:text-yellow-300';
  return 'text-red-600 dark:text-red-400';
}

function trendIcon(t: TrendTempo): string {
  if (t === 'steigend') return '↑';
  if (t === 'fallend') return '↓';
  return '→';
}

function coachingTipp(kmh: number, alertTyp: AlertTyp): string {
  if (alertTyp === 'tempoverdacht') return '⚡ Achtung: Dein Tempo ist sehr hoch. Bitte fahre sicher und beachte die Verkehrsregeln!';
  if (alertTyp === 'stau') return '🚦 Sehr niedrige Durchschnittsgeschwindigkeit — bist du im Stau? Prüfe ob eine Umleitung möglich ist.';
  if (kmh >= 40) return '✅ Gutes Tempo — weiter so! Sichere und effiziente Fahrt.';
  return '💡 Tipp: Kenne deine Route gut im Voraus, um Wartezeiten zu minimieren.';
}

function barColorClass(a: AmpelTempo): string {
  if (a === 'gruen') return 'bg-green-500';
  if (a === 'gelb') return 'bg-yellow-400';
  return 'bg-red-500';
}

export function FahrerPhase2318MeinTempo({
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
      const res = await fetch(`/api/delivery/admin/fahrer-tempo-analyse?location_id=${locationId}`);
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
  const kmh = mich?.avg_kmh ?? 0;
  const barPct = Math.min((kmh / 80) * 100, 100);

  return (
    <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 p-4 mb-3">
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-orange-500" />
          <span className="font-semibold text-orange-800 dark:text-orange-200 text-sm">
            Mein Tempo heute
          </span>
        </div>
        <span className="text-xs text-orange-500">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {mich ? (
            <>
              {/* km/h groß */}
              <div className="text-center">
                <div className={`text-4xl font-extrabold ${ampelTextColor(mich.ampel)}`}>
                  {mich.avg_kmh} km/h
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Ø Geschwindigkeit heute
                </div>
              </div>

              {/* Fortschrittsbalken 0–80 km/h */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>0 km/h</span>
                  <span className="text-red-400">60 km/h Limit</span>
                  <span>80 km/h</span>
                </div>
                <div className="relative h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  {/* Warnlinie bei 60 km/h */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-10"
                    style={{ left: `${(60 / 80) * 100}%` }}
                  />
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColorClass(mich.ampel)}`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white dark:bg-gray-800 p-2.5 text-center border border-orange-100 dark:border-orange-900">
                  <div className="text-base font-bold text-gray-700 dark:text-gray-200">
                    {mich.touren_anzahl}
                  </div>
                  <div className="text-xs text-gray-400">Touren</div>
                </div>
                <div className="rounded-lg bg-white dark:bg-gray-800 p-2.5 text-center border border-orange-100 dark:border-orange-900">
                  <div className="text-base font-bold text-gray-700 dark:text-gray-200">
                    {mich.fahrzeit_min} Min
                  </div>
                  <div className="text-xs text-gray-400">Fahrzeit</div>
                </div>
                <div className="rounded-lg bg-white dark:bg-gray-800 p-2.5 text-center border border-orange-100 dark:border-orange-900">
                  <div className="text-base font-bold text-gray-700 dark:text-gray-200">
                    {trendIcon(mich.trend)}{' '}
                    {mich.avg_kmh_vorwoche !== null
                      ? `${mich.trend_delta > 0 ? '+' : ''}${mich.trend_delta} km/h`
                      : '—'}
                  </div>
                  <div className="text-xs text-gray-400">Δ Vorwoche</div>
                </div>
                <div className="rounded-lg bg-white dark:bg-gray-800 p-2.5 text-center border border-orange-100 dark:border-orange-900">
                  <div className="text-base font-bold text-gray-700 dark:text-gray-200">
                    {data.team_avg_kmh} km/h
                  </div>
                  <div className="text-xs text-gray-400">Team-Ø</div>
                </div>
              </div>

              {/* Coaching-Tipp */}
              <div className="rounded-lg bg-orange-100 dark:bg-orange-900/40 p-2.5 text-xs text-orange-800 dark:text-orange-200">
                {coachingTipp(mich.avg_kmh, mich.alert_typ)}
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
              Noch kein Tempo heute erfasst.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
