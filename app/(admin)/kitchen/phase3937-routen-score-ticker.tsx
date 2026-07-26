'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  routen_score: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  level: 'hoch' | 'mittel' | 'niedrig';
}

interface ApiData {
  fahrer: FahrerRow[];
  team_ø_score: number;
  alert: boolean;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max M.',  routen_score: 88, trend: 'besser',     level: 'hoch'    },
    { fahrer_id: 'f2', fahrer_name: 'Lisa B.', routen_score: 72, trend: 'gleich',     level: 'hoch'    },
    { fahrer_id: 'f3', fahrer_name: 'Tom K.',  routen_score: 51, trend: 'schlechter', level: 'mittel'  },
    { fahrer_id: 'f4', fahrer_name: 'Jan S.',  routen_score: 28, trend: 'gleich',     level: 'niedrig' },
  ],
  team_ø_score: 60,
  alert: false,
};

export function KitchenPhase3937RoutenScoreTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-routen-score?location_id=${locationId}`);
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

  // descending: highest score = Rang 1 = best
  const sorted = [...data.fahrer].sort((a, b) => b.routen_score - a.routen_score);
  const best = sorted[0];
  const alertCount = sorted.filter(f => f.level === 'niedrig').length;
  const maxVal = Math.max(...sorted.map(f => f.routen_score), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      {/* Header mit Bester #1 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-900">Routen-Score</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        {best && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500">🥇</span>
            <span className="font-bold text-gray-800">{best.fahrer_name}</span>
            <span className="font-black text-gray-700">{best.routen_score}</span>
          </div>
        )}
      </div>

      {/* Alert */}
      {(data.alert || alertCount > 0) && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">
          <BarChart2 className="w-3 h-3 shrink-0" />
          <span>Schlechter Routen-Score!</span>
        </div>
      )}

      {/* Kompakt-Liste (absteigend: hoechster Score = Rang 1 = bester) */}
      <div className="space-y-1.5">
        {sorted.map((f, i) => {
          const ampel = f.level === 'hoch' ? 'gruen' : f.level === 'mittel' ? 'gelb' : 'rot';
          const tColor = ampel === 'gruen' ? 'text-emerald-600' : ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          const barColor = ampel === 'gruen' ? 'bg-emerald-400' : ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const DeltaIcon = f.trend === 'besser'
            ? <TrendingUp className="w-3 h-3 text-emerald-500" />
            : f.trend === 'schlechter'
              ? <TrendingDown className="w-3 h-3 text-red-400" />
              : <Minus className="w-3 h-3 text-gray-300" />;
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-4 text-gray-400 font-mono text-[10px]">#{i + 1}</span>
                <span className="flex-1 text-gray-800 font-medium truncate">{f.fahrer_name}</span>
                <span className={`font-bold ${tColor}`}>{f.routen_score}</span>
                {DeltaIcon}
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden ml-5">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${(f.routen_score / maxVal) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-1.5">
        <span>Team-Ø {data.team_ø_score}</span>
        <span>Ziel ≥80</span>
      </div>
    </div>
  );
}
