'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Coffee, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerPausenDauer {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  pausen_dauer_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiResponse {
  fahrer: FahrerPausenDauer[];
  team_avg: number;
  gesamt: number;
}

const AMPEL_COLOR: Record<string, string> = {
  gruen: 'text-emerald-500',
  gelb: 'text-yellow-500',
  rot: 'text-red-500',
};

const COACHING_TIP: Record<string, string> = {
  gruen: 'Super! Deine Pausen sind kurz und effizient — du nutzt deine Schichtzeit optimal.',
  gelb: 'Gut — versuche deine Pausenzeiten etwas zu verkürzen, um mehr Touren zu schaffen.',
  rot: 'Tipp: Kürzere Pausen helfen dir, mehr Touren zu fahren und deine Einnahmen zu steigern.',
};

export function FahrerPhase3563MeinePausenDauer({
  driverId,
  locationId,
  isOnline,
}: {
  driverId: string | null;
  locationId: string | null;
  isOnline: boolean;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<FahrerPausenDauer | null>(null);
  const [teamAvg, setTeamAvg] = useState<number>(0);
  const [gesamt, setGesamt] = useState<number>(1);

  const load = useCallback(async () => {
    if (!driverId || !locationId || !isOnline) return;
    try {
      const r = await fetch(
        `/api/delivery/admin/fahrer-pausen-dauer?location_id=${locationId}&driver_id=${driverId}`,
        { cache: 'no-store' }
      );
      if (!r.ok) return;
      const json: ApiResponse = await r.json();
      if (json.fahrer.length > 0) setData(json.fahrer[0]);
      setTeamAvg(json.team_avg);
      setGesamt(json.gesamt);
    } catch {}
  }, [driverId, locationId, isOnline]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!isOnline || !data) return null;

  const barWidth = gesamt > 1 ? ((gesamt - data.rang) / (gesamt - 1)) * 100 : 100;

  return (
    <div className="border rounded-xl bg-white dark:bg-gray-900 shadow-sm mb-3">
      <button
        className="w-full flex items-center justify-between p-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          <Coffee className="w-4 h-4 text-amber-700" />
          Meine Pausen-Dauer
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex items-end justify-center gap-4">
            <div className="text-center">
              <div className={`text-5xl font-bold font-mono ${AMPEL_COLOR[data.ampel]}`}>
                {data.pausen_dauer_min}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">min Pause</div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${AMPEL_COLOR[data.ampel]}`}>
                #{data.rang}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">Rang</div>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-gray-400">
              <span>Längste Pause</span>
              <span>Kürzeste Pause</span>
            </div>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full transition-all ${
                  data.ampel === 'gruen'
                    ? 'bg-emerald-500'
                    : data.ampel === 'gelb'
                    ? 'bg-yellow-400'
                    : 'bg-red-500'
                }`}
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
              <div className="text-[10px] text-gray-500 uppercase">Rang-Δ</div>
              <div className="flex items-center justify-center gap-1 text-xs font-semibold mt-0.5">
                {data.rank_delta < 0 ? (
                  <>
                    <TrendingUp className="w-3 h-3 text-emerald-500" />
                    <span className="text-emerald-600">{Math.abs(data.rank_delta)} ↑</span>
                  </>
                ) : data.rank_delta > 0 ? (
                  <>
                    <TrendingDown className="w-3 h-3 text-red-500" />
                    <span className="text-red-600">{data.rank_delta} ↓</span>
                  </>
                ) : (
                  <>
                    <Minus className="w-3 h-3 text-gray-400" />
                    <span className="text-gray-500">—</span>
                  </>
                )}
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
              <div className="text-[10px] text-gray-500 uppercase">Team-Ø</div>
              <div className="text-xs font-semibold mt-0.5">{teamAvg} min</div>
            </div>
          </div>

          <div className="text-xs text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5 italic">
            {COACHING_TIP[data.ampel]}
          </div>
        </div>
      )}
    </div>
  );
}
