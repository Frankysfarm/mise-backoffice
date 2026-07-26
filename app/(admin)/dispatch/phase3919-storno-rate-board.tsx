'use client';

import { useState, useEffect, useCallback } from 'react';
import { XCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  storno_rate_pct: number;
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_storno_rate_pct: number;
  alert_count: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f4', fahrer_name: 'Tom B.',    storno_rate_pct:  2.1, trend_delta: -0.9, ampel: 'gruen', alert: false },
    { fahrer_id: 'f1', fahrer_name: 'Max M.',    storno_rate_pct:  3.2, trend_delta: -0.8, ampel: 'gruen', alert: false },
    { fahrer_id: 'f3', fahrer_name: 'Lena S.',   storno_rate_pct:  8.7, trend_delta:  1.2, ampel: 'gelb',  alert: false },
    { fahrer_id: 'f2', fahrer_name: 'Sarah K.',  storno_rate_pct: 18.5, trend_delta:  6.5, ampel: 'rot',   alert: true  },
    { fahrer_id: 'f5', fahrer_name: 'Jana F.',   storno_rate_pct: 21.4, trend_delta:  3.4, ampel: 'rot',   alert: true  },
  ],
  team_avg_storno_rate_pct: 10.8,
  alert_count: 2,
};

export function DispatchPhase3919StornoRateBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-storno-rate?location_id=${locationId}`);
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

  const sorted = [...data.fahrer].sort((a, b) => a.storno_rate_pct - b.storno_rate_pct);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <XCircle className="w-5 h-5 text-red-400" />
          <h3 className="font-semibold text-gray-900 text-sm">Storno-Rate-Ranking</h3>
          {loading && <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin ml-1" />}
        </div>
        <span className="text-xs text-gray-400">Ziel ≤5%</span>
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <XCircle className="w-3.5 h-3.5 shrink-0" />
          <span>Hohe Storno-Rate! ({data.alert_count} Fahrer)</span>
        </div>
      )}

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-[10px] text-gray-400 mb-0.5">Bester</div>
          <div className="text-sm font-bold text-gray-800 truncate">{best?.fahrer_name ?? '–'}</div>
          <div className="text-xs font-semibold text-emerald-600">{best?.storno_rate_pct ?? 0}%</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-[10px] text-gray-400 mb-0.5">Team-Ø</div>
          <div className="text-sm font-bold text-gray-800">{data.team_avg_storno_rate_pct}%</div>
          <div className="text-[10px] text-gray-400">Schnitt</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-[10px] text-gray-400 mb-0.5">Hoechster</div>
          <div className="text-sm font-bold text-gray-800 truncate">{worst?.fahrer_name ?? '–'}</div>
          <div className="text-xs font-semibold text-red-500">{worst?.storno_rate_pct ?? 0}%</div>
        </div>
      </div>

      {/* Fahrer-Liste */}
      <div className="space-y-1.5">
        {sorted.map((f, i) => {
          const tColor = f.ampel === 'gruen' ? 'text-gray-700' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          const barColor = f.ampel === 'gruen' ? 'bg-emerald-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const maxVal = Math.max(...sorted.map(r => r.storno_rate_pct), 1);
          const DeltaIcon = f.trend_delta < 0
            ? <TrendingUp className="w-3 h-3 text-emerald-500" />
            : f.trend_delta > 0
              ? <TrendingDown className="w-3 h-3 text-red-400" />
              : <Minus className="w-3 h-3 text-gray-300" />;
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-5 text-gray-400 font-mono text-[10px]">#{i + 1}</span>
                <span className="flex-1 text-gray-800 font-medium truncate">{f.fahrer_name}</span>
                <span className={`font-bold ${tColor}`}>{f.storno_rate_pct}%</span>
                {DeltaIcon}
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden ml-6">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${(f.storno_rate_pct / maxVal) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-2">
        <span>Team-Ø {data.team_avg_storno_rate_pct}%</span>
        <span>Ziel ≤5%</span>
      </div>
    </div>
  );
}
