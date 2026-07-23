'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Timer, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerTourzeit {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  tourzeit_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiResponse {
  fahrer: FahrerTourzeit[];
  team_avg: number;
  schnellster_name: string;
  langsamster_name: string;
  alert_count: number;
  gesamt: number;
}

const AMPEL_COLOR: Record<string, string> = {
  gruen: 'text-emerald-600',
  gelb: 'text-yellow-600',
  rot: 'text-red-600',
};

const AMPEL_BG: Record<string, string> = {
  gruen: 'bg-emerald-500',
  gelb: 'bg-yellow-400',
  rot: 'bg-red-500',
};

const RANK_BADGE: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function DispatchPhase3537TourzeitRankingBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-tourzeit?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch {}
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return null;

  const maxMin = Math.max(...data.fahrer.map(f => f.tourzeit_min), 1);

  return (
    <div className="border rounded-lg bg-white dark:bg-gray-900 shadow-sm mb-3">
      <button
        className="w-full flex items-center justify-between p-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          <Timer className="w-4 h-4 text-blue-500" />
          Ø Tourzeit Ranking
          {data.alert_count > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-xs font-bold">
              {data.alert_count} ⚠
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {data.alert_count > 0 && (
            <div className="flex items-center gap-1.5 p-2 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs border border-red-200">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Lange Tourzeit! {data.alert_count} Fahrer über Zielwert
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 py-1">
            <div className="text-center">
              <div className="text-[10px] text-gray-500 uppercase">Schnellster</div>
              <div className="text-xs font-semibold text-emerald-600 truncate">{data.schnellster_name}</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-gray-500 uppercase">Team-Ø</div>
              <div className="text-xs font-semibold">{data.team_avg} min</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-gray-500 uppercase">Langsamster</div>
              <div className="text-xs font-semibold text-red-600 truncate">{data.langsamster_name}</div>
            </div>
          </div>

          <div className="space-y-1.5">
            {data.fahrer.map(f => (
              <div key={f.fahrer_id} className="flex items-center gap-2">
                <span className="text-xs w-5 text-center flex-shrink-0">
                  {RANK_BADGE[f.rang] ?? <span className="text-gray-500">{f.rang}</span>}
                </span>
                <span className="text-xs w-20 truncate flex-shrink-0">{f.fahrer_name}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-2 relative">
                  <div
                    className={`h-2 rounded-full ${AMPEL_BG[f.ampel]}`}
                    style={{ width: `${(f.tourzeit_min / maxMin) * 100}%` }}
                  />
                </div>
                <span className={`text-xs font-mono w-12 text-right flex-shrink-0 ${AMPEL_COLOR[f.ampel]}`}>
                  {f.tourzeit_min} min
                </span>
                <span className="flex-shrink-0 w-5">
                  {f.rank_delta < 0 ? (
                    <TrendingUp className="w-3 h-3 text-emerald-500" />
                  ) : f.rank_delta > 0 ? (
                    <TrendingDown className="w-3 h-3 text-red-500" />
                  ) : (
                    <Minus className="w-3 h-3 text-gray-400" />
                  )}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-between text-[10px] text-gray-400 pt-1">
            <span>Ø letzte 30 Tage</span>
            <span>Ziel: ≤60 min/Tour</span>
          </div>
        </div>
      )}
    </div>
  );
}
