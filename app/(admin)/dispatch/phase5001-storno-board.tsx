'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, XCircle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  storno_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
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
  if (a === 'gruen') return 'bg-green-400';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

export function DispatchPhase5001StornoBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-storno-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-storno-ranking';
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

  const maxVal = Math.max(...data.fahrer.map(f => f.storno_pct), 1);

  return (
    <div className="rounded-2xl border border-red-700 bg-red-950/40 overflow-hidden mb-4">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-red-700/50 bg-red-900/20">
        <div className="flex items-center gap-2">
          <XCircle className="w-4 h-4 text-red-300" />
          <span className="text-sm font-semibold text-red-200">Storno-Quote-Ranking (letzte 30 Tage)</span>
        </div>
        {data.alert_count > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            {data.alert_count} Hoch-Alert
          </div>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 divide-x divide-red-700/30 border-b border-red-700/30">
        <div className="px-3 py-2 text-center">
          <div className="text-xs text-gray-500 mb-0.5">Wenigste Stornos</div>
          <div className="text-sm font-bold text-green-300 truncate">{data.bester_name}</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-xs text-gray-500 mb-0.5">Team-Ø</div>
          <div className="text-sm font-bold text-gray-300">{data.team_avg_pct}%</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-xs text-gray-500 mb-0.5">Meiste Stornos</div>
          <div className="text-sm font-bold text-red-400 truncate">{data.letzter_name}</div>
        </div>
      </div>

      {/* Driver List */}
      <div className="divide-y divide-red-700/20">
        {data.fahrer.map(f => (
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
                  style={{ width: `${(f.storno_pct / maxVal) * 100}%` }}
                />
              </div>
            </div>
            <div className={`text-sm font-bold tabular-nums shrink-0 ${ampelColor(f.ampel)}`}>
              {f.storno_pct}%
            </div>
            {f.alert_hoch && <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
          </div>
        ))}
      </div>

      {/* Champion Footer */}
      <div className="px-4 py-2 border-t border-red-700/30 bg-red-900/10">
        <p className="text-xs text-gray-500">
          Rang 1 = niedrigste Storno-Quote = bester ·{' '}
          <span className="text-green-400">{data.bester_name}</span> führt mit {data.fahrer[0]?.storno_pct}%
        </p>
      </div>
    </div>
  );
}
