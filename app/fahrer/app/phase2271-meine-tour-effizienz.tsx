'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Gauge } from 'lucide-react';

type FahrerEffizienz = {
  fahrer_id: string;
  touren_heute: number;
  schicht_stunden: number;
  touren_pro_std: number;
  avg_stopps_je_tour: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
};

type ApiData = {
  fahrer: FahrerEffizienz[];
  team_avg_touren_pro_std: number;
};

function calcColor(tph: number): string {
  if (tph >= 2) return 'text-green-600 dark:text-green-400';
  if (tph >= 1.5) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function calcTipp(tph: number, trend: FahrerEffizienz['trend']): string {
  if (tph >= 2.5 && trend === 'steigend') return 'Top-Effizienz! Du bist einer der schnellsten Fahrer — weiter so!';
  if (tph >= 2) return 'Gute Tour-Rate. Noch etwas mehr und du erreichst Bestleistung!';
  if (tph >= 1.5 && trend === 'fallend') return 'Effizienz sinkt — Wartezeiten reduzieren oder Routen bündeln.';
  if (tph >= 1.5) return 'Akzeptable Effizienz — Ziel: mindestens 2 Touren pro Stunde.';
  return 'Effizienz unter Ziel — prüfe ob Routen zu lang sind oder Pausen optimiert werden können.';
}

function trendLabel(t: FahrerEffizienz['trend']): string {
  if (t === 'steigend') return '↑ Verbessert';
  if (t === 'fallend') return '↓ Gesunken';
  return '→ Stabil';
}

function barWidth(tph: number): string {
  const pct = Math.min(100, (tph / 3) * 100);
  return `${pct.toFixed(0)}%`;
}

export function FahrerPhase2271MeineTourEffizienz({
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
      const res = await fetch(`/api/delivery/admin/fahrer-tour-effizienz?location_id=${locationId}`);
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

  if (!isOnline || !driverId || !locationId || !data) return null;

  const ich = data.fahrer.find((f) => f.fahrer_id === driverId) ?? data.fahrer[0];
  if (!ich) return null;

  const color = calcColor(ich.touren_pro_std);
  const tipp = calcTipp(ich.touren_pro_std, ich.trend);
  const deltaVsTeam = Math.round((ich.touren_pro_std - data.team_avg_touren_pro_std) * 100) / 100;

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 mb-3">
      <button className="w-full flex items-center justify-between gap-2" onClick={() => setOpen((v) => !v)}>
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-sm text-blue-900 dark:text-blue-200">Meine Tour-Effizienz</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-blue-400" /> : <ChevronDown className="w-4 h-4 text-blue-400" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Hauptwert */}
          <div className="text-center">
            <div className={`text-4xl font-bold ${color}`}>{ich.touren_pro_std.toFixed(2)}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Touren pro Stunde</div>
          </div>

          {/* Fortschrittsbalken 0–3 */}
          <div>
            <div className="h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${ich.ampel === 'gruen' ? 'bg-green-500' : ich.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-500'}`}
                style={{ width: barWidth(ich.touren_pro_std) }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              <span>0</span><span>Ziel: 2,0</span><span>3,0/Std</span>
            </div>
          </div>

          {/* KPI-Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 text-center">
              <div className={`text-sm font-bold ${ich.trend === 'steigend' ? 'text-green-600 dark:text-green-400' : ich.trend === 'fallend' ? 'text-red-500' : 'text-gray-500'}`}>
                {trendLabel(ich.trend)}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500">Trend</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 text-center">
              <div className="text-sm font-bold text-gray-700 dark:text-gray-300">{ich.touren_heute}</div>
              <div className="text-xs text-gray-400 dark:text-gray-500">Touren heute</div>
            </div>
            <div className="rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-2 text-center">
              <div className={`text-sm font-bold ${deltaVsTeam >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}`}>
                {deltaVsTeam >= 0 ? '+' : ''}{deltaVsTeam.toFixed(2)}
              </div>
              <div className="text-xs text-gray-400 dark:text-gray-500">vs. Team-Ø</div>
            </div>
          </div>

          {/* Coaching-Tipp */}
          <div className="rounded-lg bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 p-2.5">
            <p className="text-xs text-blue-800 dark:text-blue-300">{tipp}</p>
          </div>
        </div>
      )}
    </div>
  );
}
