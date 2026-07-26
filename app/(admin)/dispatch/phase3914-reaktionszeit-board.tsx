'use client';

import { useState, useEffect, useCallback } from 'react';
import { Timer, TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  name: string;
  avg_reaktionszeit_min: number;
  rang: number;
  trend: 'besser' | 'gleich' | 'schlechter';
  status: 'schnell' | 'normal' | 'langsam';
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_min: number;
  sla_ziel_min: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', name: 'Max M.',  avg_reaktionszeit_min: 2.4, rang: 1, trend: 'besser',     status: 'schnell' },
    { fahrer_id: 'f2', name: 'Anna S.', avg_reaktionszeit_min: 4.7, rang: 2, trend: 'gleich',     status: 'normal'  },
    { fahrer_id: 'f3', name: 'Tom B.',  avg_reaktionszeit_min: 7.2, rang: 3, trend: 'schlechter', status: 'langsam' },
  ],
  team_avg_min: 4.8,
  sla_ziel_min: 5,
};

export function DispatchPhase3914RaktionszeitBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-reaktionszeit-statistik?location_id=${locationId}`);
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

  const sorted = [...data.fahrer].sort((a, b) => a.avg_reaktionszeit_min - b.avg_reaktionszeit_min);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const alertCount = sorted.filter(f => f.status === 'langsam').length;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Timer className="w-5 h-5 text-gray-500" />
          <h3 className="font-semibold text-gray-900 text-sm">Reaktionszeit-Ranking</h3>
          {loading && <span className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin ml-1" />}
        </div>
        <span className="text-xs text-gray-400">Ziel ≤{data.sla_ziel_min} min</span>
      </div>

      {/* Alert */}
      {alertCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <Timer className="w-3.5 h-3.5 shrink-0" />
          <span>Lange Reaktionszeiten! ({alertCount} Fahrer)</span>
        </div>
      )}

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-[10px] text-gray-400 mb-0.5">Schnellste</div>
          <div className="text-sm font-bold text-gray-800 truncate">{best?.name ?? '–'}</div>
          <div className="text-xs font-semibold text-emerald-600">{best?.avg_reaktionszeit_min ?? 0} min</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-[10px] text-gray-400 mb-0.5">Team-Ø</div>
          <div className="text-sm font-bold text-gray-800">{data.team_avg_min} min</div>
          <div className="text-[10px] text-gray-400">Schnitt</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-[10px] text-gray-400 mb-0.5">Langsamste</div>
          <div className="text-sm font-bold text-gray-800 truncate">{worst?.name ?? '–'}</div>
          <div className="text-xs font-semibold text-red-500">{worst?.avg_reaktionszeit_min ?? 0} min</div>
        </div>
      </div>

      {/* Fahrer-Liste */}
      <div className="space-y-1.5">
        {sorted.map((f, i) => {
          const tColor = f.status === 'schnell' ? 'text-gray-700' : f.status === 'normal' ? 'text-yellow-600' : 'text-red-500';
          const barColor = f.status === 'schnell' ? 'bg-emerald-400' : f.status === 'normal' ? 'bg-yellow-400' : 'bg-red-400';
          const maxVal = Math.max(...sorted.map(r => r.avg_reaktionszeit_min), 1);
          const DeltaIcon = f.trend === 'besser'
            ? <TrendingUp className="w-3 h-3 text-emerald-500" />
            : f.trend === 'schlechter'
              ? <TrendingDown className="w-3 h-3 text-red-400" />
              : <Minus className="w-3 h-3 text-gray-300" />;
          return (
            <div key={f.fahrer_id} className="space-y-0.5">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="w-5 text-gray-400 font-mono text-[10px]">#{i + 1}</span>
                <span className="flex-1 text-gray-800 font-medium truncate">{f.name}</span>
                <span className={`font-bold ${tColor}`}>{f.avg_reaktionszeit_min} min</span>
                {DeltaIcon}
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden ml-6">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${(f.avg_reaktionszeit_min / maxVal) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-100 pt-2">
        <span>Team-Ø {data.team_avg_min} min</span>
        <span>Ziel ≤{data.sla_ziel_min} min</span>
      </div>
    </div>
  );
}
