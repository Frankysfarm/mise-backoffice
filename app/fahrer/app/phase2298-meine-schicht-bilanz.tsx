'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Clock } from 'lucide-react';

type FahrerSchichtBilanz = {
  fahrer_id: string;
  fahrer_name: string;
  schicht_stunden: number;
  touren_anzahl: number;
  km_gesamt: number;
  km_pro_tour: number;
  kosten_km: number;
  kosten_stunden: number;
  kosten_gesamt: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
};

type ApiData = {
  fahrer: FahrerSchichtBilanz[];
  team_avg_stunden: number;
};

function calcColor(ampel: FahrerSchichtBilanz['ampel']): string {
  if (ampel === 'gruen') return 'text-green-600 dark:text-green-400';
  if (ampel === 'gelb') return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function calcTipp(stunden: number, trend: FahrerSchichtBilanz['trend']): string {
  if (stunden >= 10)
    return 'Du arbeitest sehr lange — bitte bald Pause machen oder Schicht beenden.';
  if (stunden >= 8 && trend === 'steigend')
    return 'Schicht wird länger — auf Erholung achten!';
  if (stunden >= 8)
    return 'Lange Schicht — denk an regelmäßige Pausen.';
  if (stunden >= 5)
    return 'Gute Schichtlänge — weiter so!';
  return 'Schicht läuft gut — noch viel Kapazität.';
}

function trendLabel(t: FahrerSchichtBilanz['trend']): string {
  if (t === 'steigend') return '↑ Länger';
  if (t === 'fallend') return '↓ Kürzer';
  return '→ Stabil';
}

export function FahrerPhase2298MeineSchichtBilanz({
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
      const res = await fetch(
        `/api/delivery/admin/fahrer-schicht-kpi?location_id=${locationId}`
      );
      if (res.ok) setData(await res.json());
    } catch {
      // ignore
    }
  }, [locationId, driverId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !driverId || !locationId || !data) return null;

  const ich = data.fahrer.find((f) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!ich) return null;

  const color = calcColor(ich.ampel);
  const tipp = calcTipp(ich.schicht_stunden, ich.trend);
  const barWidth = Math.min(100, Math.max(0, (ich.schicht_stunden / 12) * 100));

  return (
    <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 mb-3">
      <button
        className="w-full flex items-center justify-between gap-2"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-amber-500" />
          <span className="font-semibold text-amber-900 dark:text-amber-200 text-sm">
            Meine Schicht-Bilanz
          </span>
        </div>
        {open ? (
          <ChevronUp className="w-4 h-4 text-amber-400" />
        ) : (
          <ChevronDown className="w-4 h-4 text-amber-400" />
        )}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="text-center">
            <div className={`text-3xl font-bold ${color}`}>
              ⏱ {ich.schicht_stunden.toFixed(1)}h
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Schichtdauer heute
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              {ich.touren_anzahl} Touren · {ich.km_gesamt.toFixed(0)} km
            </div>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{
                width: `${barWidth}%`,
                backgroundColor:
                  ich.ampel === 'gruen'
                    ? '#22c55e'
                    : ich.ampel === 'gelb'
                    ? '#eab308'
                    : '#ef4444',
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs text-center">
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-amber-100 dark:border-amber-900 p-2">
              <div className="font-bold text-amber-700 dark:text-amber-300">
                {trendLabel(ich.trend)}
              </div>
              <div className="text-gray-500 dark:text-gray-400">Trend</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-amber-100 dark:border-amber-900 p-2">
              <div className="font-bold text-amber-700 dark:text-amber-300">
                {ich.trend_delta > 0 ? '+' : ''}
                {ich.trend_delta.toFixed(1)}h
              </div>
              <div className="text-gray-500 dark:text-gray-400">Δ Vorwoche</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-amber-100 dark:border-amber-900 p-2">
              <div className="font-bold text-amber-700 dark:text-amber-300">
                {data.team_avg_stunden.toFixed(1)}h
              </div>
              <div className="text-gray-500 dark:text-gray-400">Team-Ø</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs text-center">
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-amber-100 dark:border-amber-900 p-2">
              <div className="font-bold text-amber-700 dark:text-amber-300">
                {ich.km_pro_tour.toFixed(1)} km
              </div>
              <div className="text-gray-500 dark:text-gray-400">Ø km/Tour</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-amber-100 dark:border-amber-900 p-2">
              <div className="font-bold text-amber-700 dark:text-amber-300">
                {ich.kosten_gesamt.toFixed(0)}€
              </div>
              <div className="text-gray-500 dark:text-gray-400">Kosten-Schätzung</div>
            </div>
          </div>

          <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30 rounded px-2 py-1.5">
            {tipp}
          </p>
        </div>
      )}
    </div>
  );
}
