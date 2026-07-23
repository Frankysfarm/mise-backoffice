'use client';

import { useState, useEffect, useCallback } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  endzeit_min: number;
  endzeit_str: string;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  team_avg_str: string;
  fruehester_name: string;
  spaetester_name: string;
  alert_count: number;
  gesamt: number;
}

const AMPEL_COLOR: Record<string, string> = {
  gruen: 'text-green-600 bg-green-50',
  gelb: 'text-yellow-600 bg-yellow-50',
  rot: 'text-red-600 bg-red-50',
};

const RANK_BADGE: Record<number, string> = {
  1: 'bg-yellow-400 text-white',
  2: 'bg-gray-300 text-white',
  3: 'bg-amber-600 text-white',
};

export function DispatchPhase3547SchichtEndzeitRankingBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const url = locationId
        ? `/api/delivery/admin/fahrer-schicht-endzeit?location_id=${locationId}`
        : '/api/delivery/admin/fahrer-schicht-endzeit';
      const res = await fetch(url);
      if (!res.ok) return;
      setData(await res.json());
    } catch {
      // keep stale
    } finally {
      setLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchData]);

  if (loading) return <div className="rounded-xl border p-4 animate-pulse bg-gray-50 h-40" />;
  if (!data) return null;

  const maxMin = Math.max(...data.fahrer.map(f => f.endzeit_min), 1);
  const minMin = Math.min(...data.fahrer.map(f => f.endzeit_min), maxMin);

  return (
    <div className="rounded-xl border bg-white shadow-sm p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="w-5 h-5 text-orange-500" />
        <h3 className="font-semibold text-gray-800">Schicht-Endzeit-Ranking</h3>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" /> {data.alert_count} Lange Schicht!
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="bg-green-50 rounded-lg p-2 text-center">
          <div className="text-gray-500">Frühester</div>
          <div className="font-bold text-green-700 truncate">{data.fruehester_name}</div>
        </div>
        <div className="bg-blue-50 rounded-lg p-2 text-center">
          <div className="text-gray-500">Team-Ø</div>
          <div className="font-bold text-blue-700">{data.team_avg_str}</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2 text-center">
          <div className="text-gray-500">Spätester</div>
          <div className="font-bold text-red-700 truncate">{data.spaetester_name}</div>
        </div>
      </div>

      <div className="space-y-2">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${RANK_BADGE[f.rang] ?? 'bg-gray-100 text-gray-600'}`}>
              {f.rang}
            </span>
            <span className="text-sm text-gray-700 w-24 truncate flex-shrink-0">{f.fahrer_name}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-2 rounded-full ${f.ampel === 'gruen' ? 'bg-green-400' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-400'}`}
                style={{ width: `${maxMin > minMin ? ((f.endzeit_min - minMin) / (maxMin - minMin)) * 100 : 50}%` }}
              />
            </div>
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${AMPEL_COLOR[f.ampel]}`}>
              {f.endzeit_str}
            </span>
            <span className="text-xs w-8 text-right flex-shrink-0">
              {f.rank_delta === 0 ? (
                <Minus className="w-3 h-3 text-gray-400 inline" />
              ) : f.rank_delta < 0 ? (
                <TrendingUp className="w-3 h-3 text-green-500 inline" />
              ) : (
                <TrendingDown className="w-3 h-3 text-red-500 inline" />
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
