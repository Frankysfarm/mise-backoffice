'use client';

import { useState, useEffect, useCallback } from 'react';
import { Gauge, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_kmh: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_langsam: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_kmh: number;
  schnellster_name: string;
  langsamster_name: string;
  alert_count: number;
  ziel_kmh: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_kmh: 28, rank_delta:  1, ampel: 'gruen', alert_langsam: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_kmh: 25, rank_delta:  0, ampel: 'gruen', alert_langsam: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_kmh: 21, rank_delta: -1, ampel: 'gelb',  alert_langsam: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_kmh: 16, rank_delta:  0, ampel: 'rot',   alert_langsam: true  },
  ],
  team_avg_kmh: 22,
  schnellster_name: 'Julia F.',
  langsamster_name: 'Tim B.',
  alert_count: 1,
  ziel_kmh: 25,
};

interface Props {
  locationId: string | null;
}

export function DispatchPhase4027GeschwindigkeitBoard({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-geschwindigkeit-ranking?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
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

  const schnellster = data.fahrer[0];
  const langsamster = data.fahrer[data.fahrer.length - 1];
  const maxKmh = Math.max(...data.fahrer.map(f => f.avg_kmh), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-900">Geschwindigkeit-Ranking</span>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="w-3 h-3 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
          {!loading && data.alert_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-red-600 font-semibold">
              <AlertTriangle className="w-3.5 h-3.5" /> {data.alert_count} Niedrige Geschwindigkeit!
            </span>
          )}
        </div>
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-emerald-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-emerald-600 font-medium">Schnellste</div>
          <div className="text-xs font-bold text-emerald-700 truncate">{data.schnellster_name ?? schnellster?.fahrer_name ?? '–'}</div>
          <div className="text-[10px] text-emerald-500">{schnellster?.avg_kmh ?? 0} km/h</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500 font-medium">Team-Ø</div>
          <div className="text-sm font-bold text-gray-700">{data.team_avg_kmh} km/h</div>
          <div className="text-[10px] text-gray-400">Geschwindigkeit</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2 text-center">
          <div className="text-[10px] text-red-500 font-medium">Langsamste</div>
          <div className="text-xs font-bold text-red-700 truncate">{data.langsamster_name ?? langsamster?.fahrer_name ?? '–'}</div>
          <div className="text-[10px] text-red-400">{langsamster?.avg_kmh ?? 0} km/h</div>
        </div>
      </div>

      {/* Ranking-Liste */}
      <div className="space-y-2">
        {data.fahrer.map((f) => {
          const tColor = f.ampel === 'gruen' ? 'text-emerald-600' : f.ampel === 'gelb' ? 'text-yellow-500' : 'text-red-500';
          const barColor = f.ampel === 'gruen' ? 'bg-emerald-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400';
          const DeltaIcon = f.rank_delta < 0
            ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            : f.rank_delta > 0
              ? <TrendingDown className="w-3.5 h-3.5 text-red-400" />
              : <Minus className="w-3.5 h-3.5 text-gray-300" />;
          return (
            <div key={f.fahrer_id} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-4 text-right">#{f.rang}</span>
              <span className="text-xs text-gray-700 w-20 truncate">{f.fahrer_name}</span>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${(f.avg_kmh / maxKmh) * 100}%` }} />
              </div>
              <span className={`text-xs font-bold w-14 text-right ${tColor}`}>{f.avg_kmh} km/h</span>
              {DeltaIcon}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex justify-between text-[11px] text-gray-400 px-1">
        <span>Team-Ø {data.team_avg_kmh} km/h</span>
        <span>Ziel ≥{data.ziel_kmh ?? 25} km/h</span>
      </div>
    </div>
  );
}
