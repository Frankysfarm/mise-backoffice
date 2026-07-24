'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  puenktlichkeit_rate: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_rate: number;
  puenktlichster_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
  ziel_rate: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, puenktlichkeit_rate: 94, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, puenktlichkeit_rate: 88, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, puenktlichkeit_rate: 76, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, puenktlichkeit_rate: 62, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_rate: 80,
  puenktlichster_name: 'Julia F.',
  niedrigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
  ziel_rate: 90,
};

function ampelColor(ampel: FahrerRow['ampel']) {
  if (ampel === 'gruen') return { text: 'text-emerald-600', bg: 'bg-emerald-50', bar: 'bg-emerald-500', border: 'border-emerald-200' };
  if (ampel === 'gelb')  return { text: 'text-yellow-600',  bg: 'bg-yellow-50',  bar: 'bg-yellow-400',  border: 'border-yellow-200' };
  return                        { text: 'text-red-600',     bg: 'bg-red-50',     bar: 'bg-red-500',     border: 'border-red-200' };
}

const RANK_BADGE: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function DispatchPhase3744PuenktlichkeitRankingBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-puenktlichkeit-ranking-v2?location_id=${locationId}`);
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

  const maxRate = Math.max(...data.fahrer.map(f => f.puenktlichkeit_rate), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-emerald-600" />
          <span className="font-semibold text-gray-900 text-sm">Pünktlichkeits-Ranking</span>
          {loading && <span className="w-3 h-3 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        <div className="text-xs text-gray-500">
          Pünktlichster: <span className="font-bold text-gray-800">{data.puenktlichster_name}</span>
        </div>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-emerald-50 rounded-lg p-2">
          <div className="text-base font-black text-emerald-600">{data.fahrer[0]?.puenktlichkeit_rate}%</div>
          <div className="text-[10px] text-gray-500">Pünktlichster</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-base font-black text-gray-800">{data.team_avg_rate}%</div>
          <div className="text-[10px] text-gray-500">Team-Ø</div>
        </div>
        <div className={`rounded-lg p-2 ${data.alert_count > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
          <div className={`text-base font-black ${data.alert_count > 0 ? 'text-red-600' : 'text-gray-800'}`}>
            {data.fahrer[data.fahrer.length - 1]?.puenktlichkeit_rate}%
          </div>
          <div className="text-[10px] text-gray-500">Niedrigster</div>
        </div>
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{data.alert_count} Fahrer mit niedriger Pünktlichkeit — Coaching empfohlen!</span>
        </div>
      )}

      {/* Ranking-Liste */}
      <div className="space-y-2">
        {data.fahrer.map(f => {
          const c = ampelColor(f.ampel);
          const barPct = (f.puenktlichkeit_rate / maxRate) * 100;
          return (
            <div key={f.fahrer_id} className={`rounded-lg border ${c.border} ${c.bg} p-2.5 space-y-1.5`}>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-400 w-6">{RANK_BADGE[f.rang] ?? `#${f.rang}`}</span>
                <span className="flex-1 text-sm font-bold text-gray-900 truncate">{f.fahrer_name}</span>
                <span className={`text-sm font-black ${c.text}`}>{f.puenktlichkeit_rate}%</span>
                {f.rank_delta !== 0 && (
                  f.rank_delta > 0
                    ? <TrendingUp className="w-3 h-3 text-emerald-500 shrink-0" />
                    : <TrendingDown className="w-3 h-3 text-red-500 shrink-0" />
                )}
                {f.alert_niedrig && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
              </div>
              <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                <div className={`h-full ${c.bar} rounded-full transition-all duration-500`} style={{ width: `${barPct}%` }} />
              </div>
              {f.alert_niedrig && (
                <div className="text-[10px] text-red-600 font-medium">Niedrige Pünktlichkeit!</div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-[10px] text-gray-400 text-center">
        Ziel ≥{data.ziel_rate}% · Rang 1=pünktlichster Fahrer=bester · 30-Min-Polling
      </div>
    </div>
  );
}
