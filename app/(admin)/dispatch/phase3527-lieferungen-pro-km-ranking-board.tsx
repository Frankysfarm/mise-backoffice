'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Zap, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  lieferungen_pro_km: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const RANK_BADGE: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

const AMPEL_BG: Record<string, string> = {
  gruen: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
  gelb: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
  rot: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
};

const AMPEL_TEXT: Record<string, string> = {
  gruen: 'text-emerald-700 dark:text-emerald-400',
  gelb: 'text-yellow-700 dark:text-yellow-400',
  rot: 'text-red-700 dark:text-red-400',
};

export function DispatchPhase3527LieferungenProKmRankingBoard({ locationId }: { locationId: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-lieferungen-pro-km?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch {}
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (!data) return null;

  return (
    <div className="border rounded-lg bg-white dark:bg-gray-900 shadow-sm mb-3">
      <button
        className="w-full flex items-center justify-between p-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          <Zap className="w-4 h-4 text-emerald-500" />
          Lieferungen/km — #{1} {data.bester_name}
          {data.alert_count > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-bold">
              {data.alert_count} ⚠
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          {/* KPI Grid */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md p-2 text-center bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
              <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">
                {data.fahrer[0]?.lieferungen_pro_km.toFixed(2)}
              </div>
              <div className="text-[10px] text-emerald-600 dark:text-emerald-500 truncate">
                🥇 {data.bester_name}
              </div>
            </div>
            <div className="rounded-md p-2 text-center bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <div className="text-lg font-bold text-gray-700 dark:text-gray-300">
                {data.team_avg.toFixed(2)}
              </div>
              <div className="text-[10px] text-gray-500">Team-Ø /km</div>
            </div>
            <div className="rounded-md p-2 text-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="text-lg font-bold text-red-700 dark:text-red-400">
                {data.fahrer[data.fahrer.length - 1]?.lieferungen_pro_km.toFixed(2)}
              </div>
              <div className="text-[10px] text-red-600 dark:text-red-500 truncate">
                {data.letzter_name}
              </div>
            </div>
          </div>

          {/* Alert Banner */}
          {data.alert_count > 0 && (
            <div className="flex items-center gap-1.5 p-2 rounded-md bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-xs border border-red-200">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              Niedrige Lieferungsdichte! {data.alert_count} Fahrer unter Zielwert
            </div>
          )}

          {/* Fahrer List */}
          <div className="space-y-1">
            {data.fahrer.map(f => (
              <div
                key={f.fahrer_id}
                className={`flex items-center gap-2 p-1.5 rounded-md border text-xs ${AMPEL_BG[f.ampel]}`}
              >
                <span className="w-5 text-center flex-shrink-0 font-bold">
                  {RANK_BADGE[f.rang] ?? `#${f.rang}`}
                </span>
                <span className="flex-1 truncate font-medium">{f.fahrer_name}</span>
                <span className={`font-mono font-bold flex-shrink-0 ${AMPEL_TEXT[f.ampel]}`}>
                  {f.lieferungen_pro_km.toFixed(2)}/km
                </span>
                <span className="flex-shrink-0 w-4">
                  {f.rank_delta > 0 ? (
                    <TrendingUp className="w-3 h-3 text-emerald-500" />
                  ) : f.rank_delta < 0 ? (
                    <TrendingDown className="w-3 h-3 text-red-500" />
                  ) : (
                    <Minus className="w-3 h-3 text-gray-400" />
                  )}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-800">
            <span>Team-Ø: {data.team_avg.toFixed(2)}/km</span>
            <span>Ziel: ≥0.8/km</span>
          </div>
        </div>
      )}
    </div>
  );
}
