'use client';

import { useEffect, useState } from 'react';
import { Timer, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  avg_min: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_top: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  schnellster_name: string;
  langsamster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'm1', fahrer_name: 'Julia F.', rang: 1, avg_min: 18, rank_delta: -1, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'm2', fahrer_name: 'Sara K.',  rang: 2, avg_min: 22, rank_delta:  0, ampel: 'gruen', alert_top: false },
    { fahrer_id: 'm3', fahrer_name: 'Max M.',   rang: 3, avg_min: 28, rank_delta:  1, ampel: 'gelb',  alert_top: false },
    { fahrer_id: 'm4', fahrer_name: 'Tim B.',   rang: 4, avg_min: 36, rank_delta:  0, ampel: 'rot',   alert_top: true  },
  ],
  team_avg: 26,
  schnellster_name: 'Julia F.',
  langsamster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

export function DispatchPhase5318LieferzeitBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    const res = await fetch(
      `/api/delivery/admin/fahrer-durchschnitts-lieferzeit-ranking?location_id=${locationId}`
    ).catch(() => null);
    if (res?.ok) setData(await res.json());
    else setData(MOCK);
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return null;

  const maxMin = Math.max(...data.fahrer.map(f => f.avg_min), 1);

  return (
    <div className="rounded-xl border border-orange-700 bg-orange-900/20 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Timer className="w-4 h-4 text-orange-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Lieferzeit-Ranking (30 Tage)</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3 h-3" />
            {data.alert_count} zu langsam
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-orange-900/40 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Schnellste/r</div>
          <div className="text-xs font-bold text-orange-300 truncate">{data.schnellster_name}</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500">Team-Ø</div>
          <div className="text-xs font-bold text-orange-300">{data.team_avg} min</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Langsamste/r</div>
          <div className="text-xs font-bold text-gray-400 truncate">{data.langsamster_name}</div>
        </div>
      </div>

      <div className="space-y-2">
        {data.fahrer.slice(0, 6).map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-4 text-right">{f.rang}</span>
            <span className="text-xs text-gray-300 w-20 truncate">{f.fahrer_name}</span>
            <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  f.ampel === 'gruen' ? 'bg-orange-400' :
                  f.ampel === 'gelb'  ? 'bg-yellow-400' : 'bg-red-500'
                }`}
                style={{ width: `${(f.avg_min / maxMin) * 100}%` }}
              />
            </div>
            <span className="text-xs font-bold tabular-nums text-orange-300 w-14 text-right">{f.avg_min} min</span>
            <DeltaIcon delta={f.rank_delta} />
            {f.alert_top && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
          </div>
        ))}
      </div>

      <div className="mt-2 text-[9px] text-gray-600 text-right">{data.gesamt} Fahrer · Ø-Lieferzeit aufsteigend · 30-Min-Polling</div>
    </div>
  );
}
