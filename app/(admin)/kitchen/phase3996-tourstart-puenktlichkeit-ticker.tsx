'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_verzoegerung_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_verspaetet: boolean;
}

interface ApiData {
  fahrer: FahrerRow[];
  team_avg_min: number;
  alert_count: number;
  ziel_min: number;
}

const MOCK: ApiData = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, avg_verzoegerung_min:  0, rank_delta:  1, ampel: 'gruen', alert_verspaetet: false },
    { fahrer_id: 'f2', fahrer_name: 'Sara K.',  rang: 2, avg_verzoegerung_min:  2, rank_delta: -1, ampel: 'gruen', alert_verspaetet: false },
    { fahrer_id: 'f3', fahrer_name: 'Max M.',   rang: 3, avg_verzoegerung_min:  5, rank_delta:  0, ampel: 'gelb',  alert_verspaetet: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, avg_verzoegerung_min: 12, rank_delta:  0, ampel: 'rot',   alert_verspaetet: true  },
  ],
  team_avg_min: 4.75,
  alert_count: 1,
  ziel_min: 0,
};

export function KitchenPhase3996TourstartPuenktlichkeitTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiData>(MOCK);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-tourstart-puenktlichkeit?location_id=${locationId}`);
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

  const sorted = [...data.fahrer].sort((a, b) => a.rang - b.rang);
  const best = sorted[0];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-blue-500" />
          <span className="text-xs font-semibold text-gray-800">Tourstart-Pünktlichkeit</span>
          {loading && <span className="w-2.5 h-2.5 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" />}
        </div>
        {best && (
          <span className="text-[11px] font-bold text-emerald-700">
            #1 {best.fahrer_name} · +{best.avg_verzoegerung_min}min
          </span>
        )}
      </div>

      {/* Alert */}
      {data.alert_count > 0 && (
        <div className="flex items-center gap-1 px-2 py-1 bg-red-50 border border-red-200 rounded-lg text-[10px] text-red-700">
          <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
          <span>Verspäteter Tourstart!</span>
        </div>
      )}

      {/* Kompakt-Liste */}
      <div className="space-y-1">
        {sorted.map((f) => {
          const tColor = f.ampel === 'gruen' ? 'text-emerald-600' : f.ampel === 'gelb' ? 'text-yellow-600' : 'text-red-500';
          // rank_delta > 0 = verbessert (Rang kleiner geworden bei aufsteigend)
          const DeltaIcon = f.rank_delta > 0
            ? <TrendingUp className="w-3 h-3 text-emerald-500" />
            : f.rank_delta < 0
              ? <TrendingDown className="w-3 h-3 text-red-400" />
              : <Minus className="w-3 h-3 text-gray-300" />;
          return (
            <div key={f.fahrer_id} className="flex items-center gap-1.5">
              <span className="w-4 text-[10px] font-mono text-gray-400 text-center">#{f.rang}</span>
              <span className="flex-1 text-[11px] text-gray-700 truncate">{f.fahrer_name}</span>
              <span className={`text-[11px] font-bold ${tColor}`}>+{f.avg_verzoegerung_min}min</span>
              {DeltaIcon}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-[10px] text-gray-400 pt-1 border-t border-gray-100">
        <span>Team-Ø +{data.team_avg_min}min</span>
        <span>Ziel {data.ziel_min}min</span>
      </div>
    </div>
  );
}
