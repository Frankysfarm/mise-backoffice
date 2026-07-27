'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sun, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  fruehschicht_anteil_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  meister_name: string;
  wenigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, fruehschicht_anteil_pct: 58, rank_delta:  1, ampel: 'rot',   alert_hoch: true  },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 2, fruehschicht_anteil_pct: 42, rank_delta:  0, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 3, fruehschicht_anteil_pct: 29, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, fruehschicht_anteil_pct: 11, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
  ],
  team_avg_pct: 35,
  meister_name: 'Julia F.',
  wenigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

interface Props { locationId: string | null; }

export function DispatchPhase4382FruehschichtBoard({ locationId }: Props) {
  const [data, setData]       = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-fruehschicht-ranking?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  const bester  = data.fahrer[0];
  const letzter = data.fahrer[data.fahrer.length - 1];
  const maxPct  = Math.max(...data.fahrer.map(f => f.fruehschicht_anteil_pct), 1);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sun className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-bold text-gray-900">Frühschicht-Anteil-Ranking</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {!loading && data.alert_count > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" /> {data.alert_count} Hoher Frühschicht-Anteil!
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-yellow-50 rounded-xl p-2">
          <div className="font-bold text-yellow-700">{bester?.fruehschicht_anteil_pct.toFixed(1)}%</div>
          <div className="text-gray-500 truncate">{data.meister_name}</div>
          <div className="text-[10px] text-gray-400">Meiste Früh</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-2">
          <div className="font-bold text-gray-700">{data.team_avg_pct.toFixed(1)}%</div>
          <div className="text-gray-500">{data.gesamt} Fahrer</div>
          <div className="text-[10px] text-gray-400">Team-Ø</div>
        </div>
        <div className="bg-green-50 rounded-xl p-2">
          <div className="font-bold text-green-700">{letzter?.fruehschicht_anteil_pct.toFixed(1)}%</div>
          <div className="text-gray-500 truncate">{data.wenigster_name}</div>
          <div className="text-[10px] text-gray-400">Wenigste Früh</div>
        </div>
      </div>

      <div className="space-y-1.5">
        {data.fahrer.map((f) => {
          // INVERTED rank_delta: >0 = verbessert (Rang-Nummer gesunken)
          const Delta  = f.rank_delta > 0 ? TrendingUp : f.rank_delta < 0 ? TrendingDown : Minus;
          const dColor = f.rank_delta > 0 ? 'text-emerald-500' : f.rank_delta < 0 ? 'text-red-400' : 'text-gray-400';
          const barColor = f.ampel === 'rot' ? 'bg-red-400' : f.ampel === 'gelb' ? 'bg-yellow-300' : 'bg-yellow-500';
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-5 text-right">#{f.rang}</span>
                <span className="text-xs text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
                <Delta className={`w-3 h-3 ${dColor}`} />
                <span className="text-xs font-bold text-gray-900 w-14 text-right">{f.fruehschicht_anteil_pct.toFixed(1)}%</span>
              </div>
              <div className="ml-7 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${(f.fruehschicht_anteil_pct / maxPct) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100">
        <span>Team-Ø: {data.team_avg_pct.toFixed(1)}%</span>
        <span>#1 = höchster Frühschicht-Anteil</span>
      </div>
    </div>
  );
}
