'use client';

import { useState, useEffect, useCallback } from 'react';
import { XCircle, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow { fahrer_id: string; fahrer_name: string; rang: number; stornoquote_pct: number; rank_delta: number; ampel: 'gruen' | 'gelb' | 'rot'; alert_hoch: boolean; }
interface ApiData { fahrer: FahrerRow[]; team_avg_pct: number; bester_name: string; hoechste_name: string; alert_count: number; gesamt: number; ziel_pct: number; }

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, stornoquote_pct: 1.2, rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, stornoquote_pct: 2.8, rank_delta:  0, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, stornoquote_pct: 4.5, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, stornoquote_pct: 7.3, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg_pct: 3.95,
  bester_name: 'Julia F.',
  hoechste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_pct: 3,
};

interface Props { locationId: string | null; }

export function DispatchPhase4227StornoquoteBoard({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-stornoquote-ranking?location_id=${locationId}`);
      if (res.ok) { const json = await res.json(); if (!json.error) setData(json); }
    } catch { /* Mock-Fallback */ } finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => { load(); const id = setInterval(load, 30 * 60 * 1000); return () => clearInterval(id); }, [load]);

  const maxPct = Math.max(...data.fahrer.map((f) => f.stornoquote_pct), 1);
  const bester = data.fahrer[0];
  const letzter = data.fahrer[data.fahrer.length - 1];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <XCircle className="w-4 h-4 text-rose-500" />
          <span className="text-sm font-semibold text-gray-900">Storno-Quote</span>
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        {data.alert_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-600 font-semibold bg-red-50 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3.5 h-3.5" /> {data.alert_count} Hohe Storno-Quote!
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-green-50 rounded-lg p-2">
          <p className="text-[10px] text-green-600 font-medium">Niedrigste</p>
          <p className="text-sm font-bold text-green-700">{bester?.stornoquote_pct}%</p>
          <p className="text-[10px] text-green-500 truncate">{data.bester_name}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <p className="text-[10px] text-gray-500 font-medium">Team-Ø</p>
          <p className="text-sm font-bold text-gray-700">{data.team_avg_pct}%</p>
          <p className="text-[10px] text-gray-400">Ziel ≤{data.ziel_pct}%</p>
        </div>
        <div className="bg-red-50 rounded-lg p-2">
          <p className="text-[10px] text-red-500 font-medium">Höchste</p>
          <p className="text-sm font-bold text-red-600">{letzter?.stornoquote_pct}%</p>
          <p className="text-[10px] text-red-400 truncate">{data.hoechste_name}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        {data.fahrer.map((f) => {
          const barW = maxPct > 0 ? (f.stornoquote_pct / maxPct) * 100 : 0;
          const barColor = f.ampel === 'gruen' ? 'bg-green-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const tColor = f.ampel === 'gruen' ? 'text-green-600' : f.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
          const Delta = f.rank_delta > 0 ? TrendingUp : f.rank_delta < 0 ? TrendingDown : Minus;
          const dColor = f.rank_delta > 0 ? 'text-emerald-500' : f.rank_delta < 0 ? 'text-red-400' : 'text-gray-300';
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400 w-4 text-right">#{f.rang}</span>
                <Delta className={`w-3 h-3 flex-shrink-0 ${dColor}`} />
                <span className="text-xs text-gray-700 flex-1 truncate">{f.fahrer_name}</span>
                <span className={`text-xs font-bold ${tColor}`}>{f.stornoquote_pct}%</span>
              </div>
              <div className="ml-7 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barW}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100">
        <span>Team-Ø {data.team_avg_pct}% · Ziel ≤{data.ziel_pct}%</span>
        <span>#1 = niedrigste Storno-Quote</span>
      </div>
    </div>
  );
}
