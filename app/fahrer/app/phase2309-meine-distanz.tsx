'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Navigation } from 'lucide-react';

type DistanzAmpel = 'gruen' | 'gelb' | 'rot';

type FahrerDistanzInfo = {
  fahrer_id: string;
  fahrer_name: string;
  km_heute: number;
  avg_km_tour: number;
  touren_anzahl: number;
  km_h_schnitt: number;
  trend_vs_vorwoche_pct: number | null;
  ampel: DistanzAmpel;
  alert: boolean;
};

type ApiData = {
  fahrer: FahrerDistanzInfo[];
  team_avg_km: number;
  team_avg_km_tour: number;
};

function coachingTipp(ampel: DistanzAmpel, km: number, kmh: number): string {
  if (ampel === 'rot') return `${km} km heute — Tagesmaximum überschritten. Bitte Fahrpause einlegen.`;
  if (ampel === 'gelb') return `Ø ${kmh} km/h — niedrige Durchschnittsgeschwindigkeit. Route optimieren?`;
  return 'Top! Deine Distanz-Werte liegen im grünen Bereich.';
}

function trendArrow(pct: number | null): string {
  if (pct === null) return '';
  if (pct > 0) return `↑ ${pct}% vs. Vorwoche`;
  if (pct < 0) return `↓ ${Math.abs(pct)}% vs. Vorwoche`;
  return '→ ±0% vs. Vorwoche';
}

export function FahrerPhase2309MeineDistanz({
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
      const res = await fetch(`/api/delivery/admin/fahrer-distanz?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId]);

  useEffect(() => {
    if (!isOnline) return;
    load();
    const id = setInterval(load, 15 * 60 * 1000);
    return () => clearInterval(id);
  }, [load, isOnline]);

  const meineFahrer = useMemo(
    () => data?.fahrer.find((f) => f.fahrer_id === driverId) ?? null,
    [data, driverId],
  );

  if (!isOnline || !driverId || !meineFahrer) return null;

  const f = meineFahrer;
  const ampelColor =
    f.ampel === 'gruen'
      ? 'text-green-600 dark:text-green-400'
      : f.ampel === 'gelb'
      ? 'text-yellow-600 dark:text-yellow-400'
      : 'text-red-600 dark:text-red-400';

  const borderFarbe =
    f.ampel === 'gruen'
      ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30'
      : f.ampel === 'gelb'
      ? 'border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950/30'
      : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30';

  return (
    <div className={`rounded-xl border p-4 mb-3 ${borderFarbe}`}>
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Navigation className={`w-4 h-4 ${ampelColor}`} />
          <span className={`font-semibold text-sm ${ampelColor}`}>Meine Distanz</span>
        </div>
        {open ? (
          <ChevronUp className={`w-4 h-4 ${ampelColor}`} />
        ) : (
          <ChevronDown className={`w-4 h-4 ${ampelColor}`} />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          <div className={`text-3xl font-bold text-center ${ampelColor}`}>{f.km_heute} km</div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 text-center">
              <div className="font-bold text-sm">{f.avg_km_tour} km</div>
              <div className="text-gray-500">Ø je Tour</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 text-center">
              <div className="font-bold text-sm">{f.km_h_schnitt} km/h</div>
              <div className="text-gray-500">Ø Tempo</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 text-center">
              <div className="font-bold text-sm">{data?.team_avg_km ?? '—'} km</div>
              <div className="text-gray-500">Team-Ø</div>
            </div>
          </div>

          {f.trend_vs_vorwoche_pct !== null && (
            <p className={`text-xs text-center ${
              f.trend_vs_vorwoche_pct > 0
                ? 'text-green-600 dark:text-green-400'
                : f.trend_vs_vorwoche_pct < 0
                ? 'text-red-500 dark:text-red-400'
                : 'text-gray-500'
            }`}>
              {trendArrow(f.trend_vs_vorwoche_pct)}
            </p>
          )}

          <p className={`text-xs rounded px-2 py-1.5 ${
            f.ampel === 'gruen'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
              : f.ampel === 'gelb'
              ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
              : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
          }`}>
            {coachingTipp(f.ampel, f.km_heute, f.km_h_schnitt)}
          </p>
        </div>
      )}
    </div>
  );
}
