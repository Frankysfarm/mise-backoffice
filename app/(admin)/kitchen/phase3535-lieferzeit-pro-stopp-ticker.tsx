'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Clock, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  lieferzeit_pro_stopp: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  schnellster_name: string;
  alert_count: number;
}

const AMPEL_COLOR: Record<string, string> = {
  gruen: 'text-emerald-600',
  gelb: 'text-yellow-600',
  rot: 'text-red-600',
};

export function KitchenPhase3535LieferzeitProStoppTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-lieferzeit-pro-stopp?location_id=${locationId}`, { cache: 'no-store' });
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
    <div className="border rounded-lg bg-white dark:bg-gray-900 shadow-sm mb-2">
      <button
        className="w-full flex items-center justify-between p-2.5 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 font-semibold text-xs">
          <Clock className="w-3.5 h-3.5 text-orange-500" />
          Lieferzeit/Stopp — Schnellster: {data.schnellster_name}
          {data.alert_count > 0 && (
            <span className="px-1 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">
              {data.alert_count}⚠
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>

      {open && (
        <div className="px-2.5 pb-2.5 space-y-1.5">
          {data.alert_count > 0 && (
            <div className="flex items-center gap-1 p-1.5 rounded bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-[10px] border border-red-200">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              Hohe Lieferzeit/Stopp! {data.alert_count} Fahrer über Zielwert
            </div>
          )}

          <div className="space-y-1">
            {data.fahrer.map(f => (
              <div key={f.fahrer_id} className="flex items-center gap-1.5 text-[10px]">
                <span className="w-4 text-center flex-shrink-0 font-bold text-gray-500">#{f.rang}</span>
                <span className="flex-1 truncate">{f.fahrer_name}</span>
                <span className={`font-mono font-semibold flex-shrink-0 ${AMPEL_COLOR[f.ampel]}`}>
                  {f.lieferzeit_pro_stopp.toFixed(1)}min
                </span>
                <span className="flex-shrink-0 w-4">
                  {f.rank_delta < 0 ? (
                    <TrendingUp className="w-2.5 h-2.5 text-emerald-500" />
                  ) : f.rank_delta > 0 ? (
                    <TrendingDown className="w-2.5 h-2.5 text-red-500" />
                  ) : (
                    <Minus className="w-2.5 h-2.5 text-gray-400" />
                  )}
                </span>
              </div>
            ))}
          </div>

          <div className="flex justify-between text-[10px] text-gray-400 pt-0.5 border-t border-gray-100 dark:border-gray-800">
            <span>Team-Ø: {data.team_avg.toFixed(1)}min/Stopp</span>
            <span>Ziel: ≤6min/Stopp</span>
          </div>
        </div>
      )}
    </div>
  );
}
