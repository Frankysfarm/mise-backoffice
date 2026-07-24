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
  schlechtester_name: string;
  alert_count: number;
}

const MOCK: ApiResponse = {
  team_avg: 3.4,
  bester_name: 'Thomas W.',
  schlechtester_name: 'Sara B.',
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

const AMPEL_BG: Record<string, string> = {
  gruen: 'bg-emerald-50 border-emerald-200',
  gelb: 'bg-orange-50 border-orange-200',
  rot: 'bg-red-50 border-red-200',
};

const RANK_BADGE: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function DispatchPhase3670AbholzeitRankingBoard({ locationId }: { locationId: string | null }) {
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

  if (loading) return <div className="animate-pulse h-48 bg-gray-100 rounded-xl" />;

  const sorted = [...data.fahrer].sort((a, b) => a.avg_abholzeit_min - b.avg_abholzeit_min);
  const bester = sorted[0];
  const schlechteste = sorted[sorted.length - 1];
  const maxVal = schlechteste?.avg_abholzeit_min ?? 1;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Package className="w-5 h-5 text-blue-500" />
        <h3 className="font-semibold text-gray-900">Abholzeit/Stopp — Ranking</h3>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-600">
            <AlertTriangle className="w-3.5 h-3.5" /> {data.alert_count} Alarm
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="bg-blue-50 rounded-lg p-2">
          <div className="font-semibold text-blue-700 truncate">{bester?.fahrer_name ?? '—'}</div>
          <div className="text-blue-600">{bester ? `${bester.avg_abholzeit_min.toFixed(1)}min` : '—'}</div>
          <div className="text-gray-400">Schnellster</div>
        </div>
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="font-semibold text-gray-700">{data.team_avg.toFixed(1)}min</div>
          <div className="text-gray-400">Team-Ø</div>
        </div>
        <div className="bg-red-50 rounded-lg p-2">
          <div className="font-semibold text-red-700 truncate">{schlechteste?.fahrer_name ?? '—'}</div>
          <div className="text-red-600">{schlechteste ? `${schlechteste.avg_abholzeit_min.toFixed(1)}min` : '—'}</div>
          <div className="text-gray-400">Langsamster</div>
        </div>
      </div>

      <div className="space-y-2">
        {sorted.map((f) => {
          const DeltaIcon = f.rank_delta < 0 ? TrendingUp : f.rank_delta > 0 ? TrendingDown : Minus;
          const deltaColor = f.rank_delta < 0 ? 'text-emerald-500' : f.rank_delta > 0 ? 'text-red-500' : 'text-gray-400';
          const pct = maxVal > 0 ? (f.avg_abholzeit_min / maxVal) * 100 : 0;

          return (
            <div key={f.fahrer_id} className={`rounded-lg border p-2.5 ${AMPEL_BG[f.ampel]}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-bold text-gray-500 w-5">{RANK_BADGE[f.rang] ?? `#${f.rang}`}</span>
                <span className="flex-1 text-sm font-medium text-gray-900 truncate">{f.fahrer_name}</span>
                <span className={`text-sm font-bold ${AMPEL_COLOR[f.ampel]}`}>{f.avg_abholzeit_min.toFixed(1)}min</span>
                <DeltaIcon className={`w-3.5 h-3.5 ${deltaColor}`} />
                {f.rank_delta !== 0 && (
                  <span className={`text-xs font-medium ${deltaColor}`}>
                    {f.rank_delta > 0 ? `+${f.rank_delta}` : f.rank_delta}
                  </span>
                )}
                {f.alert_hoch && <AlertTriangle className="w-3.5 h-3.5 text-red-500" />}
              </div>
              <div className="w-full bg-white/60 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${f.ampel === 'gruen' ? 'bg-emerald-400' : f.ampel === 'gelb' ? 'bg-orange-400' : 'bg-red-400'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              {f.alert_hoch && <div className="text-xs text-red-600 mt-1">Hohe Abholzeit!</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
