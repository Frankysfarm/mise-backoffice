'use client';

import { useState, useEffect, useCallback } from 'react';
import { Heart, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  trinkgeld_quote: number;
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_quote: number;
  alert_count: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'd1', fahrer_name: 'Max M.',   trinkgeld_quote: 12.8, trend_delta:  1.2, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'd4', fahrer_name: 'Julia F.', trinkgeld_quote: 10.3, trend_delta:  0.5, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'd2', fahrer_name: 'Sara K.',  trinkgeld_quote:  6.4, trend_delta: -1.8, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'd3', fahrer_name: 'Tim B.',   trinkgeld_quote:  2.9, trend_delta: -2.5, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_quote: 8.1,
  alert_count: 1,
};

export function KitchenPhase3892TrinkgeldQuoteTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-trinkgeld-quote?location_id=${locationId}`);
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

  // Descending: highest trinkgeld_quote = Rang 1 = best
  const sorted = [...data.fahrer].sort((a, b) => b.trinkgeld_quote - a.trinkgeld_quote);
  const best = sorted[0];
  const maxVal = Math.max(...sorted.map(f => f.trinkgeld_quote), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      {/* Header mit Bester #1 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Heart className="w-4 h-4 text-pink-500" />
          <span className="text-sm font-semibold text-gray-900">Trinkgeld-Quote</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-pink-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        {best && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500">🥇</span>
            <span className="font-bold text-gray-800">{best.fahrer_name}</span>
            <span className="font-black text-pink-700">{best.trinkgeld_quote}%</span>
          </div>
        )}
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-pink-50 border border-pink-200 rounded-lg text-[11px] text-pink-700">
          <Heart className="w-3 h-3 shrink-0" />
          <span>Niedrige Trinkgeld-Quote!</span>
        </div>
      )}

      {/* Kompakt-Liste (absteigend: höchste = Rang 1 = bester) */}
      <div className="space-y-1.5">
        {sorted.map((f, i) => {
          const tColor = f.ampel === 'gruen' ? 'text-pink-700' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          const barColor = f.ampel === 'gruen' ? 'bg-pink-500' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          // Delta: pos=steigend=gruen (descending metric)
          const DeltaIcon = f.trend_delta > 0
            ? <TrendingUp className="w-3 h-3 text-emerald-500" />
            : f.trend_delta < 0
              ? <TrendingDown className="w-3 h-3 text-red-400" />
              : <Minus className="w-3 h-3 text-gray-300" />;
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-4 text-gray-400 font-mono text-[10px]">#{i + 1}</span>
                <span className="flex-1 text-gray-800 font-medium truncate">{f.fahrer_name}</span>
                <span className={`font-bold ${tColor}`}>{f.trinkgeld_quote}%</span>
                {DeltaIcon}
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden ml-5">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${(f.trinkgeld_quote / maxVal) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-1.5">
        <span>Team-Ø {data.team_avg_quote}%</span>
        <span>Ziel ≥5%</span>
      </div>
    </div>
  );
}
