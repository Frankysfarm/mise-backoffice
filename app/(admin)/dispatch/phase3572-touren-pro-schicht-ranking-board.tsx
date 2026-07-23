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
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const AMPEL_COLOR: Record<string, string> = {
  gruen: 'text-emerald-600',
  gelb: 'text-yellow-600',
  rot: 'text-red-600',
};

const AMPEL_BG: Record<string, string> = {
  gruen: 'bg-emerald-100 dark:bg-emerald-900/30',
  gelb: 'bg-yellow-100 dark:bg-yellow-900/30',
  rot: 'bg-red-100 dark:bg-red-900/30',
};

const RANK_BADGE: Record<number, string> = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

export function DispatchPhase3572TourenProSchichtRankingBoard({ locationId }: { locationId?: string | null }) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-touren-pro-schicht?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const fahrer = data?.fahrer ?? [];
  const maxVal = fahrer.length > 0 ? fahrer[0].touren_pro_schicht : 1;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <div className="flex items-center gap-2">
          <Route className="w-5 h-5 text-blue-500" />
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">Touren / Schicht Ranking</span>
          {data?.alert_count ? (
            <span className="ml-2 flex items-center gap-1 text-xs text-red-600 font-medium">
              <AlertTriangle className="w-3.5 h-3.5" />{data.alert_count} Alert
            </span>
          ) : null}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4">
          {/* KPI Grid */}
          {data && (
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Bester</p>
                <p className="text-sm font-bold text-emerald-600">{fahrer[0]?.touren_pro_schicht ?? '—'}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{data.bester_name}</p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Team-Ø</p>
                <p className="text-sm font-bold text-blue-600">{data.team_avg}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400">Touren/Schicht</p>
              </div>
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2 text-center">
                <p className="text-xs text-gray-500 dark:text-gray-400">Niedrigster</p>
                <p className="text-sm font-bold text-red-600">{fahrer[fahrer.length - 1]?.touren_pro_schicht ?? '—'}</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{data.letzter_name}</p>
              </div>
            </div>
          )}

          {loading && !data && (
            <div className="py-6 text-center text-sm text-gray-400">Lade Daten…</div>
          )}

          <div className="space-y-1.5">
            {fahrer.map(f => (
              <div
                key={f.fahrer_id}
                className={`rounded-lg px-3 py-2 ${AMPEL_BG[f.ampel]}`}
              >
                {f.alert_bottom && (
                  <div className="flex items-center gap-1 text-xs text-red-600 font-medium mb-1">
                    <AlertTriangle className="w-3 h-3" /> Wenig Touren/Schicht!
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base">{RANK_BADGE[f.rang] ?? `#${f.rang}`}</span>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{f.fahrer_name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-sm font-bold ${AMPEL_COLOR[f.ampel]}`}>{f.touren_pro_schicht}</span>
                    {f.rank_delta > 0 ? (
                      <span className="flex items-center gap-0.5 text-xs text-emerald-600"><TrendingUp className="w-3 h-3" />+{f.rank_delta}</span>
                    ) : f.rank_delta < 0 ? (
                      <span className="flex items-center gap-0.5 text-xs text-red-500"><TrendingDown className="w-3 h-3" />{f.rank_delta}</span>
                    ) : (
                      <span className="flex items-center gap-0.5 text-xs text-gray-400"><Minus className="w-3 h-3" />0</span>
                    )}
                  </div>
                </div>
                <div className="mt-1.5 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700">
                  <div
                    className={`h-1.5 rounded-full ${f.ampel === 'gruen' ? 'bg-emerald-500' : f.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-red-500'}`}
                    style={{ width: `${Math.round((f.touren_pro_schicht / maxVal) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
