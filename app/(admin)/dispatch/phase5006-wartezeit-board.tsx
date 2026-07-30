'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Timer } from 'lucide-react';

interface RankRow {
  rang: number;
  driver_id: string;
  name: string;
  avg_wartezeit_min: number;
  balken_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: string | null;
  rank_delta: number;
}

interface ApiResponse {
  ranking: RankRow[];
  team_avg: number;
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

export function DispatchPhase5006WartezeitBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-wartezeit-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-wartezeit-ranking';
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

  const alerts = data.ranking.filter(r => r.alert);
  const best = data.ranking[0];
  const worst = data.ranking[data.ranking.length - 1];

  return (
    <div className="rounded-2xl border border-purple-700 bg-purple-950/40 overflow-hidden mb-4">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-purple-700/50 bg-purple-900/20">
        <div className="flex items-center gap-2">
          <Timer className="w-4 h-4 text-purple-300" />
          <span className="text-sm font-semibold text-purple-200">Wartezeit-Ranking — Ø min am Restaurant (letzte 30 Tage)</span>
        </div>
        {alerts.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            {alerts.length} Hoch-Alert
          </div>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 divide-x divide-purple-700/30 border-b border-purple-700/30">
        <div className="px-3 py-2 text-center">
          <div className="text-xs text-gray-500 mb-0.5">Kürzeste Wartezeit</div>
          <div className="text-sm font-bold text-green-300 truncate">{best?.name ?? '—'}</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-xs text-gray-500 mb-0.5">Team-Ø</div>
          <div className="text-sm font-bold text-gray-300">{data.team_avg} min</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-xs text-gray-500 mb-0.5">Längste Wartezeit</div>
          <div className="text-sm font-bold text-red-400 truncate">{worst?.name ?? '—'}</div>
        </div>
      </div>

      {/* Driver List */}
      <div className="divide-y divide-purple-700/20">
        {data.ranking.map(f => (
          <div key={f.driver_id} className="px-4 py-2.5 flex items-center gap-3">
            <div className="w-5 text-center text-xs text-gray-500 font-mono">#{f.rang}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-sm font-medium text-gray-200 truncate">{f.name}</span>
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
              {f.avg_wartezeit_min} min
            </div>
            {f.alert && <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />}
          </div>
        ))}
      </div>

      {/* Champion Footer */}
      <div className="px-4 py-2 border-t border-purple-700/30 bg-purple-900/10">
        <p className="text-xs text-gray-500">
          Rang 1 = kürzeste Wartezeit = bester ·{' '}
          <span className="text-green-400">{best?.name}</span> wartet Ø nur {best?.avg_wartezeit_min} min
        </p>
      </div>
    </div>
  );
}
