'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertOctagon, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  verlust_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_verlust_pct: number;
  alert_count: number;
  bester_name?: string;
  ziel_pct: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, verlust_pct:  0.5, rank_delta:  0, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, verlust_pct:  1.2, rank_delta:  1, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, verlust_pct:  2.8, rank_delta: -1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, verlust_pct:  5.5, rank_delta:  0, ampel: 'rot',   alert_top: true  },
  ],
  team_avg_verlust_pct: 2.5,
  alert_count: 1,
  bester_name: 'Julia F.',
  ziel_pct: 1.0,
};

interface Props {
  locationId: string | null;
}

export function KitchenPhase4020PaketverlustTicker({ locationId }: Props) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-paketverlust-ranking?location_id=${locationId}`);
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

  const bester = data.fahrer[0];
  const maxPct = Math.max(...data.fahrer.map(f => f.verlust_pct), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <AlertOctagon className="w-4 h-4 text-red-500" />
        <span className="text-sm font-semibold text-gray-900">
          Paketverlust
          {bester && (
            <span className="ml-1.5 text-emerald-600">
              #{bester.rang} {bester.fahrer_name} {bester.verlust_pct}%
            </span>
          )}
        </span>
        {loading && (
          <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin ml-auto" />
        )}
        {!loading && data.alert_count > 0 && (
          <AlertTriangle className="w-3.5 h-3.5 text-red-500 ml-auto" />
        )}
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="text-xs bg-red-50 border border-red-200 rounded-lg px-2 py-1.5 text-red-700 font-medium">
          Hoher Paketverlust!
        </div>
      )}

      {/* Kompakt-Liste aufsteigend */}
      <div className="space-y-1.5">
        {data.fahrer.map((f) => {
          const barW = maxPct > 0 ? Math.round((f.verlust_pct / maxPct) * 100) : 0;
          const delta = f.rank_delta;
          return (
            <div key={f.fahrer_id} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-4 text-right">{f.rang}</span>
              <span className="text-xs text-gray-700 w-16 truncate">{f.fahrer_name}</span>
              <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full ${
                    f.ampel === 'gruen' ? 'bg-emerald-500' :
                    f.ampel === 'gelb'  ? 'bg-amber-400'  : 'bg-red-500'
                  }`}
                  style={{ width: `${barW}%` }}
                />
              </div>
              <span className={`text-xs font-semibold w-8 text-right ${
                f.ampel === 'gruen' ? 'text-emerald-600' :
                f.ampel === 'gelb'  ? 'text-amber-600'  : 'text-red-600'
              }`}>
                {f.verlust_pct}%
              </span>
              {delta < 0 ? (
                <TrendingUp className="w-3 h-3 text-emerald-500" />
              ) : delta > 0 ? (
                <TrendingDown className="w-3 h-3 text-red-400" />
              ) : (
                <Minus className="w-3 h-3 text-gray-300" />
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-gray-100">
        <span>Team-Avg {data.team_avg_verlust_pct}%</span>
        <span>Ziel ≤{data.ziel_pct}%</span>
      </div>
    </div>
  );
}
