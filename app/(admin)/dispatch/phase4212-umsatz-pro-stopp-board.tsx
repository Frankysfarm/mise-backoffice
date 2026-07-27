'use client';

import { useState, useEffect, useCallback } from 'react';
import { Banknote, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow { fahrer_id: string; fahrer_name: string; rang: number; avg_euro: number; rank_delta: number; ampel: 'gruen' | 'gelb' | 'rot'; alert_niedrig: boolean; }
interface ApiData { fahrer: FahrerRow[]; team_avg: number; bester_name: string; schlechtester_name: string; alert_count: number; gesamt: number; }

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_euro: 42, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_euro: 38, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_euro: 31, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_euro: 24, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg: 33.75,
  bester_name: 'Julia F.',
  schlechtester_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

interface Props { locationId: string | null; }

export function DispatchPhase4212UmsatzProStoppBoard({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-umsatz-pro-stopp-ranking?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  const maxEuro = Math.max(...data.fahrer.map((f) => f.avg_euro), 1);
  const bester = data.fahrer[0];
  const letzter = data.fahrer[data.fahrer.length - 1];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Banknote className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-semibold text-gray-900">Umsatz pro Stopp</span>
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        {data.alert_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3.5 h-3.5" /> {data.alert_count} Niedriger Umsatz!
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-emerald-50 rounded-lg p-2">
          <p className="text-[10px] text-emerald-600 font-medium">Höchster</p>
          <p className="text-sm font-bold text-emerald-700">{bester?.avg_euro?.toFixed(2)} €</p>
          <p className="text-[10px] text-emerald-500 truncate">{data.bester_name}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-[10px] text-gray-500 font-medium">Team-Ø</p>
          <p className="text-sm font-bold text-gray-700">{data.team_avg?.toFixed(2)} €</p>
          <p className="text-[10px] text-gray-400">pro Stopp</p>
        </div>
        <div className="bg-red-50 rounded-lg p-2">
          <p className="text-[10px] text-red-500 font-medium">Niedrigster</p>
          <p className="text-sm font-bold text-red-600">{letzter?.avg_euro?.toFixed(2)} €</p>
          <p className="text-[10px] text-red-400 truncate">{data.schlechtester_name}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {data.fahrer.map((f) => {
          const barW = maxEuro > 0 ? (f.avg_euro / maxEuro) * 100 : 0;
          const barColor = f.ampel === 'gruen' ? 'bg-emerald-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const tColor = f.ampel === 'gruen' ? 'text-emerald-600' : f.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
          const Delta = f.rank_delta < 0 ? TrendingUp : f.rank_delta > 0 ? TrendingDown : Minus;
          const dColor = f.rank_delta < 0 ? 'text-emerald-500' : f.rank_delta > 0 ? 'text-red-400' : 'text-gray-300';
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400 w-4 text-right">#{f.rang}</span>
                <Delta className={`w-3 h-3 flex-shrink-0 ${dColor}`} />
                <span className="text-xs text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
                <span className={`text-xs font-bold ${tColor}`}>{f.avg_euro?.toFixed(2)} €</span>
              </div>
              <div className="ml-7 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barW}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100">
        <span>Team-Ø {data.team_avg?.toFixed(2)} € / Stopp</span>
        <span>#1 = höchster Umsatz</span>
      </div>
    </div>
  );
}
