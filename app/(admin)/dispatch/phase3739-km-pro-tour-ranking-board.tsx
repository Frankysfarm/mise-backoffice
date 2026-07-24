'use client';

import { useState, useEffect, useCallback } from 'react';
import { Map, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  km_avg: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
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

const RANK_BADGE: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function DispatchPhase3739KmProTourRankingBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-km-pro-tour-ranking-v2?location_id=${locationId}`);
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
  if (!data || !locationId) return null;

  // aufsteigend: Rang 1 = wenigste km = bester
  const sorted = [...data.fahrer].sort((a, b) => a.km_avg - b.km_avg);
  const minVal = sorted[0]?.km_avg ?? 1;
  const maxVal = sorted[sorted.length - 1]?.km_avg ?? 1;
  const bester = sorted[0];
  const letzter = sorted[sorted.length - 1];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Map className="w-5 h-5 text-blue-500" />
        <h3 className="font-semibold text-gray-900">Km pro Tour — Ranking</h3>
      </div>

      {data.alert_count > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle className="w-4 h-4" />
          <span>{data.alert_count} Fahrer mit hohen km pro Tour!</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-emerald-50 rounded-lg p-2">
          <div className="font-bold text-emerald-700">{bester?.km_avg} km</div>
          <div className="text-gray-500">Effizientester</div>
          <div className="text-gray-700 truncate">{bester?.fahrer_name ?? '–'}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="font-bold text-gray-700">{data.team_avg} km</div>
          <div className="text-gray-500">Team-Ø</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2">
          <div className="font-bold text-red-700">{letzter?.km_avg} km</div>
          <div className="text-gray-500">Höchste km</div>
          <div className="text-gray-700 truncate">{letzter?.fahrer_name ?? '–'}</div>
        </div>
      </div>

      <div className="space-y-2">
        {sorted.map((f, i) => {
          const barPct = maxVal > minVal
            ? Math.max(((maxVal - f.km_avg) / (maxVal - minVal)) * 100, 4)
            : 100;
          return (
            <div key={f.fahrer_id} className={`flex items-center gap-2 p-2 rounded-lg border ${AMPEL_BG[f.ampel]}`}>
              <span className="text-xs font-bold text-gray-500 w-6">{RANK_BADGE[i + 1] ?? `#${i + 1}`}</span>
              <span className="flex-1 text-sm font-medium text-gray-900 truncate">{f.fahrer_name}</span>
              <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full ${f.ampel === 'gruen' ? 'bg-emerald-500' : f.ampel === 'gelb' ? 'bg-yellow-500' : 'bg-red-500'}`}
                  style={{ width: `${barPct}%` }}
                />
              </div>
              <span className={`text-xs font-bold w-12 text-right ${AMPEL_COLOR[f.ampel]}`}>{f.km_avg} km</span>
              {f.rank_delta < 0 ? (
                <TrendingUp className="w-3 h-3 text-emerald-600" />
              ) : f.rank_delta > 0 ? (
                <TrendingDown className="w-3 h-3 text-red-500" />
              ) : (
                <Minus className="w-3 h-3 text-gray-400" />
              )}
              {f.alert_top && <AlertTriangle className="w-3 h-3 text-red-500" />}
            </div>
          );
        })}
      </div>

      <div className="text-xs text-gray-400 text-center">Ziel ≤5 km/Tour · Letzte 30 Tage</div>
    </div>
  );
}
