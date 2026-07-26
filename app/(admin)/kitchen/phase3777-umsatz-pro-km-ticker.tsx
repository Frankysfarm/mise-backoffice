'use client';

import { useState, useEffect, useCallback } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  umsatz_pro_km: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_umsatz_pro_km: number;
  bester_name: string;
  alert_count: number;
  ziel_umsatz_pro_km: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, umsatz_pro_km: 3.20, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, umsatz_pro_km: 2.85, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, umsatz_pro_km: 2.40, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, umsatz_pro_km: 1.90, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_umsatz_pro_km: 2.59,
  bester_name: 'Julia F.',
  alert_count: 1,
  ziel_umsatz_pro_km: 2.50,
};

export function KitchenPhase3777UmsatzProKmTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-umsatz-pro-km?location_id=${locationId}`);
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

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      {/* Header mit Bester #1 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          <span className="text-sm font-semibold text-gray-900">Umsatz/km</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        {best && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500">🥇</span>
            <span className="font-bold text-gray-800">{best.fahrer_name}</span>
            <span className="font-black text-emerald-600">€{best.umsatz_pro_km.toFixed(2)}</span>
          </div>
        )}
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>Niedriger Umsatz/km!</span>
        </div>
      )}

      {/* Kompakt-Liste (absteigend: höchster Wert = bester = Rang 1) */}
      <div className="space-y-1.5">
        {data.fahrer.map(f => {
          const maxUpk = 5;
          const barPct = Math.min((f.umsatz_pro_km / maxUpk) * 100, 100);
          const tColor = f.ampel === 'gruen' ? 'text-emerald-600' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-600';
          const barColor = f.ampel === 'gruen' ? 'bg-emerald-500' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-500';
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-4 text-gray-400 font-mono text-[10px]">#{f.rang}</span>
                <span className="flex-1 text-gray-800 font-medium truncate">{f.fahrer_name}</span>
                <span className={`font-bold ${tColor}`}>€{f.umsatz_pro_km.toFixed(2)}</span>
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
        <span>Team-Ø €{data.team_avg_umsatz_pro_km.toFixed(2)}/km</span>
        <span>Ziel ≥€{data.ziel_umsatz_pro_km.toFixed(2)}/km</span>
      </div>
    </div>
  );
}
