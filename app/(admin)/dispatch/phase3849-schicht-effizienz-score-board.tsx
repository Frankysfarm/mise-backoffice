'use client';

import { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  name: string;
  rang: number;
  score: number;
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
}

interface ApiData {
  fahrer: FahrerRow[];
  team_durchschnitt: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', name: 'Max Müller',   rang: 1, score: 88, trend_delta:  5, ampel: 'gruen' },
    { fahrer_id: 'f2', name: 'Lena Schmidt', rang: 2, score: 72, trend_delta:  1, ampel: 'gelb'  },
    { fahrer_id: 'f3', name: 'Tom Becker',   rang: 3, score: 45, trend_delta: -9, ampel: 'rot'   },
  ],
  team_durchschnitt: 68,
};

export function DispatchPhase3849SchichtEffizienzScoreBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-schicht-effizienz?location_id=${locationId}`);
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

  const sorted = [...data.fahrer].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const alertCount = data.fahrer.filter(f => f.ampel === 'rot').length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-violet-500" />
          <h3 className="text-sm font-bold text-gray-900">Schicht-Effizienz-Score</h3>
          {loading && <span className="w-3 h-3 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />}
        </div>
        <span className="text-xs text-gray-400">Ziel ≥70</span>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Bester</div>
          <div className="text-lg font-black text-emerald-700">{best?.score ?? '—'}</div>
          <div className="text-[10px] text-gray-600 truncate">{best?.name ?? '—'}</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Team-Ø</div>
          <div className="text-lg font-black text-blue-700">{data.team_durchschnitt}</div>
          <div className="text-[10px] text-gray-600">Punkte</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Niedrigster</div>
          <div className="text-lg font-black text-red-600">{worst?.score ?? '—'}</div>
          <div className="text-[10px] text-gray-600 truncate">{worst?.name ?? '—'}</div>
        </div>
      </div>

      {/* Alert */}
      {alertCount > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-red-50 border border-red-200 rounded-lg text-[11px] text-red-700">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{alertCount} Fahrer mit niedrigem Effizienz-Score!</span>
        </div>
      )}

      {/* Rangliste */}
      <div className="space-y-1.5">
        {sorted.map(f => {
          const tColor = f.ampel === 'gruen' ? 'text-emerald-700' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          const barColor = f.ampel === 'gruen' ? 'bg-emerald-500' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-4 text-gray-400 font-mono text-[10px]">#{f.rang}</span>
                <span className="flex-1 text-gray-800 font-medium truncate">{f.name}</span>
                <span className={`font-bold ${tColor}`}>{f.score}</span>
                {f.trend_delta > 0
                  ? <TrendingUp className="w-3 h-3 text-emerald-500" />
                  : f.trend_delta < 0
                    ? <TrendingDown className="w-3 h-3 text-red-400" />
                    : <Minus className="w-3 h-3 text-gray-300" />
                }
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden ml-5">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${f.score}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-[10px] text-gray-400 border-t border-gray-100 pt-1.5 text-right">
        Score 0–100 · Touren/h 40 % · km/Stopp 30 % · Wartezeit 30 %
      </div>
    </div>
  );
}
