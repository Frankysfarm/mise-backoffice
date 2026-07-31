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
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'm1', fahrer_name: 'Julia F.', rang: 1, puenktlichkeit_pct: 94, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'm2', fahrer_name: 'Max M.',   rang: 2, puenktlichkeit_pct: 89, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'm3', fahrer_name: 'Sara K.',  rang: 3, puenktlichkeit_pct: 82, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'm4', fahrer_name: 'Tim B.',   rang: 4, puenktlichkeit_pct: 71, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_pct: 84,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

export function DispatchPhase5346PuenktlichkeitsBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    const res = await fetch(
      `/api/delivery/admin/fahrer-puenktlichkeit-ranking?location_id=${locationId}`
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

  return (
    <div className="rounded-xl border border-green-700 bg-green-900/20 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-green-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Pünktlichkeits-Ranking (30 Tage)</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3 h-3" />
            {data.alert_count} niedrig
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-green-900/40 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Pünktlichste/r</div>
          <div className="text-xs font-bold text-green-300 truncate">{data.bester_name}</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500">Team-Ø</div>
          <div className="text-xs font-bold text-green-300">{data.team_avg_pct.toFixed(1)} %</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Unpünktlichste/r</div>
          <div className="text-xs font-bold text-gray-400 truncate">{data.letzter_name}</div>
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
                style={{ width: `${f.puenktlichkeit_pct}%` }}
              />
            </div>
            <span className="text-xs font-bold tabular-nums text-green-300 w-12 text-right">{f.puenktlichkeit_pct} %</span>
            <DeltaIcon delta={f.rank_delta} />
            {f.alert_niedrig && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
          </div>
        ))}
      </div>

      <div className="mt-2 text-[9px] text-gray-600 text-right">{data.gesamt} Fahrer · Pünktlichkeit absteigend · 30-Min-Polling</div>
    </div>
  );
}
