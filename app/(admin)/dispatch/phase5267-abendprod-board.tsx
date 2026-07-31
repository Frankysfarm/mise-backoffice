'use client';

import { useEffect, useState } from 'react';
import { Moon, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  touren_pro_std: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_tph: number;
  meister_name: string;
  wenigster_name: string;
  alert_count: number;
  gesamt: number;
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta < 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta > 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

export function DispatchPhase5267AbendprodBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-abendprod-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-abendprod-ranking';
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

  const maxVal = Math.max(data.fahrer[0]?.touren_pro_std ?? 1, 1);

  return (
    <div className="rounded-xl border border-indigo-700 bg-indigo-900/30 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Moon className="w-4 h-4 text-indigo-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Abendproduktivität-Ranking (letzte 30 Tage)</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3 h-3" />
            {data.alert_count} Hoch-Alert
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-indigo-900/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Meister</div>
          <div className="text-xs font-bold text-indigo-300 truncate">{data.meister_name}</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500">Team-Ø</div>
          <div className="text-xs font-bold text-gray-200">{data.team_avg_tph.toFixed(1)} T/h</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Wenigste</div>
          <div className="text-xs font-bold text-red-400 truncate">{data.wenigster_name}</div>
        </div>
      </div>

      <div className="space-y-2">
        {data.fahrer.slice(0, 6).map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-4 text-right">{f.rang}</span>
            <span className="text-xs text-gray-300 w-24 truncate">{f.fahrer_name}</span>
            <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500"
                style={{ width: `${Math.min(100, Math.round((f.touren_pro_std / maxVal) * 100))}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 w-14 text-right tabular-nums">
              {f.touren_pro_std.toFixed(1)} T/h
            </span>
            <DeltaIcon delta={f.rank_delta} />
            {f.alert_hoch && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
          </div>
        ))}
      </div>

      {data.meister_name && (
        <div className="mt-3 text-[10px] text-indigo-400 border-t border-indigo-800/40 pt-2">
          Meister: {data.meister_name} — {data.fahrer[0]?.touren_pro_std.toFixed(1)} Touren/Std in der Abendschicht
        </div>
      )}
    </div>
  );
}
