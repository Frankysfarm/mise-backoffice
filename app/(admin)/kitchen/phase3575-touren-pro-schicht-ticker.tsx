'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Route, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

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
  bester_name: string;
  alert_count: number;
}

const AMPEL_COLOR: Record<string, string> = {
  gruen: 'text-emerald-600',
  gelb: 'text-yellow-600',
  rot: 'text-red-600',
};

export function KitchenPhase3575TourenProSchichtTicker({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-touren-pro-schicht?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {}
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const fahrer = data?.fahrer ?? [];
  const best = fahrer[0];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Route className="w-5 h-5 text-blue-500" />
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">Touren/Schicht</span>
          {best && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              #1 {best.fahrer_name} — {best.touren_pro_schicht} T/Schicht
            </span>
          )}
          {data?.alert_count ? (
            <span className="ml-1 flex items-center gap-1 text-xs text-red-600 font-medium">
              <AlertTriangle className="w-3 h-3" />{data.alert_count}
            </span>
          ) : null}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Team-Ø: <span className="font-medium text-gray-700 dark:text-gray-300">{data?.team_avg ?? '—'} T/Schicht</span>
            <span className="ml-2 text-gray-400">Ziel ≥6 T/Schicht</span>
          </p>
          <div className="space-y-1">
            {fahrer.map(f => (
              <div key={f.fahrer_id} className="flex items-center justify-between gap-2 py-0.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-bold text-gray-400 w-5 shrink-0">#{f.rang}</span>
                  <span className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">{f.fahrer_name}</span>
                  {f.alert_bottom && <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-bold ${AMPEL_COLOR[f.ampel]}`}>{f.touren_pro_schicht}</span>
                  {f.rank_delta > 0 ? (
                    <span className="text-xs text-emerald-600 flex items-center gap-0.5"><TrendingUp className="w-3 h-3" />+{f.rank_delta}</span>
                  ) : f.rank_delta < 0 ? (
                    <span className="text-xs text-red-500 flex items-center gap-0.5"><TrendingDown className="w-3 h-3" />{f.rank_delta}</span>
                  ) : (
                    <span className="text-xs text-gray-400"><Minus className="w-3 h-3" /></span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
