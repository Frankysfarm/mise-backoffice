'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Calendar, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerWochenend {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  wochenend_anteil: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerWochenend[];
  team_avg: number;
  bester_name: string;
  alert_count: number;
}

const AMPEL_COLOR: Record<string, string> = {
  gruen: 'text-emerald-600',
  gelb: 'text-yellow-600',
  rot: 'text-red-600',
};

export function KitchenPhase3455WochenendAnteilTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-wochenend-anteil?location_id=${locationId}`, { cache: 'no-store' });
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
          <Calendar className="w-3.5 h-3.5 text-orange-500" />
          Wochenend-Anteil — Bester: {data.bester_name}
          {data.alert_count > 0 && (
            <span className="px-1 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-bold">
              {data.alert_count}⚠
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {open && (
        <div className="px-2.5 pb-2.5 space-y-1">
          {data.alert_count > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 rounded px-2 py-1">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              Wenig Wochenend-Schichten! {data.alert_count} Fahrer unter Zielwert
            </div>
          )}

          {data.fahrer.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-1.5 text-xs">
              <span className="w-4 text-center font-bold text-gray-500">#{f.rang}</span>
              <span className="flex-1 truncate">{f.fahrer_name}</span>
              <span className={`font-mono font-semibold ${AMPEL_COLOR[f.ampel]}`}>
                {f.wochenend_anteil}%
              </span>
              <span className="w-4">
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

          <div className="flex justify-between text-[10px] text-gray-400 pt-0.5 border-t">
            <span>Team-Ø: {data.team_avg}%</span>
            <span>Ziel: ≥35%</span>
          </div>
        </div>
      )}
    </div>
  );
}
