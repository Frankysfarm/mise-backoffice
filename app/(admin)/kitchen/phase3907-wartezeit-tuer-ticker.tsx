'use client';

import { useState, useEffect, useCallback } from 'react';
import { DoorOpen, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  avg_wartezeit_min: number;
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_wartezeit_min: number;
  alert_count: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f4', fahrer_name: 'Tom B.',   avg_wartezeit_min:  3.1, trend_delta: -1.1, ampel: 'gruen', alert: false },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',   avg_wartezeit_min:  4.2, trend_delta: -0.9, ampel: 'gruen', alert: false },
    { fahrer_id: 'f3', fahrer_name: 'Lena S.',  avg_wartezeit_min:  6.5, trend_delta:  0.5, ampel: 'gelb',  alert: false },
    { fahrer_id: 'f5', fahrer_name: 'Anna B.',  avg_wartezeit_min: 11.3, trend_delta:  0.5, ampel: 'rot',   alert: true  },
    { fahrer_id: 'f2', fahrer_name: 'Sarah K.', avg_wartezeit_min: 12.8, trend_delta:  3.3, ampel: 'rot',   alert: true  },
  ],
  team_avg_wartezeit_min: 7.6,
  alert_count: 2,
};

export function KitchenPhase3907WartezeitTuerTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-wartezeit?location_id=${locationId}`);
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

  // ascending: lowest wait = Rang 1 = best
  const sorted = [...data.fahrer].sort((a, b) => a.avg_wartezeit_min - b.avg_wartezeit_min);
  const best = sorted[0];
  const maxVal = Math.max(...sorted.map(f => f.avg_wartezeit_min), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      {/* Header mit Bester #1 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DoorOpen className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-900">Wartezeit</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        {best && (
          <div className="flex items-center gap-1 text-xs">
            <span className="text-gray-500">🥇</span>
            <span className="font-bold text-gray-800">{best.fahrer_name}</span>
            <span className="font-black text-gray-700">{best.avg_wartezeit_min} min</span>
          </div>
        )}
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">
          <DoorOpen className="w-3 h-3 shrink-0" />
          <span>Lange Wartezeiten!</span>
        </div>
      )}

      {/* Kompakt-Liste (aufsteigend: niedrigste = Rang 1 = bester) */}
      <div className="space-y-1.5">
        {sorted.map((f, i) => {
          const tColor = f.ampel === 'gruen' ? 'text-gray-700' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          const barColor = f.ampel === 'gruen' ? 'bg-gray-500' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          // ascending: neg trend_delta = improved = gruen
          const DeltaIcon = f.trend_delta < 0
            ? <TrendingUp className="w-3 h-3 text-emerald-500" />
            : f.trend_delta > 0
              ? <TrendingDown className="w-3 h-3 text-red-400" />
              : <Minus className="w-3 h-3 text-gray-300" />;
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-4 text-gray-400 font-mono text-[10px]">#{i + 1}</span>
                <span className="flex-1 text-gray-800 font-medium truncate">{f.fahrer_name}</span>
                <span className={`font-bold ${tColor}`}>{f.avg_wartezeit_min} min</span>
                {DeltaIcon}
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden ml-5">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${(f.avg_wartezeit_min / maxVal) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-1.5">
        <span>Team-Ø {data.team_avg_wartezeit_min} min</span>
        <span>Ziel ≤5 min</span>
      </div>
    </div>
  );
}
