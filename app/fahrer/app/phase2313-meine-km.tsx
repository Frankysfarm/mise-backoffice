'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';

type FahrerKmHeute = {
  fahrer_id: string;
  fahrer_name: string;
  km_gesamt: number;
  touren_anzahl: number;
  km_pro_tour: number;
  kosten_eur: number;
  km_vorwoche: number | null;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
};

type ApiData = {
  fahrer: FahrerKmHeute[];
  team_avg_km: number;
};

const MAX_KM = 200;

function barColor(ampel: FahrerKmHeute['ampel']): string {
  if (ampel === 'gruen') return 'bg-green-500';
  if (ampel === 'gelb') return 'bg-yellow-400';
  return 'bg-red-500';
}

function ampelText(ampel: FahrerKmHeute['ampel']): string {
  if (ampel === 'gruen') return 'text-green-700 dark:text-green-300';
  if (ampel === 'gelb') return 'text-yellow-700 dark:text-yellow-300';
  return 'text-red-700 dark:text-red-300';
}

function trendIcon(t: FahrerKmHeute['trend']): string {
  if (t === 'steigend') return '↑';
  if (t === 'fallend') return '↓';
  return '→';
}

function tippText(km: number): string {
  if (km >= 150) return 'Heute sehr viel gefahren! Schicht-Ende im Blick behalten.';
  if (km >= 100) return 'Gute Leistung — Pausen nicht vergessen!';
  return 'Gute Route-Planung spart km und Zeit.';
}

export function FahrerPhase2313MeineKm({
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
      const res = await fetch(`/api/delivery/admin/fahrer-km-heute?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !driverId || !locationId || !data) return null;

  const mich = data.fahrer.find((f) => f.fahrer_id === driverId) ?? null;
  const km = mich?.km_gesamt ?? 0;
  const barPct = Math.min((km / MAX_KM) * 100, 100);

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 mb-3">
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-blue-500" />
          <span className="font-semibold text-blue-800 dark:text-blue-200 text-sm">
            Meine km heute
          </span>
        </div>
        <span className="text-xs text-blue-600 dark:text-blue-400">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {mich ? (
            <>
              {/* KM groß */}
              <div className="text-center">
                <div
                  className={`text-4xl font-extrabold ${ampelText(mich.ampel)}`}
                >
                  {mich.km_gesamt} km
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  heute gefahren
                </div>
              </div>

              {/* Fortschrittsbalken */}
              <div>
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>0 km</span>
                  <span>{MAX_KM} km</span>
                </div>
                <div className="h-3 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${barColor(mich.ampel)}`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>

              {/* KPI Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white dark:bg-gray-800 p-2.5 text-center border border-blue-100 dark:border-blue-900">
                  <div className="text-base font-bold text-gray-700 dark:text-gray-200">
                    {mich.touren_anzahl}
                  </div>
                  <div className="text-xs text-gray-400">Touren</div>
                </div>
                <div className="rounded-lg bg-white dark:bg-gray-800 p-2.5 text-center border border-blue-100 dark:border-blue-900">
                  <div className="text-base font-bold text-gray-700 dark:text-gray-200">
                    {mich.km_pro_tour} km
                  </div>
                  <div className="text-xs text-gray-400">pro Tour</div>
                </div>
                <div className="rounded-lg bg-white dark:bg-gray-800 p-2.5 text-center border border-blue-100 dark:border-blue-900">
                  <div className="text-base font-bold text-gray-700 dark:text-gray-200">
                    {trendIcon(mich.trend)}{' '}
                    {mich.trend_delta > 0 ? '+' : ''}{mich.trend_delta} km
                  </div>
                  <div className="text-xs text-gray-400">Δ Vorwoche</div>
                </div>
                <div className="rounded-lg bg-white dark:bg-gray-800 p-2.5 text-center border border-blue-100 dark:border-blue-900">
                  <div className="text-base font-bold text-gray-700 dark:text-gray-200">
                    {mich.kosten_eur.toFixed(2)} €
                  </div>
                  <div className="text-xs text-gray-400">Kosten-Schätz.</div>
                </div>
              </div>

              {/* Team-Vergleich */}
              <div className="flex items-center justify-between rounded-lg bg-white dark:bg-gray-800 border border-blue-100 dark:border-blue-900 p-2.5 text-xs">
                <span className="text-gray-500 dark:text-gray-400">Team-Ø heute</span>
                <span className="font-medium text-gray-700 dark:text-gray-200">
                  {data.team_avg_km} km
                </span>
              </div>

              {/* Coaching-Tipp */}
              <div className="rounded-lg bg-blue-100 dark:bg-blue-900/40 p-2.5 text-xs text-blue-800 dark:text-blue-200">
                💡 {tippText(mich.km_gesamt)}
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
              Noch keine km heute erfasst.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
