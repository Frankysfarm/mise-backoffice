'use client';

import { useEffect, useState } from 'react';
import { Zap, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  effizienz_score: number;
  touren_pro_stunde: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_score: number;
  bester_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.',  rang: 1, effizienz_score: 92, touren_pro_stunde: 2.3, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',    rang: 2, effizienz_score: 78, touren_pro_stunde: 2.0, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',   rang: 3, effizienz_score: 61, touren_pro_stunde: 1.6, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',    rang: 4, effizienz_score: 38, touren_pro_stunde: 1.1, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_score: 67,
  bester_name: 'Julia F.',
  niedrigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

export function DispatchPhase5310TourenEffizienzBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    const res = await fetch(
      `/api/delivery/admin/fahrer-touren-effizienz-ranking?location_id=${locationId}`
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

  const maxScore = Math.max(...data.fahrer.map(f => f.effizienz_score), 1);

  return (
    <div className="rounded-xl border border-yellow-700 bg-yellow-900/20 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-yellow-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Touren-Effizienz-Ranking (30d)</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3 h-3" />
            {data.alert_count} Niedrig
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-yellow-900/40 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Effizienteste</div>
          <div className="text-xs font-bold text-yellow-300 truncate">{data.bester_name}</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500">Team-Ø Score</div>
          <div className="text-xs font-bold text-yellow-300">{data.team_avg_score}</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Niedrigste</div>
          <div className="text-xs font-bold text-red-400 truncate">{data.niedrigster_name}</div>
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
                  f.ampel === 'gruen' ? 'bg-yellow-400' :
                  f.ampel === 'gelb'  ? 'bg-yellow-600' : 'bg-red-500'
                }`}
                style={{ width: `${(f.effizienz_score / maxScore) * 100}%` }}
              />
            </div>
            <span className="text-xs font-bold tabular-nums text-yellow-300 w-8 text-right">{f.effizienz_score}</span>
            <span className="text-[10px] text-gray-600 w-12 text-right tabular-nums">{f.touren_pro_stunde}/h</span>
            <DeltaIcon delta={f.rank_delta} />
            {f.alert_bottom && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
          </div>
        ))}
      </div>

      <div className="mt-2 text-[9px] text-gray-600 text-right">{data.gesamt} Fahrer · Score 0–100 · 30-Min-Polling</div>
    </div>
  );
}
