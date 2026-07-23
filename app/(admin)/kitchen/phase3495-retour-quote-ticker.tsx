'use client';

import { useState, useEffect, useCallback } from 'react';
import { RotateCcw, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';

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
  alert_count: number;
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
  alert_count: 1,
};

const AMPEL_COLORS: Record<string, string> = {
  gruen: 'text-emerald-600 dark:text-emerald-400',
  gelb:  'text-yellow-600 dark:text-yellow-400',
  rot:   'text-red-600 dark:text-red-400',
};

export function KitchenPhase3495RetourQuoteTicker({
  locationId,
}: {
  locationId?: string | null;
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

  const best = data.fahrer[0];

  return (
    <div className="border rounded-lg bg-white dark:bg-gray-900 shadow-sm mb-2">
      <button
        className="w-full flex items-center justify-between p-2.5 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="flex items-center gap-2 font-semibold text-xs">
          <RotateCcw className="w-3.5 h-3.5 text-orange-500" />
          {best ? (
            <>
              #{best.rang} {best.fahrer_name} · {best.retour_quote_pct}%
            </>
          ) : 'Retour-Quote-Ranking'}
          {data.alert_count > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-[10px] font-bold">
              {data.alert_count} ⚠
            </span>
          )}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>

      {open && (
        <div className="px-2.5 pb-2.5 space-y-1">
          {/* Alert */}
          {data.alert_count > 0 && (
            <div className="flex items-center gap-1.5 p-1.5 rounded bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-[10px] mb-1.5">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
              Hohe Retour-Quote — Ursachen prüfen!
            </div>
          )}

          {data.fahrer.map(f => (
            <div key={f.fahrer_id} className="flex items-center gap-1.5 text-[11px]">
              <span className="w-4 text-[9px] text-gray-400 text-right shrink-0">#{f.rang}</span>
              <span className="font-semibold w-14 truncate">{f.fahrer_name}</span>
              <span className={`font-bold tabular-nums flex-1 text-right ${AMPEL_COLORS[f.ampel]}`}>
                {f.retour_quote_pct}%
              </span>
              <span className={`text-[9px] w-6 text-right font-semibold ${f.rank_delta < 0 ? 'text-emerald-600' : f.rank_delta > 0 ? 'text-red-500' : 'text-gray-400'}`}>
                {f.rank_delta < 0 ? `▲${Math.abs(f.rank_delta)}` : f.rank_delta > 0 ? `▼${f.rank_delta}` : '—'}
              </span>
            </div>
          ))}

          <div className="flex justify-between text-[9px] text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700">
            <span>Team-Ø: {data.team_avg}%</span>
            <span>Ziel: ≤5%</span>
          </div>
        </div>
      )}
    </div>
  );
}
