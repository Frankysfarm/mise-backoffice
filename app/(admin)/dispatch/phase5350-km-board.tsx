'use client';

import { useEffect, useState } from 'react';
import { Route, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  driver_id: string;
  name: string;
  rang: number;
  avg_km_pro_tour: number;
  touren: number;
  balken_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert: string | null;
}

interface ApiResponse {
  ranking: FahrerRow[];
  team_avg: number;
  generated_at: string;
}

const MOCK: ApiResponse = {
  ranking: [
    { driver_id: 'm1', name: 'Tim B.',   rang: 1, avg_km_pro_tour: 18.4, touren: 42, balken_pct: 100, rank_delta:  1, ampel: 'gruen', alert: null },
    { driver_id: 'm2', name: 'Sara K.',  rang: 2, avg_km_pro_tour: 15.2, touren: 38, balken_pct:  83, rank_delta:  0, ampel: 'gruen', alert: null },
    { driver_id: 'm3', name: 'Max M.',   rang: 3, avg_km_pro_tour: 12.7, touren: 35, balken_pct:  69, rank_delta: -1, ampel: 'gelb',  alert: null },
    { driver_id: 'm4', name: 'Julia F.', rang: 4, avg_km_pro_tour:  9.3, touren: 29, balken_pct:  51, rank_delta:  0, ampel: 'rot',   alert: 'Wenige Kilometer!' },
  ],
  team_avg: 13.9,
  generated_at: new Date().toISOString(),
};

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

export function DispatchPhase5350KmBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    const res = await fetch(
      `/api/delivery/admin/fahrer-km-ranking?location_id=${locationId}`
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

  const ranking = data.ranking ?? [];
  const alerts = ranking.filter(f => f.alert).length;
  const bester = ranking[0];
  const letzter = ranking[ranking.length - 1];

  return (
    <div className="rounded-xl border border-blue-700 bg-blue-900/20 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Route className="w-4 h-4 text-blue-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Km-Ranking (30 Tage)</span>
        {alerts > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3 h-3" />
            {alerts} niedrig
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-blue-900/40 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Meiste km</div>
          <div className="text-xs font-bold text-blue-300 truncate">{bester?.name ?? '—'}</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500">Team-Ø</div>
          <div className="text-xs font-bold text-blue-300">{data.team_avg.toFixed(1)} km</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Wenigste km</div>
          <div className="text-xs font-bold text-gray-400 truncate">{letzter?.name ?? '—'}</div>
        </div>
      </div>

      <div className="space-y-2">
        {ranking.slice(0, 6).map(f => (
          <div key={f.driver_id} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-4 text-right">{f.rang}</span>
            <span className="text-xs text-gray-300 w-20 truncate">{f.name}</span>
            <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  f.ampel === 'gruen' ? 'bg-blue-400' :
                  f.ampel === 'gelb'  ? 'bg-yellow-400' : 'bg-red-500'
                }`}
                style={{ width: `${f.balken_pct}%` }}
              />
            </div>
            <span className="text-xs font-bold tabular-nums text-blue-300 w-14 text-right">{f.avg_km_pro_tour.toFixed(1)} km</span>
            <DeltaIcon delta={f.rank_delta} />
            {f.alert && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
          </div>
        ))}
      </div>

      <div className="mt-2 text-[9px] text-gray-600 text-right">{ranking.length} Fahrer · Ø km/Tour absteigend · 30-Min-Polling</div>
    </div>
  );
}
