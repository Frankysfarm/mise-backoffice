'use client';

import { useState, useEffect, useCallback } from 'react';
import { Coins, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_tip_eur: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_eur: number;
  bester_name: string;
  alert_count: number;
  ziel_eur: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_tip_eur: 2.80, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_tip_eur: 2.30, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_tip_eur: 1.70, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_tip_eur: 0.90, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_eur: 1.93,
  bester_name: 'Julia F.',
  alert_count: 1,
  ziel_eur: 2.00,
};

export function KitchenPhase3797TrinkgeldQuoteTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-trinkgeld-avg?location_id=${locationId}`);
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

  const best = data.fahrer[0];
  const maxTip = Math.max(...data.fahrer.map(f => f.avg_tip_eur), 0.01);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      {/* Header mit Bester #1 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Coins className="w-4 h-4 text-yellow-500" />
          <span className="text-sm font-semibold text-gray-900">Trinkgeld</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        {best && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500">🥇</span>
            <span className="font-bold text-gray-800">{best.fahrer_name}</span>
            <span className="font-black text-emerald-700">€{best.avg_tip_eur.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-yellow-50 border border-yellow-200 rounded-lg text-[11px] text-yellow-800">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>Niedriges Trinkgeld!</span>
        </div>
      )}

      {/* Kompakt-Liste (absteigend: höchstes Trinkgeld = Rang 1 = bester) */}
      <div className="space-y-1.5">
        {data.fahrer.map(f => {
          const barPct = (f.avg_tip_eur / maxTip) * 100;
          const tColor = f.ampel === 'gruen' ? 'text-emerald-700' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          const barColor = f.ampel === 'gruen' ? 'bg-emerald-500' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-4 text-gray-400 font-mono text-[10px]">#{f.rang}</span>
                <span className="flex-1 text-gray-800 font-medium truncate">{f.fahrer_name}</span>
                <span className={`font-bold ${tColor}`}>€{f.avg_tip_eur.toFixed(2)}</span>
                {f.rank_delta !== 0 && (
                  f.rank_delta > 0
                    ? <TrendingUp className="w-3 h-3 text-emerald-500" />
                    : <TrendingDown className="w-3 h-3 text-red-400" />
                )}
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden ml-5">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barPct}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-1.5">
        <span>Team-Ø €{data.team_avg_eur.toFixed(2)}</span>
        <span>Ziel ≥€{data.ziel_eur.toFixed(2)}</span>
      </div>
    </div>
  );
}
