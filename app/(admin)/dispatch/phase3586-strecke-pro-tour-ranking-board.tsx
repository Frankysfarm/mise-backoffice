'use client';

import { useState, useEffect, useCallback } from 'react';
import { Map, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerStreckeProTour {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  strecke_pro_tour: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiResponse {
  fahrer: FahrerStreckeProTour[];
  team_avg: number;
  effizientester_name: string;
  laengster_name: string;
  alert_count: number;
  gesamt: number;
}

const AMPEL_COLOR: Record<string, string> = {
  gruen: 'text-emerald-600',
  gelb: 'text-yellow-600',
  rot: 'text-red-600',
};

const AMPEL_BG: Record<string, string> = {
  gruen: 'bg-emerald-50 border-emerald-200',
  gelb: 'bg-yellow-50 border-yellow-200',
  rot: 'bg-red-50 border-red-200',
};

export function DispatchPhase3586StreckeProTourRankingBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const url = locationId
        ? `/api/delivery/admin/fahrer-strecke-pro-tour?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-strecke-pro-tour';
      const res = await fetch(url);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (loading) return <div className="animate-pulse h-48 bg-gray-100 rounded-xl" />;
  if (!data) return null;

  const maxVal = Math.max(...data.fahrer.map(f => f.strecke_pro_tour), 1);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Map className="w-5 h-5 text-green-600" />
        <h3 className="font-semibold text-gray-900">Strecke pro Tour — Ranking</h3>
      </div>

      {data.alert_count > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4" />
          <span>{data.alert_count} Fahrer mit hoher Strecke/Tour!</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-emerald-50 rounded-lg p-2">
          <div className="font-bold text-emerald-700">{data.fahrer[0]?.strecke_pro_tour ?? '–'} km</div>
          <div className="text-gray-500">Effizientester</div>
          <div className="text-gray-700 truncate">{data.effizientester_name}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="font-bold text-gray-700">{data.team_avg} km</div>
          <div className="text-gray-500">Team-Ø</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2">
          <div className="font-bold text-red-700">{data.fahrer[data.fahrer.length - 1]?.strecke_pro_tour ?? '–'} km</div>
          <div className="text-gray-500">Längster</div>
          <div className="text-gray-700 truncate">{data.laengster_name}</div>
        </div>
      </div>

      <div className="space-y-2">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className={`flex items-center gap-2 p-2 rounded-lg border ${AMPEL_BG[f.ampel]}`}>
            <span className="text-xs font-bold text-gray-500 w-5">#{f.rang}</span>
            <span className="flex-1 text-sm font-medium text-gray-900 truncate">{f.fahrer_name}</span>
            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-2 rounded-full ${f.ampel === 'gruen' ? 'bg-emerald-500' : f.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${(f.strecke_pro_tour / maxVal) * 100}%` }}
              />
            </div>
            <span className={`text-xs font-bold w-14 text-right ${AMPEL_COLOR[f.ampel]}`}>{f.strecke_pro_tour} km</span>
            {f.rank_delta < 0 ? (
              <TrendingUp className="w-3 h-3 text-emerald-600" />
            ) : f.rank_delta > 0 ? (
              <TrendingDown className="w-3 h-3 text-red-500" />
            ) : (
              <Minus className="w-3 h-3 text-gray-400" />
            )}
            {f.alert_top && <AlertTriangle className="w-3 h-3 text-red-500" />}
          </div>
        ))}
      </div>
    </div>
  );
}
