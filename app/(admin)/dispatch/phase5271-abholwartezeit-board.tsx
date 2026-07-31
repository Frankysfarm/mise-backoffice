'use client';

import { useEffect, useState } from 'react';
import { Timer, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

type Ampel = 'gruen' | 'gelb' | 'rot';
type Trend = 'steigend' | 'fallend' | 'stabil';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_min: number;
  touren_heute: number;
  touren_ueber8min: number;
  trend: Trend;
  trend_delta: number;
  ampel: Ampel;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_min: number;
  alert_count: number;
}

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === 'fallend') return <TrendingDown className="w-3 h-3 text-green-400" />;
  if (trend === 'steigend') return <TrendingUp className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

export function DispatchPhase5271AbholwartezeitBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-abholwartezeit?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-abholwartezeit';
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

  const maxVal = Math.max(data.fahrer[data.fahrer.length - 1]?.avg_min ?? 10, 1);
  const beste = data.fahrer[0];
  const schlechteste = data.fahrer[data.fahrer.length - 1];

  return (
    <div className="rounded-xl border border-orange-700 bg-orange-900/30 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Timer className="w-4 h-4 text-orange-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Abholwartezeit-Ranking (heute)</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3 h-3" />
            {data.alert_count} Alert
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-orange-900/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Kürzeste</div>
          <div className="text-xs font-bold text-green-400 truncate">{beste?.fahrer_name}</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500">Team-Ø</div>
          <div className="text-xs font-bold text-gray-200">{data.team_avg_min.toFixed(1)} min</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Längste</div>
          <div className="text-xs font-bold text-red-400 truncate">{schlechteste?.fahrer_name}</div>
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
                style={{ width: `${Math.min(100, Math.round((f.avg_min / maxVal) * 100))}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 w-14 text-right tabular-nums">
              {f.avg_min.toFixed(1)} min
            </span>
            <TrendIcon trend={f.trend} />
            {f.touren_ueber8min > 0 && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
          </div>
        ))}
      </div>

      {beste && (
        <div className="mt-3 text-[10px] text-orange-400 border-t border-orange-800/40 pt-2">
          Kürzeste: {beste.fahrer_name} — {beste.avg_min.toFixed(1)} min · {beste.touren_heute} Touren heute
        </div>
      )}
    </div>
  );
}
