'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  touren_pro_stunde: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, touren_pro_stunde: 2.1, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 2, touren_pro_stunde: 1.8, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 3, touren_pro_stunde: 1.5, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, touren_pro_stunde: 1.1, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg: 1.6,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

interface Props { locationId: string | null; }

export function DispatchPhase4237TourenProStundeBoard({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-touren-pro-stunde-ranking?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  const maxTph = Math.max(...data.fahrer.map((f) => f.touren_pro_stunde), 0.1);
  const bester = data.fahrer[0];
  const letzter = data.fahrer[data.fahrer.length - 1];
  const hasAlert = data.alert_count > 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-indigo-500" />
          <span className="text-sm font-semibold text-gray-900">Touren / Stunde</span>
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
        <div className="bg-indigo-50 rounded-lg p-2 text-center">
          <div className="text-xs text-indigo-600 font-medium truncate">{data.bester_name}</div>
          <div className="text-lg font-bold text-indigo-700">{bester?.touren_pro_stunde}</div>
          <div className="text-[10px] text-indigo-500">Schnellste</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-xs text-gray-500 font-medium">Team-Ø</div>
          <div className="text-lg font-bold text-gray-700">{data.team_avg}</div>
          <div className="text-[10px] text-gray-400">Touren/h</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2 text-center">
          <div className="text-xs text-red-600 font-medium truncate">{data.letzter_name}</div>
          <div className="text-lg font-bold text-red-700">{letzter?.touren_pro_stunde}</div>
          <div className="text-[10px] text-red-500">Niedrigste</div>
        </div>
      </div>

      {hasAlert && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
          <span className="text-xs text-amber-700 font-medium">Niedrige Touren/h – Einsatz optimieren!</span>
        </div>
      )}

      <div className="space-y-2">
        {data.fahrer.map((f) => {
          const barW = maxTph > 0 ? (f.touren_pro_stunde / maxTph) * 100 : 0;
          const barColor = f.ampel === 'gruen' ? 'bg-indigo-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const Delta = f.rank_delta > 0 ? TrendingUp : f.rank_delta < 0 ? TrendingDown : Minus;
          const dColor = f.rank_delta > 0 ? 'text-emerald-500' : f.rank_delta < 0 ? 'text-red-400' : 'text-gray-300';
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 w-5 text-right">#{f.rang}</span>
                <span className="text-xs text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
                <Delta className={`w-3 h-3 ${dColor}`} />
                <span className="text-xs font-bold text-gray-900 w-14 text-right">{f.touren_pro_stunde}/h</span>
              </div>
              <div className="ml-7 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barW}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-gray-400 text-right">#1 = höchste Touren/h • 30-Min-Aktualisierung</div>
    </div>
  );
}
