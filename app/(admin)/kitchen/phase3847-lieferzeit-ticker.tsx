'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_lang: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_min: number;
  bester_name: string;
  alert_count: number;
  ziel_min: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_min: 18, rank_delta: -1, ampel: 'gruen', alert_lang: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_min: 22, rank_delta:  0, ampel: 'gruen', alert_lang: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_min: 28, rank_delta:  1, ampel: 'gelb',  alert_lang: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_min: 36, rank_delta:  0, ampel: 'rot',   alert_lang: true  },
  ],
  team_avg_min: 26,
  bester_name: 'Julia F.',
  alert_count: 1,
  ziel_min: 25,
};

export function KitchenPhase3847LieferzeitTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-lieferzeit-durchschnitt?location_id=${locationId}`);
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
  const maxMin = Math.max(...data.fahrer.map(f => f.avg_min), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      {/* Header mit Bester #1 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-900">Ø Lieferzeit</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        {best && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500">🥇</span>
            <span className="font-bold text-gray-800">{best.fahrer_name}</span>
            <span className="font-black text-emerald-700">{best.avg_min} min</span>
          </div>
        )}
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 text-[10px] text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          <span>Lange Lieferzeiten! ({data.alert_count} Fahrer)</span>
        </div>
      )}

      {/* Kompakte Liste aufsteigend */}
      <div className="space-y-1">
        {data.fahrer.map(f => {
          const barPct = Math.round((f.avg_min / maxMin) * 100);
          const textColor =
            f.ampel === 'gruen' ? 'text-emerald-700' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          const barColor =
            f.ampel === 'gruen' ? 'bg-emerald-500' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          return (
            <div key={f.fahrer_id} className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400 w-4 text-right">#{f.rang}</span>
              <span className="text-xs text-gray-700 w-16 truncate">{f.fahrer_name}</span>
              <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${barPct}%` }} />
              </div>
              <span className={`text-xs font-bold ${textColor} w-10 text-right`}>{f.avg_min} min</span>
              {f.rank_delta !== 0 && (
                f.rank_delta < 0
                  ? <TrendingUp className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                  : <TrendingDown className="w-3 h-3 text-red-400 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Team-Avg + Ziel */}
      <div className="flex justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100">
        <span>Team-Ø {data.team_avg_min} min</span>
        <span>Ziel ≤{data.ziel_min} min</span>
      </div>
    </div>
  );
}
