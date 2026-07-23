'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Route, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerTourenProSchicht {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  touren_pro_schicht: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerTourenProSchicht[];
  team_avg: number;
  gesamt: number;
}

const AMPEL_COLOR: Record<string, string> = {
  gruen: 'text-emerald-500',
  gelb: 'text-yellow-500',
  rot: 'text-red-500',
};

const COACHING_TIP: Record<string, string> = {
  gruen: 'Stark! Du schaffst überdurchschnittlich viele Touren pro Schicht — weiter so!',
  gelb: 'Gut — versuche deine Routen zu optimieren, um mehr Touren pro Schicht zu erreichen.',
  rot: 'Wenig Touren diese Schicht — spreche mit dem Dispatcher über mögliche Optimierungen.',
};

export function FahrerPhase3573MeineTourenProSchicht({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);

  const load = useCallback(async () => {
    if (!isOnline || !locationId) return;
    try {
      const res = await fetch(
        `/api/delivery/admin/fahrer-touren-pro-schicht?location_id=${locationId}&driver_id=${driverId}`
      );
      if (res.ok) setData(await res.json());
    } catch {}
  }, [driverId, locationId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline) return null;

  const driver = data?.fahrer?.[0];
  const ampel = driver?.ampel ?? 'gelb';

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Route className="w-5 h-5 text-blue-500" />
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">Meine Touren / Schicht</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          {driver ? (
            <>
              <div className="flex items-end justify-between mb-3">
                <div>
                  <p className={`text-5xl font-black ${AMPEL_COLOR[ampel]}`}>{driver.touren_pro_schicht}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Touren / Schicht (Ø 30 Tage)</p>
                </div>
                <div className="text-right">
                  <p className={`text-3xl font-bold ${AMPEL_COLOR[ampel]}`}>#{driver.rang}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">von {data?.gesamt}</p>
                </div>
              </div>

              {/* Rang-Balken */}
              <div className="mb-3">
                <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className={`h-2 rounded-full transition-all ${ampel === 'gruen' ? 'bg-emerald-500' : ampel === 'gelb' ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${data?.gesamt ? Math.round(((data.gesamt - driver.rang + 1) / data.gesamt) * 100) : 50}%` }}
                  />
                </div>
              </div>

              {/* Delta + Team-Ø */}
              <div className="flex items-center justify-between text-xs mb-3">
                <span className="text-gray-500 dark:text-gray-400">Team-Ø: <span className="font-medium text-gray-700 dark:text-gray-300">{data?.team_avg} T/Schicht</span></span>
                {driver.rank_delta > 0 ? (
                  <span className="flex items-center gap-0.5 text-emerald-600 font-medium"><TrendingUp className="w-3.5 h-3.5" />+{driver.rank_delta} besser</span>
                ) : driver.rank_delta < 0 ? (
                  <span className="flex items-center gap-0.5 text-red-500 font-medium"><TrendingDown className="w-3.5 h-3.5" />{driver.rank_delta}</span>
                ) : (
                  <span className="flex items-center gap-0.5 text-gray-400"><Minus className="w-3.5 h-3.5" />stabil</span>
                )}
              </div>

              {/* Coaching-Tipp */}
              <div className={`rounded-lg px-3 py-2 text-xs ${ampel === 'gruen' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' : ampel === 'gelb' ? 'bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'}`}>
                {COACHING_TIP[ampel]}
              </div>
            </>
          ) : (
            <div className="py-4 text-center text-sm text-gray-400">Lade Daten…</div>
          )}
        </div>
      )}
    </div>
  );
}
