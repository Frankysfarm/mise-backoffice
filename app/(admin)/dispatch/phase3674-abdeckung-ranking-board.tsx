'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  zonen_anzahl: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
  alert_low: boolean;
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
  gelb: 'text-orange-500',
  rot: 'text-red-600',
};

const AMPEL_BG: Record<string, string> = {
  gruen: 'bg-emerald-50 border-emerald-200',
  gelb: 'bg-orange-50 border-orange-200',
  rot: 'bg-red-50 border-red-200',
};

const RANK_BADGE: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function DispatchPhase3674AbdeckungRankingBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-abdeckung?location_id=${locationId}`);
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

  const sorted = [...data.fahrer].sort((a, b) => b.zonen_anzahl - a.zonen_anzahl);
  const maxZonen = sorted[0]?.zonen_anzahl ?? 1;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-500" />
          <span className="font-semibold text-gray-900">Liefergebiet-Abdeckung Ranking</span>
        </div>
        {data.alert_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" /> Geringe Abdeckung!
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-blue-50 rounded-lg p-2">
          <div className="text-xs text-gray-500">Bester</div>
          <div className="font-semibold text-blue-700 text-sm truncate">{data.bester_name}</div>
          <div className="text-xs text-blue-600">{sorted[0]?.zonen_anzahl} Zonen</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-xs text-gray-500">Team-Ø</div>
          <div className="font-semibold text-gray-700 text-sm">{data.team_avg.toFixed(1)}</div>
          <div className="text-xs text-gray-500">Zonen</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-2">
          <div className="text-xs text-gray-500">Geringste</div>
          <div className="font-semibold text-orange-700 text-sm truncate">{data.letzter_name}</div>
          <div className="text-xs text-orange-600">{sorted[sorted.length - 1]?.zonen_anzahl} Zonen</div>
        </div>
      </div>

      <div className="space-y-2">
        {sorted.map((f) => (
          <div key={f.fahrer_id} className={`flex items-center gap-3 p-2 rounded-lg border ${AMPEL_BG[f.ampel]}`}>
            <span className="text-base w-6 text-center">{RANK_BADGE[f.rang] ?? `#${f.rang}`}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900 text-sm truncate">{f.fahrer_name}</span>
                <span className={`font-bold text-sm ${AMPEL_COLOR[f.ampel]}`}>{f.zonen_anzahl} Zonen</span>
              </div>
              <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${f.ampel === 'gruen' ? 'bg-emerald-500' : f.ampel === 'gelb' ? 'bg-orange-400' : 'bg-red-500'}`}
                  style={{ width: `${Math.round((f.zonen_anzahl / maxZonen) * 100)}%` }}
                />
              </div>
            </div>
            <div className="flex items-center gap-0.5 text-xs w-8 justify-end">
              {f.rank_delta > 0 ? (
                <><TrendingUp className="w-3 h-3 text-emerald-500" /><span className="text-emerald-600">+{f.rank_delta}</span></>
              ) : f.rank_delta < 0 ? (
                <><TrendingDown className="w-3 h-3 text-red-500" /><span className="text-red-600">{f.rank_delta}</span></>
              ) : (
                <Minus className="w-3 h-3 text-gray-400" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
