'use client';

import { useState, useEffect, useCallback } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  auslastung_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'u1', fahrer_name: 'Julia F.', rang: 1, auslastung_pct: 95, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'u2', fahrer_name: 'Sara K.',  rang: 2, auslastung_pct: 82, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'u3', fahrer_name: 'Max M.',   rang: 3, auslastung_pct: 67, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'u4', fahrer_name: 'Tim B.',   rang: 4, auslastung_pct: 48, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg: 73,
  bester_name: 'Julia F.',
  niedrigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

export function DispatchPhase3929TourenAuslastungBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-touren-auslastung-ranking?location_id=${locationId}`);
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

  // descending: highest auslastung_pct = Rang 1 = best
  const sorted = [...data.fahrer].sort((a, b) => a.rang - b.rang);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const maxVal = Math.max(...sorted.map(f => f.auslastung_pct), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900 text-sm">Auslastungs-Ranking</h3>
          {loading && <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin ml-1" />}
        </div>
        <span className="text-xs text-gray-400">Ziel ≥80%</span>
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <Activity className="w-3.5 h-3.5 shrink-0" />
          <span>Geringe Auslastung! ({data.alert_count} Fahrer)</span>
        </div>
      )}

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-[10px] text-gray-400 mb-0.5">Bester</div>
          <div className="text-sm font-bold text-gray-800 truncate">{best?.fahrer_name ?? '–'}</div>
          <div className="text-xs font-semibold text-emerald-600">{best?.auslastung_pct ?? 0}%</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-[10px] text-gray-400 mb-0.5">Team-Ø</div>
          <div className="text-sm font-bold text-gray-800">{data.team_avg}%</div>
          <div className="text-[10px] text-gray-400">Schnitt</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-[10px] text-gray-400 mb-0.5">Niedrigster</div>
          <div className="text-sm font-bold text-gray-800 truncate">{worst?.fahrer_name ?? '–'}</div>
          <div className="text-xs font-semibold text-red-500">{worst?.auslastung_pct ?? 0}%</div>
        </div>
      </div>

      {/* Fahrer-Liste */}
      <div className="space-y-1.5">
        {sorted.map((f, i) => {
          const tColor = f.ampel === 'gruen' ? 'text-gray-700' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          const barColor = f.ampel === 'gruen' ? 'bg-emerald-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          // rank_delta < 0 = moved to lower position number = improved
          const DeltaIcon = f.rank_delta < 0
            ? <TrendingUp className="w-3 h-3 text-emerald-500" />
            : f.rank_delta > 0
              ? <TrendingDown className="w-3 h-3 text-red-400" />
              : <Minus className="w-3 h-3 text-gray-300" />;
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-5 text-gray-400 font-mono text-[10px]">#{i + 1}</span>
                <span className="flex-1 text-gray-800 font-medium truncate">{f.fahrer_name}</span>
                <span className={`font-bold ${tColor}`}>{f.auslastung_pct}%</span>
                {DeltaIcon}
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden ml-6">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${(f.auslastung_pct / maxVal) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-2">
        <span>Team-Ø {data.team_avg}%</span>
        <span>Ziel ≥80%</span>
      </div>
    </div>
  );
}
