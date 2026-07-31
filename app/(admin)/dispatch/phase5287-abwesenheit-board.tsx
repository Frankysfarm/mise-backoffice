'use client';

import { useEffect, useState } from 'react';
import { UserMinus, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  abwesenheit_tage: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  beste_name: string;
  schlechteste_name: string;
  alert_count: number;
  gesamt: number;
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta < 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta > 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: '1', fahrer_name: 'Anna M.', rang: 1, abwesenheit_tage: 0, rank_delta: 0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: '2', fahrer_name: 'Ben K.', rang: 2, abwesenheit_tage: 1, rank_delta: 1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: '3', fahrer_name: 'Carl S.', rang: 3, abwesenheit_tage: 2, rank_delta: -1, ampel: 'gelb', alert_hoch: false },
    { fahrer_id: '4', fahrer_name: 'Diana R.', rang: 4, abwesenheit_tage: 4, rank_delta: 0, ampel: 'gelb', alert_hoch: false },
    { fahrer_id: '5', fahrer_name: 'Emil T.', rang: 5, abwesenheit_tage: 7, rank_delta: 2, ampel: 'rot', alert_hoch: true },
    { fahrer_id: '6', fahrer_name: 'Finn L.', rang: 6, abwesenheit_tage: 10, rank_delta: -1, ampel: 'rot', alert_hoch: true },
  ],
  team_avg: 4.0,
  beste_name: 'Anna M.',
  schlechteste_name: 'Finn L.',
  alert_count: 2,
  gesamt: 6,
};

export function DispatchPhase5287AbwesenheitBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-abwesenheit-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-abwesenheit-ranking';
    const res = await fetch(url).catch(() => null);
    if (res?.ok) setData(await res.json());
    else setData(MOCK);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data?.fahrer?.length) return null;

  const maxVal = Math.max(data.fahrer[data.fahrer.length - 1]?.abwesenheit_tage ?? 10, 1);

  return (
    <div className="rounded-xl border border-red-700 bg-red-900/30 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <UserMinus className="w-4 h-4 text-red-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Abwesenheits-Ranking (letzte 30 Tage)</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3 h-3" />
            {data.alert_count} Hoch-Alert
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-red-900/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Wenigste</div>
          <div className="text-xs font-bold text-green-400 truncate">{data.beste_name}</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500">Team-Ø</div>
          <div className="text-xs font-bold text-gray-200">{data.team_avg.toFixed(1)} Tage</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Meiste</div>
          <div className="text-xs font-bold text-red-400 truncate">{data.schlechteste_name}</div>
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
                style={{ width: `${(f.abwesenheit_tage / maxVal) * 100}%` }}
              />
            </div>
            <span className="text-xs text-gray-400 w-12 text-right tabular-nums">
              {f.abwesenheit_tage} Tage
            </span>
            <DeltaIcon delta={f.rank_delta} />
            {f.alert_hoch && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
          </div>
        ))}
      </div>

      {data.beste_name && (
        <div className="mt-3 text-[10px] text-green-400 border-t border-red-800/40 pt-2">
          Wenigste Abwesenheit: {data.beste_name} — {data.fahrer[0]?.abwesenheit_tage} Tage
        </div>
      )}
    </div>
  );
}
