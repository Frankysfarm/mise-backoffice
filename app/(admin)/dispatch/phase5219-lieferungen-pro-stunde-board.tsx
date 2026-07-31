'use client';

import { useEffect, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  deliveries_pro_h: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pro_h: number;
  produktivste_name: string;
  wenigste_name: string;
  alert_count: number;
  gesamt: number;
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta < 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta > 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

export function DispatchPhase5219LieferungenProStundeBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-lieferungen-pro-stunde-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-lieferungen-pro-stunde-ranking';
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

  const maxRate = Math.max(...data.fahrer.map(f => f.deliveries_pro_h), 1);

  return (
    <div className="rounded-xl border border-teal-700 bg-teal-900/30 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="w-4 h-4 text-teal-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Ø Lieferungen/h-Ranking (Produktivität)</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3 h-3" />
            {data.alert_count} Niedrig-Alert
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-teal-900/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Produktivste</div>
          <div className="text-xs font-bold text-teal-300 truncate">{data.produktivste_name}</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500">Team-Ø</div>
          <div className="text-xs font-bold text-gray-200">{data.team_avg_pro_h.toFixed(1)}/h</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Wenigste</div>
          <div className="text-xs font-bold text-red-400 truncate">{data.wenigste_name}</div>
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
                  f.ampel === 'gruen' ? 'bg-teal-500' :
                  f.ampel === 'gelb'  ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${Math.round((f.deliveries_pro_h / maxRate) * 100)}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 w-12 text-right tabular-nums">
              {f.deliveries_pro_h.toFixed(1)}/h
            </span>
            <DeltaIcon delta={f.rank_delta} />
            {f.alert_niedrig && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
          </div>
        ))}
      </div>

      {data.produktivste_name && (
        <div className="mt-3 text-[10px] text-teal-400 border-t border-teal-800/40 pt-2">
          Produktivste: {data.produktivste_name} — {data.fahrer[0]?.deliveries_pro_h.toFixed(1)} Lieferungen/h Ø
        </div>
      )}
    </div>
  );
}
