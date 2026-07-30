'use client';

import { useEffect, useState } from 'react';
import { Map, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  avg_km: number;
  balken_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_km: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-300';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

function barColor(a: string) {
  if (a === 'gruen') return 'bg-indigo-400';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

export function DispatchPhase5016KilometerBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-kilometer-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-kilometer-ranking';
    const res = await fetch(url);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return null;

  const effizienteste = data.fahrer[0];
  const weiteste = data.fahrer[data.fahrer.length - 1];

  return (
    <div className="rounded-2xl border border-indigo-700 bg-indigo-950/40 overflow-hidden mb-4">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-indigo-700/50 bg-indigo-900/20">
        <div className="flex items-center gap-2">
          <Map className="w-4 h-4 text-indigo-300" />
          <span className="text-sm font-semibold text-indigo-200">km-Ranking je Tour (letzte 30 Tage)</span>
        </div>
        {data.alert_count > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            {data.alert_count} ≥15km-Alert
          </div>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 divide-x divide-indigo-700/30 border-b border-indigo-700/30">
        <div className="px-3 py-2 text-center">
          <div className="text-xs text-gray-500 mb-0.5">Effizienteste</div>
          <div className="text-sm font-bold text-green-300 truncate">{effizienteste?.fahrer_name}</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-xs text-gray-500 mb-0.5">Team-Ø</div>
          <div className="text-sm font-bold text-gray-300">{data.team_avg_km} km</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-xs text-gray-500 mb-0.5">Weiteste</div>
          <div className="text-sm font-bold text-red-400 truncate">{weiteste?.fahrer_name}</div>
        </div>
      </div>

      {/* Driver List */}
      <div className="divide-y divide-indigo-700/20">
        {data.fahrer.map((f: FahrerRow) => (
          <div key={f.fahrer_id} className="px-4 py-2.5 flex items-center gap-3">
            <div className="w-5 text-center text-xs text-gray-500 font-mono">#{f.rang}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm font-medium text-gray-200 truncate">{f.fahrer_name}</span>
                <DeltaIcon delta={f.rank_delta} />
              </div>
              <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor(f.ampel)}`}
                  style={{ width: `${f.balken_pct}%` }}
                />
              </div>
            </div>
            <div className={`text-sm font-bold tabular-nums shrink-0 ${ampelColor(f.ampel)}`}>
              {f.avg_km} km
            </div>
          </div>
        ))}
      </div>

      {/* Champion Footer */}
      <div className="px-4 py-2 border-t border-indigo-700/30 bg-indigo-900/10">
        <p className="text-xs text-gray-500">
          Rang 1 = kürzeste Distanz = effizienteste Route ·{' '}
          <span className="text-green-400">{effizienteste?.fahrer_name}</span> führt mit {effizienteste?.avg_km} km
        </p>
      </div>
    </div>
  );
}
