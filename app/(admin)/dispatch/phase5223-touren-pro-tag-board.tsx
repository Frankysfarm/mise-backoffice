'use client';

import { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  driver_id: string;
  name: string;
  rang: number;
  avg_touren_pro_tag: number;
  balken_pct: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: string | null;
  rank_delta: number;
}

interface ApiResponse {
  ranking: FahrerRow[];
  team_avg: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta < 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta > 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

export function DispatchPhase5223TourenProTagBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-touren-pro-tag-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-touren-pro-tag-ranking';
    const res = await fetch(url);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data?.ranking?.length) return null;

  return (
    <div className="rounded-xl border border-cyan-700 bg-cyan-900/30 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <BarChart2 className="w-4 h-4 text-cyan-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Ø Touren/Tag-Ranking (Frequenz)</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3 h-3" />
            {data.alert_count} Alert
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-cyan-900/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Meiste</div>
          <div className="text-xs font-bold text-cyan-300 truncate">{data.bester_name}</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500">Team-Ø</div>
          <div className="text-xs font-bold text-gray-200">{data.team_avg.toFixed(1)}/Tag</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Wenigste</div>
          <div className="text-xs font-bold text-red-400 truncate">{data.letzter_name}</div>
        </div>
      </div>

      <div className="space-y-2">
        {data.ranking.slice(0, 6).map(f => (
          <div key={f.driver_id} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-4 text-right">{f.rang}</span>
            <span className="text-xs text-gray-300 w-24 truncate">{f.name}</span>
            <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  f.ampel === 'gruen' ? 'bg-cyan-500' :
                  f.ampel === 'gelb'  ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${f.balken_pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 w-14 text-right tabular-nums">
              {f.avg_touren_pro_tag.toFixed(1)}/Tag
            </span>
            <DeltaIcon delta={f.rank_delta} />
            {f.alert && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
          </div>
        ))}
      </div>

      {data.bester_name && (
        <div className="mt-3 text-[10px] text-cyan-400 border-t border-cyan-800/40 pt-2">
          Meiste Touren: {data.bester_name} — {data.ranking[0]?.avg_touren_pro_tag.toFixed(1)} Touren/Tag Ø
        </div>
      )}
    </div>
  );
}
