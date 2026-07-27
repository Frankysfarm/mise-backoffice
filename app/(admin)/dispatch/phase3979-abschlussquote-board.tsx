'use client';

import { useState, useEffect, useCallback } from 'react';
import { Target, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  quote_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  alert_count: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, quote_pct: 97, rank_delta:  2, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, quote_pct: 89, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, quote_pct: 76, rank_delta:  1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, quote_pct: 52, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_pct: 78,
  alert_count: 1,
};

interface Props {
  locationId: string | null;
}

export function DispatchPhase3979AbschlussquoteBoard({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-abschlussquoten-ranking?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
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

  const bester = data.fahrer[0];
  const niedrigster = data.fahrer[data.fahrer.length - 1];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-teal-500" />
        <span className="text-sm font-semibold text-gray-900">Abschlussquoten-Ranking</span>
        {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin ml-auto" />}
        {!loading && data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-600 font-semibold">
            <AlertTriangle className="w-3.5 h-3.5" /> {data.alert_count} Niedrige Abschlussquote!
          </span>
        )}
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-emerald-50 rounded-lg p-2">
          <div className="text-[10px] text-gray-500 mb-0.5">Bester</div>
          <div className="font-bold text-emerald-700 truncate">{bester?.fahrer_name}</div>
          <div className="font-black text-emerald-600">{bester?.quote_pct?.toFixed(1)}%</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-[10px] text-gray-500 mb-0.5">Team-Ø</div>
          <div className="font-black text-gray-700">{data.team_avg_pct?.toFixed(1)}%</div>
          <div className="text-[10px] text-gray-400">Ziel ≥90%</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2">
          <div className="text-[10px] text-gray-500 mb-0.5">Niedrigster</div>
          <div className="font-bold text-red-700 truncate">{niedrigster?.fahrer_name}</div>
          <div className="font-black text-red-600">{niedrigster?.quote_pct?.toFixed(1)}%</div>
        </div>
      </div>

      {/* Ranking-Liste */}
      <div className="space-y-1.5">
        {data.fahrer.map((f) => {
          const tColor = f.ampel === 'gruen' ? 'text-emerald-600' : f.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
          const barColor = f.ampel === 'gruen' ? 'bg-emerald-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const DeltaIcon = f.rank_delta > 0
            ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            : f.rank_delta < 0
              ? <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              : <Minus className="w-3.5 h-3.5 text-gray-300" />;
          return (
            <div key={f.fahrer_id} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-4 text-right">#{f.rang}</span>
              <span className="text-xs text-gray-700 w-20 truncate">{f.fahrer_name}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${f.quote_pct}%` }} />
              </div>
              <span className={`text-xs font-bold w-10 text-right ${tColor}`}>{f.quote_pct?.toFixed(1)}%</span>
              {DeltaIcon}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex justify-between text-[11px] text-gray-400 px-1">
        <span>Team-Ø {data.team_avg_pct?.toFixed(1)}%</span>
        <span>Ziel ≥90%</span>
      </div>
    </div>
  );
}
