'use client';

import { useState, useEffect, useCallback } from 'react';
import { Euro, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  umsatz_pro_stunde: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_umsatz: number;
  alert_count: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, umsatz_pro_stunde: 42, rank_delta:  1, ampel: 'gruen' },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, umsatz_pro_stunde: 38, rank_delta:  0, ampel: 'gruen' },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, umsatz_pro_stunde: 35, rank_delta: -1, ampel: 'gelb'  },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, umsatz_pro_stunde: 28, rank_delta:  0, ampel: 'rot'   },
  ],
  team_avg_umsatz: 35.8,
  alert_count: 1,
};

export function DispatchPhase3884UmsatzProStundeBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-umsatz-pro-stunde?location_id=${locationId}`);
      if (res.ok) setData(await res.json());
    } catch {
      // Mock-Fallback
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const sorted = [...data.fahrer].sort((a, b) => b.umsatz_pro_stunde - a.umsatz_pro_stunde);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const maxVal = Math.max(...sorted.map(f => f.umsatz_pro_stunde), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Euro className="w-5 h-5 text-teal-600" />
          <h3 className="text-sm font-bold text-gray-900">Umsatz/Stunde</h3>
          {loading && <span className="w-3 h-3 border-2 border-teal-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        <span className="text-xs text-gray-400">Ziel ≥30 €/h</span>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Bester</div>
          <div className="text-lg font-black text-emerald-700">{best?.umsatz_pro_stunde ?? '—'}€</div>
          <div className="text-[10px] text-gray-600 truncate">{best?.fahrer_name ?? '—'}</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Team-Ø</div>
          <div className="text-lg font-black text-blue-700">{data.team_avg_umsatz}€</div>
          <div className="text-[10px] text-gray-600">pro Stunde</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Niedrigster</div>
          <div className="text-lg font-black text-red-600">{worst?.umsatz_pro_stunde ?? '—'}€</div>
          <div className="text-[10px] text-gray-600 truncate">{worst?.fahrer_name ?? '—'}</div>
        </div>
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{data.alert_count} Fahrer mit niedrigem Umsatz/h!</span>
        </div>
      )}

      {/* Rangliste (absteigend) */}
      <div className="space-y-1.5">
        {sorted.map(f => {
          const tColor = f.ampel === 'gruen' ? 'text-emerald-700' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          const barColor = f.ampel === 'gruen' ? 'bg-emerald-500' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-4 text-gray-400 font-mono text-[10px]">#{f.rang}</span>
                <span className="flex-1 text-gray-800 font-medium truncate">{f.fahrer_name}</span>
                <span className={`font-bold ${tColor}`}>{f.umsatz_pro_stunde}€/h</span>
                {f.rank_delta > 0
                  ? <TrendingUp className="w-3 h-3 text-emerald-500" />
                  : f.rank_delta < 0
                    ? <TrendingDown className="w-3 h-3 text-red-400" />
                    : <Minus className="w-3 h-3 text-gray-300" />
                }
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden ml-5">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${(f.umsatz_pro_stunde / maxVal) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-[10px] text-gray-400 border-t border-gray-100 pt-1.5 text-right">
        Ø Umsatz/h (letzte 30 Tage)
      </div>
    </div>
  );
}
