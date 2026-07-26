'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertOctagon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  reklamations_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  alert_count: number;
  ziel_pct: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, reklamations_pct:  1, rank_delta: -1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, reklamations_pct:  3, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, reklamations_pct:  7, rank_delta:  1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, reklamations_pct: 14, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg_pct: 6,
  alert_count: 1,
  ziel_pct: 3,
};

export function KitchenPhase3887ReklamationsquoteTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-reklamations-quote?location_id=${locationId}`);
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

  // Ascending: lowest reklamations_pct = Rang 1 = best
  const sorted = [...data.fahrer].sort((a, b) => a.reklamations_pct - b.reklamations_pct);
  const best = sorted[0];
  const maxVal = Math.max(...sorted.map(f => f.reklamations_pct), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      {/* Header mit Bester #1 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 text-red-500" />
          <span className="text-sm font-semibold text-gray-900">Reklamationsquote</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        {best && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500">🥇</span>
            <span className="font-bold text-gray-800">{best.fahrer_name}</span>
            <span className="font-black text-emerald-700">{best.reklamations_pct}%</span>
          </div>
        )}
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">
          <AlertOctagon className="w-3 h-3 shrink-0" />
          <span>Hohe Reklamationsquote!</span>
        </div>
      )}

      {/* Kompakt-Liste (aufsteigend: niedrigste = Rang 1 = bester) */}
      <div className="space-y-1.5">
        {sorted.map(f => {
          const tColor = f.ampel === 'gruen' ? 'text-emerald-700' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          const barColor = f.ampel === 'gruen' ? 'bg-emerald-500' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          // Delta: neg=verbessert=gruen (ascending metric)
          const DeltaIcon = f.rank_delta < 0
            ? <TrendingUp className="w-3 h-3 text-emerald-500" />
            : f.rank_delta > 0
              ? <TrendingDown className="w-3 h-3 text-red-400" />
              : <Minus className="w-3 h-3 text-gray-300" />;
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-4 text-gray-400 font-mono text-[10px]">#{f.rang}</span>
                <span className="flex-1 text-gray-800 font-medium truncate">{f.fahrer_name}</span>
                <span className={`font-bold ${tColor}`}>{f.reklamations_pct}%</span>
                {DeltaIcon}
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden ml-5">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${(f.reklamations_pct / maxVal) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-1.5">
        <span>Team-Ø {data.team_avg_pct}%</span>
        <span>Ziel ≤{data.ziel_pct}%</span>
      </div>
    </div>
  );
}
