'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_sterne: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_schlecht: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_sterne: number;
  bester_name: string;
  schlechtester_name: string;
  alert_count: number;
  gesamt: number;
  ziel_sterne: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   rang: 1, avg_sterne: 4.9, rank_delta:  0, ampel: 'gruen', alert_schlecht: false },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, avg_sterne: 4.5, rank_delta:  1, ampel: 'gruen', alert_schlecht: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, avg_sterne: 3.8, rank_delta: -1, ampel: 'gelb',  alert_schlecht: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_sterne: 2.9, rank_delta:  0, ampel: 'rot',   alert_schlecht: true  },
  ],
  team_avg_sterne: 4.0,
  bester_name: 'Max M.',
  schlechtester_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_sterne: 4.0,
};

export function DispatchPhase3954BewertungsScoreBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-bewertungs-score-ranking?location_id=${locationId}`);
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

  // descending: highest avg_sterne = Rang 1 = best
  const sorted = [...data.fahrer].sort((a, b) => a.rang - b.rang);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const maxVal = Math.max(...sorted.map(f => f.avg_sterne), 5);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-semibold text-gray-900">Bewertungs-Score</span>
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        {data.alert_count > 0 && (
          <span className="text-[11px] bg-red-100 text-red-700 font-medium px-2 py-0.5 rounded-full">
            {data.alert_count} Alert{data.alert_count > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>Schlechte Bewertungen!</span>
        </div>
      )}

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-amber-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-amber-600 font-medium">Bester</div>
          <div className="text-lg font-black text-amber-700">{best?.avg_sterne?.toFixed(1) ?? '–'}★</div>
          <div className="text-[10px] text-amber-500 truncate">{best?.fahrer_name ?? '–'}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500 font-medium">Team-Ø</div>
          <div className="text-lg font-black text-gray-700">{data.team_avg_sterne?.toFixed(1) ?? '–'}★</div>
          <div className="text-[10px] text-gray-400">Ziel ≥4.0★</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-red-500 font-medium">Niedrigster</div>
          <div className="text-lg font-black text-red-600">{worst?.avg_sterne?.toFixed(1) ?? '–'}★</div>
          <div className="text-[10px] text-red-400 truncate">{worst?.fahrer_name ?? '–'}</div>
        </div>
      </div>

      {/* Ranking-Liste */}
      <div className="space-y-1.5">
        {sorted.map((f) => {
          const tColor = f.ampel === 'gruen' ? 'text-amber-600' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          const bgColor = f.ampel === 'gruen' ? 'bg-amber-50' : f.ampel === 'gelb' ? 'bg-yellow-50' : 'bg-red-50';
          const barColor = f.ampel === 'gruen' ? 'bg-amber-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const DeltaIcon = f.rank_delta < 0
            ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            : f.rank_delta > 0
              ? <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              : <Minus className="w-3.5 h-3.5 text-gray-300" />;
          return (
            <div key={f.fahrer_id} className={`space-y-0.5 px-2.5 py-1.5 rounded-lg ${bgColor}`}>
              <div className="flex items-center gap-2">
                <span className="w-5 text-center text-[11px] font-mono text-gray-400">
                  {f.rang === 1 ? '🥇' : f.rang === 2 ? '🥈' : f.rang === 3 ? '🥉' : `#${f.rang}`}
                </span>
                <span className="flex-1 text-xs font-medium text-gray-800 truncate">{f.fahrer_name}</span>
                <span className={`text-sm font-bold ${tColor}`}>{f.avg_sterne?.toFixed(1)}★</span>
                {DeltaIcon}
                {f.alert_schlecht && <AlertTriangle className="w-3 h-3 text-red-500 shrink-0" />}
              </div>
              <div className="h-1 bg-white bg-opacity-70 rounded-full overflow-hidden ml-7">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${(f.avg_sterne / maxVal) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
