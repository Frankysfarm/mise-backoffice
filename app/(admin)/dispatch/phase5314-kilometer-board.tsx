'use client';

import { useEffect, useState } from 'react';
import { Route, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  km_gesamt: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_km: number;
  meister_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Max S.',   rang: 1, km_gesamt: 187, rank_delta:  1, ampel: 'gruen', alert_hoch: true  },
    { fahrer_id: 'f2', fahrer_name: 'Julia F.', rang: 2, km_gesamt: 142, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, km_gesamt:  98, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, km_gesamt:  54, rank_delta:  0, ampel: 'rot',   alert_hoch: false },
  ],
  team_avg_km: 120,
  meister_name: 'Max S.',
  niedrigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

export function DispatchPhase5314KilometerBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    const res = await fetch(
      `/api/delivery/admin/fahrer-kilometer-ranking?location_id=${locationId}`
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

  const maxKm = Math.max(...data.fahrer.map(f => f.km_gesamt), 1);

  return (
    <div className="rounded-xl border border-green-700 bg-green-900/20 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Route className="w-4 h-4 text-green-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Kilometer-Ranking (30 Tage)</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            {data.alert_count} Rekord
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-green-900/40 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Meiste km</div>
          <div className="text-xs font-bold text-green-300 truncate">{data.meister_name}</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500">Team-Ø km</div>
          <div className="text-xs font-bold text-green-300">{data.team_avg_km}</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Niedrigste km</div>
          <div className="text-xs font-bold text-gray-400 truncate">{data.niedrigster_name}</div>
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
                  f.ampel === 'gruen' ? 'bg-green-400' :
                  f.ampel === 'gelb'  ? 'bg-yellow-400' : 'bg-red-500'
                }`}
                style={{ width: `${(f.km_gesamt / maxKm) * 100}%` }}
              />
            </div>
            <span className="text-xs font-bold tabular-nums text-green-300 w-12 text-right">{f.km_gesamt} km</span>
            <DeltaIcon delta={f.rank_delta} />
            {f.alert_hoch && <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />}
          </div>
        ))}
      </div>

      <div className="mt-2 text-[9px] text-gray-600 text-right">{data.gesamt} Fahrer · 30-Tage-km · 30-Min-Polling</div>
    </div>
  );
}
