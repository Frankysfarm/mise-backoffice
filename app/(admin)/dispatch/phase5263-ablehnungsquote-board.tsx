'use client';

import { useEffect, useState } from 'react';
import { XOctagon, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  ablehnungsquote_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: string | null;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_ablehnungsquote_pct: number;
  alert_count: number;
  ziel_pct: number;
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta < 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta > 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

export function DispatchPhase5263AblehnungsquoteBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-ablehnungsquote?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-ablehnungsquote';
    const res = await fetch(url);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data?.fahrer?.length) return null;

  const maxVal = Math.max(data.fahrer[data.fahrer.length - 1]?.ablehnungsquote_pct ?? 10, 1);
  const besteFahrer = data.fahrer[0];
  const schlechtesteFahrer = data.fahrer[data.fahrer.length - 1];

  return (
    <div className="rounded-xl border border-rose-700 bg-rose-900/30 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <XOctagon className="w-4 h-4 text-rose-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Ablehnungsquote-Ranking (letzte 30 Tage)</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3 h-3" />
            {data.alert_count} Hoch-Alert
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-rose-900/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Niedrigste</div>
          <div className="text-xs font-bold text-green-400 truncate">{besteFahrer?.fahrer_name}</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500">Team-Ø</div>
          <div className="text-xs font-bold text-gray-200">{data.team_avg_ablehnungsquote_pct.toFixed(1)}%</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Höchste</div>
          <div className="text-xs font-bold text-red-400 truncate">{schlechtesteFahrer?.fahrer_name}</div>
        </div>
      </div>

      <div className="space-y-2">
        {data.fahrer.slice(0, 6).map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-4 text-right">{f.rang}</span>
            <span className="text-xs text-gray-300 w-24 truncate">{f.fahrer_name}</span>
            <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  f.ampel === 'gruen' ? 'bg-green-500' :
                  f.ampel === 'gelb'  ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.min(100, Math.round((f.ablehnungsquote_pct / maxVal) * 100))}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 w-10 text-right tabular-nums">
              {f.ablehnungsquote_pct.toFixed(1)}%
            </span>
            <DeltaIcon delta={f.rank_delta} />
            {f.alert && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
          </div>
        ))}
      </div>

      {besteFahrer && (
        <div className="mt-3 text-[10px] text-rose-400 border-t border-rose-800/40 pt-2">
          Niedrigste Quote: {besteFahrer.fahrer_name} — {besteFahrer.ablehnungsquote_pct.toFixed(1)}% · Ziel: ≤{data.ziel_pct}%
        </div>
      )}
    </div>
  );
}
