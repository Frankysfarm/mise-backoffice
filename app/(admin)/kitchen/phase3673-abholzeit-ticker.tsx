'use client';

import { useState, useEffect, useCallback } from 'react';
import { Package, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  avg_abholzeit_min: number;
  rang: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  alert_count: number;
}

const MOCK: ApiResponse = {
  team_avg: 3.4,
  bester_name: 'Thomas W.',
  alert_count: 1,
  fahrer: [
    { fahrer_id: '1', fahrer_name: 'Thomas W.', avg_abholzeit_min: 1.8, rang: 1, rank_delta: 0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: '2', fahrer_name: 'Mia S.', avg_abholzeit_min: 2.9, rang: 2, rank_delta: 1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: '3', fahrer_name: 'Jan K.', avg_abholzeit_min: 4.1, rang: 3, rank_delta: -1, ampel: 'gelb', alert_hoch: false },
    { fahrer_id: '4', fahrer_name: 'Sara B.', avg_abholzeit_min: 6.8, rang: 4, rank_delta: 0, ampel: 'rot', alert_hoch: true },
  ],
};

const AMPEL_COLOR: Record<string, string> = {
  gruen: 'text-emerald-600',
  gelb: 'text-orange-500',
  rot: 'text-red-600',
};

export function KitchenPhase3673AbholzeitTicker({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-wartezeit?location_id=${locationId}`);
      if (res.ok) {
        const json = await res.json();
        if (json?.fahrer?.length) setData(json);
      }
    } catch {}
    finally { setLoading(false); }
  }, [locationId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  if (loading) return <div className="animate-pulse h-32 bg-gray-100 rounded-xl" />;

  const sorted = [...data.fahrer].sort((a, b) => a.avg_abholzeit_min - b.avg_abholzeit_min);
  const bester = sorted[0];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Package className="w-4 h-4 text-blue-500" />
        <span className="font-semibold text-gray-900 text-sm">Abholzeit/Stopp</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-600">
            <AlertTriangle className="w-3 h-3" /> {data.alert_count}
          </span>
        )}
      </div>

      {bester && (
        <div className="bg-blue-50 rounded-lg px-3 py-2 flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-500">Schnellster #1</span>
            <div className="font-semibold text-gray-900 text-sm">{bester.fahrer_name}</div>
          </div>
          <span className="text-lg font-black text-blue-600">{bester.avg_abholzeit_min.toFixed(1)}min</span>
        </div>
      )}

      <div className="space-y-1">
        {sorted.map((f) => {
          const DeltaIcon = f.rank_delta < 0 ? TrendingUp : f.rank_delta > 0 ? TrendingDown : Minus;
          const deltaColor = f.rank_delta < 0 ? 'text-emerald-500' : f.rank_delta > 0 ? 'text-red-500' : 'text-gray-400';
          return (
            <div key={f.fahrer_id} className="flex items-center gap-2 text-xs">
              <span className="text-gray-400 w-5">#{f.rang}</span>
              <span className="flex-1 truncate text-gray-700">{f.fahrer_name}</span>
              <span className={`font-semibold ${AMPEL_COLOR[f.ampel]}`}>{f.avg_abholzeit_min.toFixed(1)}min</span>
              <DeltaIcon className={`w-3 h-3 ${deltaColor}`} />
              {f.rank_delta !== 0 && (
                <span className={`${deltaColor} w-6`}>
                  {f.rank_delta > 0 ? `+${f.rank_delta}` : f.rank_delta}
                </span>
              )}
              {f.alert_hoch && <AlertTriangle className="w-3 h-3 text-red-500" />}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between text-xs text-gray-400 border-t pt-2">
        <span>Team-Ø: {data.team_avg.toFixed(1)}min</span>
        <span>Ziel ≤3min/Stopp</span>
      </div>
    </div>
  );
}
