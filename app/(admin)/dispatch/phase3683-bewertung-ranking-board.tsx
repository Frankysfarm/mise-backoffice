'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  avg_sterne: number;
  trend: 'steigend' | 'fallend' | 'stabil';
  trend_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_sterne: number;
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

export function DispatchPhase3683BewertungRankingBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!locationId) { setLoading(false); return; }
    try {
      const res = await fetch(`/api/delivery/admin/fahrer-bewertung?location_id=${locationId}`);
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

  const sorted = [...data.fahrer].sort((a, b) => b.avg_sterne - a.avg_sterne);
  const bester = sorted[0];
  const niedrigster = sorted[sorted.length - 1];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Star className="w-5 h-5 text-yellow-500" />
          <span className="font-semibold text-gray-900">Kundenbewertung Ranking</span>
        </div>
        {data.alert_count > 0 && (
          <span className="flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" /> Niedrige Bewertung!
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-yellow-50 rounded-lg p-2">
          <div className="text-xs text-gray-500">Bester</div>
          <div className="font-semibold text-yellow-700 text-sm truncate">{bester?.fahrer_name ?? '–'}</div>
          <div className="text-xs text-yellow-600">★ {bester?.avg_sterne.toFixed(1) ?? '–'}</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-xs text-gray-500">Team-Ø</div>
          <div className="font-semibold text-gray-700 text-sm">★ {data.team_avg_sterne.toFixed(1)}</div>
          <div className="text-xs text-gray-500">Sterne</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2">
          <div className="text-xs text-gray-500">Schlechtester</div>
          <div className="font-semibold text-red-700 text-sm truncate">{niedrigster?.fahrer_name ?? '–'}</div>
          <div className="text-xs text-red-600">★ {niedrigster?.avg_sterne.toFixed(1) ?? '–'}</div>
        </div>
      </div>

      <div className="space-y-2">
        {sorted.map((f, i) => {
          const rang = i + 1;
          return (
            <div key={f.fahrer_id} className={`flex items-center gap-3 p-2 rounded-lg border ${AMPEL_BG[f.ampel]}`}>
              <span className="text-base w-6 text-center">{RANK_BADGE[rang] ?? `#${rang}`}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-gray-900 text-sm truncate">{f.fahrer_name}</span>
                  <span className={`font-bold text-sm ${AMPEL_COLOR[f.ampel]}`}>★ {f.avg_sterne.toFixed(1)}</span>
                </div>
                <div className="mt-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${f.ampel === 'gruen' ? 'bg-emerald-500' : f.ampel === 'gelb' ? 'bg-yellow-400' : 'bg-red-500'}`}
                    style={{ width: `${(f.avg_sterne / 5) * 100}%` }}
                  />
                </div>
              </div>
              <div className="flex items-center gap-0.5 text-xs w-10 justify-end">
                {f.trend === 'steigend' ? (
                  <><TrendingUp className="w-3 h-3 text-emerald-500" /><span className="text-emerald-600">+{f.trend_delta.toFixed(1)}</span></>
                ) : f.trend === 'fallend' ? (
                  <><TrendingDown className="w-3 h-3 text-red-500" /><span className="text-red-600">{f.trend_delta.toFixed(1)}</span></>
                ) : (
                  <Minus className="w-3 h-3 text-gray-400" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
