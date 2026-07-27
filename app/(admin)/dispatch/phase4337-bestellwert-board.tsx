'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  driver_id: string;
  driver_name: string;
  avg_bestellwert: number;
  tour_count: number;
  rang: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rank_delta: number | null;
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg: number;
}

const MOCK: ApiData = {
  fahrer: [
    { driver_id: 'm1', driver_name: 'Max M.',   avg_bestellwert: 42.5, tour_count: 8, rang: 1, ampel: 'gruen', rank_delta:  1, alert: false },
    { driver_id: 'm2', driver_name: 'Lisa K.',  avg_bestellwert: 35.2, tour_count: 6, rang: 2, ampel: 'gruen', rank_delta: -1, alert: false },
    { driver_id: 'm3', driver_name: 'Tom B.',   avg_bestellwert: 28.9, tour_count: 7, rang: 3, ampel: 'gelb',  rank_delta:  0, alert: false },
    { driver_id: 'm4', driver_name: 'Paul R.',  avg_bestellwert: 14.8, tour_count: 4, rang: 4, ampel: 'rot',   rank_delta: -2, alert: true  },
  ],
  team_avg: 28.7,
};

interface Props { locationId: string | null; }

export function DispatchPhase4337BestellwertBoard({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-bestellwert-ranking?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  const maxWert = Math.max(...data.fahrer.map(f => f.avg_bestellwert), 0.01);
  const bester = data.fahrer[0];
  const letzter = data.fahrer[data.fahrer.length - 1];
  const alertCount = data.fahrer.filter(f => f.alert).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-orange-500" />
          <span className="text-sm font-bold text-gray-900">Ø-Bestellwert-Ranking</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {!loading && alertCount > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" /> {alertCount}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-orange-50 rounded-xl p-2">
          <div className="font-bold text-orange-700">{bester?.avg_bestellwert.toFixed(2)} €</div>
          <div className="text-gray-500 truncate">{bester?.driver_name}</div>
          <div className="text-[10px] text-gray-400">Höchster</div>
        </div>
        <div className="bg-gray-50 rounded-xl p-2">
          <div className="font-bold text-gray-700">{data.team_avg.toFixed(2)} €</div>
          <div className="text-gray-500">{data.fahrer.length} Fahrer</div>
          <div className="text-[10px] text-gray-400">Team-Ø</div>
        </div>
        <div className="bg-red-50 rounded-xl p-2">
          <div className="font-bold text-red-600">{letzter?.avg_bestellwert.toFixed(2)} €</div>
          <div className="text-gray-500 truncate">{letzter?.driver_name}</div>
          <div className="text-[10px] text-gray-400">Niedrigster</div>
        </div>
      </div>

      <div className="space-y-1.5">
        {data.fahrer.map((f) => {
          // INVERTED rank_delta: rank_delta > 0 = verbessert = TrendingUp emerald
          const delta = f.rank_delta ?? 0;
          const Delta = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
          const dColor = delta > 0 ? 'text-emerald-500' : delta < 0 ? 'text-red-400' : 'text-gray-400';
          const barColor = f.ampel === 'gruen' ? 'bg-orange-500' : f.ampel === 'gelb' ? 'bg-orange-300' : 'bg-red-400';
          const barW = (f.avg_bestellwert / maxWert) * 100;
          return (
            <div key={f.driver_id} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-5 text-right">#{f.rang}</span>
                <span className="text-xs text-gray-700 flex-1 truncate">{f.driver_name}</span>
                <div className="flex items-center gap-0.5">
                  <Delta className={`w-3 h-3 ${dColor}`} />
                </div>
                <span className="text-xs font-bold text-gray-900 w-14 text-right">{f.avg_bestellwert.toFixed(2)} €</span>
              </div>
              <div className="ml-7 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barW}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100">
        <span>Team-Ø: {data.team_avg.toFixed(2)} €</span>
        <span>#1 = höchster Ø-Bestellwert</span>
      </div>
    </div>
  );
}
