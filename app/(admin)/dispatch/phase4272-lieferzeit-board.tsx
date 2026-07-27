'use client';

import { useState, useEffect, useCallback } from 'react';
import { Truck, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg: number;
  schnellster_name: string;
  langsamster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'm1', fahrer_name: 'Julia F.', rang: 1, avg_min: 18, rank_delta: -1, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'm2', fahrer_name: 'Sara K.',  rang: 2, avg_min: 22, rank_delta:  0, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'm3', fahrer_name: 'Max M.',   rang: 3, avg_min: 28, rank_delta:  1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'm4', fahrer_name: 'Tim B.',   rang: 4, avg_min: 36, rank_delta:  0, ampel: 'rot',   alert_top: true  },
  ],
  team_avg: 26,
  schnellster_name: 'Julia F.',
  langsamster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

interface Props { locationId: string | null; }

export function DispatchPhase4272LieferzeitBoard({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-durchschnitts-lieferzeit-ranking?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  const maxMin = Math.max(...data.fahrer.map((f) => f.avg_min), 0.1);
  const schnellster = data.fahrer[0];
  const langsamster = data.fahrer[data.fahrer.length - 1];
  const hasAlert = data.alert_count > 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-cyan-500" />
          <span className="text-sm font-semibold text-gray-900">Ø Lieferzeit</span>
          <span className="text-xs text-gray-400">({data.gesamt} Fahrer)</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {!loading && hasAlert && (
            <span className="flex items-center gap-1 text-xs text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded-full">
              <AlertTriangle className="w-3 h-3" /> {data.alert_count} Alert
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-cyan-50 rounded-lg p-2 text-center">
          <div className="text-xs text-cyan-600 font-medium truncate">{data.schnellster_name}</div>
          <div className="text-lg font-bold text-cyan-700">{schnellster?.avg_min} min</div>
          <div className="text-[10px] text-cyan-500">Schnellste</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500 font-medium">Team-Ø</div>
          <div className="text-lg font-bold text-gray-700">{data.team_avg} min</div>
          <div className="text-[10px] text-gray-400">Lieferzeit</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2 text-center">
          <div className="text-xs text-red-600 font-medium truncate">{data.langsamster_name}</div>
          <div className="text-lg font-bold text-red-700">{langsamster?.avg_min} min</div>
          <div className="text-[10px] text-red-500">Langsamste</div>
        </div>
      </div>

      {hasAlert && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <span className="text-xs text-amber-700 font-medium">Hohe Lieferzeit – Route oder Tempo prüfen!</span>
        </div>
      )}

      <div className="space-y-2">
        {data.fahrer.map((f) => {
          const barW = maxMin > 0 ? (f.avg_min / maxMin) * 100 : 0;
          const barColor = f.ampel === 'gruen' ? 'bg-cyan-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const Delta = f.rank_delta < 0 ? TrendingUp : f.rank_delta > 0 ? TrendingDown : Minus;
          const dColor = f.rank_delta < 0 ? 'text-emerald-500' : f.rank_delta > 0 ? 'text-red-400' : 'text-gray-300';
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-5 text-right">#{f.rang}</span>
                <span className="text-xs text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
                <Delta className={`w-3 h-3 ${dColor}`} />
                <span className="text-xs font-bold text-gray-900 w-16 text-right">{f.avg_min} min</span>
              </div>
              <div className="ml-7 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barW}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-gray-400 text-right">#1 = schnellste Lieferzeit • 30-Min-Aktualisierung</div>
    </div>
  );
}
