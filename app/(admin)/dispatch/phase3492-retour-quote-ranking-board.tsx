'use client';

import { useState, useEffect, useCallback } from 'react';
import { RotateCcw, ChevronDown, ChevronUp, AlertTriangle, TrendingDown } from 'lucide-react';

interface FahrerRetourQuote {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  retour_quote_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiData {
  fahrer: FahrerRetourQuote[];
  team_avg: number;
  bester_name: string;
  hoechster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'u1', fahrer_name: 'Julia F.', rang: 1, retour_quote_pct:  2, rank_delta:  0, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'u2', fahrer_name: 'Sara K.',  rang: 2, retour_quote_pct:  5, rank_delta:  1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'u3', fahrer_name: 'Max M.',   rang: 3, retour_quote_pct:  9, rank_delta: -1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'u4', fahrer_name: 'Tim B.',   rang: 4, retour_quote_pct: 15, rank_delta:  0, ampel: 'rot',   alert_top: true  },
  ],
  team_avg: 7.8,
  bester_name: 'Julia F.',
  hoechster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

const AMPEL_COLORS: Record<string, string> = {
  gruen: 'text-emerald-600 dark:text-emerald-400',
  gelb:  'text-yellow-600 dark:text-yellow-400',
  rot:   'text-red-600 dark:text-red-400',
};
const AMPEL_BAR: Record<string, string> = {
  gruen: 'bg-emerald-500',
  gelb:  'bg-yellow-400',
  rot:   'bg-red-500',
};

export function DispatchPhase3492RetourQuoteRankingBoard({
  locationId,
}: {
  locationId: string | null;
}) {
  const [open, setOpen] = useState(true);
  const [data, setData] = useState<ApiData>(MOCK);

  const load = useCallback(async () => {
    if (!locationId) return;
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-retour-quote?location_id=${locationId}`, { cache: 'no-store' });
      if (r.ok) setData(await r.json());
    } catch {
      setData(MOCK);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const maxPct = Math.max(...data.fahrer.map(f => f.retour_quote_pct), 1);

  return (
    <div className="border rounded-lg bg-white dark:bg-gray-900 shadow-sm mb-3">
      <button
        className="w-full flex items-center justify-between p-3 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 font-semibold text-sm">
          <RotateCcw className="w-4 h-4 text-orange-500" />
          Retour-Quote-Ranking
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
          <div className="grid grid-cols-3 gap-1.5 text-center">
            <div className="rounded bg-gray-50 dark:bg-gray-800 p-2">
              <div className="text-[9px] text-gray-400 uppercase tracking-wide">Bester</div>
              <div className="text-xs font-bold truncate">{data.bester_name}</div>
            </div>
            <div className="rounded bg-gray-50 dark:bg-gray-800 p-2">
              <div className="text-[9px] text-gray-400 uppercase tracking-wide">Team-Ø</div>
              <div className="text-xs font-bold">{data.team_avg} %</div>
            </div>
            <div className="rounded bg-gray-50 dark:bg-gray-800 p-2">
              <div className="text-[9px] text-gray-400 uppercase tracking-wide">Höchster</div>
              <div className="text-xs font-bold truncate text-red-600">{data.hoechster_name}</div>
            </div>
          </div>

          {/* Alert */}
          {data.alert_count > 0 && (
            <div className="flex items-center gap-1.5 p-1.5 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-xs">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              {data.alert_count} Fahrer mit hoher Retour-Quote — Ursache prüfen!
            </div>
          )}

          {/* Ranking */}
          <div className="space-y-1.5">
            {data.fahrer.map(f => (
              <div key={f.fahrer_id} className="flex items-center gap-2">
                <span className="w-5 text-xs font-bold text-gray-400 text-right shrink-0">#{f.rang}</span>
                <span className="text-xs font-semibold w-16 truncate">{f.fahrer_name}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${AMPEL_BAR[f.ampel]} transition-all duration-500`}
                    style={{ width: `${Math.round((f.retour_quote_pct / maxPct) * 100)}%` }}
                  />
                </div>
                <span className={`text-xs font-bold tabular-nums w-10 text-right ${AMPEL_COLORS[f.ampel]}`}>
                  {f.retour_quote_pct} %
                </span>
                <span className={`text-[10px] w-8 text-right tabular-nums font-semibold ${f.rank_delta < 0 ? 'text-emerald-600' : f.rank_delta > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                  {f.rank_delta < 0 ? `▲${Math.abs(f.rank_delta)}` : f.rank_delta > 0 ? `▼${f.rank_delta}` : '—'}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1 text-[9px] text-gray-400 pt-0.5">
            <TrendingDown className="w-2.5 h-2.5" />
            Rang 1 = niedrigste Retour-Quote = bester Abschluss · Ziel ≤5%
          </div>
        </div>
      )}
    </div>
  );
}
