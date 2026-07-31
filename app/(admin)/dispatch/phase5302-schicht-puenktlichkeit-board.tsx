'use client';

import { useEffect, useState } from 'react';
import { Clock, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  puenktlichkeit_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_schlecht: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  puenktlichste_name: string;
  unzuverlaessigste_name: string;
  alert_count: number;
  gesamt: number;
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta < 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta > 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

export function DispatchPhase5302SchichtPuenktlichkeitBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-schicht-puenktlichkeit-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-schicht-puenktlichkeit-ranking';
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

  return (
    <div className="rounded-xl border border-green-700 bg-green-900/30 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-green-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Schicht-Pünktlichkeit-Ranking (letzte 30 Tage)</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3 h-3" />
            {data.alert_count} Schlecht-Alert
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-green-900/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Pünktlichste</div>
          <div className="text-xs font-bold text-green-300 truncate">{data.puenktlichste_name}</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500">Team-Ø</div>
          <div className="text-xs font-bold text-gray-200">{data.team_avg.toFixed(1)}%</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Unzuverlässigste</div>
          <div className="text-xs font-bold text-red-400 truncate">{data.unzuverlaessigste_name}</div>
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
                style={{ width: `${f.puenktlichkeit_pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 w-12 text-right tabular-nums">
              {f.puenktlichkeit_pct.toFixed(1)}%
            </span>
            <DeltaIcon delta={f.rank_delta} />
            {f.alert_schlecht && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
          </div>
        ))}
      </div>

      {data.puenktlichste_name && (
        <div className="mt-3 text-[10px] text-green-400 border-t border-green-800/40 pt-2">
          Pünktlichste: {data.puenktlichste_name} — {data.fahrer[0]?.puenktlichkeit_pct.toFixed(1)}% · ≥95% = Grün · ≥75% = Gelb · &lt;75% = Rot
        </div>
      )}
    </div>
  );
}
