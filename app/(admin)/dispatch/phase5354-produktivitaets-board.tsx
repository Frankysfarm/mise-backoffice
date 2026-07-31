'use client';

import { useEffect, useState } from 'react';
import { Zap, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

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

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, deliveries_pro_h: 4.8, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, deliveries_pro_h: 4.1, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, deliveries_pro_h: 3.6, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, deliveries_pro_h: 2.2, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_pro_h: 3.7,
  produktivste_name: 'Julia F.',
  wenigste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

export function DispatchPhase5354ProduktivitaetsBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    const res = await fetch(
      `/api/delivery/admin/fahrer-lieferungen-pro-stunde-ranking?location_id=${locationId}`
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

  const ranking = data.fahrer ?? [];
  const maxVal = ranking[0]?.deliveries_pro_h ?? 1;

  return (
    <div className="rounded-xl border border-violet-700 bg-violet-900/20 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-violet-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Produktivitäts-Ranking (30 Tage)</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3 h-3" />
            {data.alert_count} niedrig
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-violet-900/40 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Produktivste/r</div>
          <div className="text-xs font-bold text-violet-300 truncate">{data.produktivste_name}</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500">Team-Ø</div>
          <div className="text-xs font-bold text-violet-300">{data.team_avg_pro_h.toFixed(1)}/h</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Wenigste</div>
          <div className="text-xs font-bold text-gray-400 truncate">{data.wenigste_name}</div>
        </div>
      </div>

      <div className="space-y-2">
        {ranking.slice(0, 6).map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-4 text-right">{f.rang}</span>
            <span className="text-xs text-gray-300 w-20 truncate">{f.fahrer_name}</span>
            <div className="flex-1 h-2 rounded-full bg-gray-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  f.ampel === 'gruen' ? 'bg-violet-400' :
                  f.ampel === 'gelb'  ? 'bg-yellow-400' : 'bg-red-500'
                }`}
                style={{ width: `${Math.round((f.deliveries_pro_h / maxVal) * 100)}%` }}
              />
            </div>
            <span className="text-xs font-bold tabular-nums text-violet-300 w-14 text-right">{f.deliveries_pro_h.toFixed(1)}/h</span>
            <DeltaIcon delta={f.rank_delta} />
            {f.alert_niedrig && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
          </div>
        ))}
      </div>

      <div className="mt-2 text-[9px] text-gray-600 text-right">{data.gesamt} Fahrer · Lieferungen/h absteigend · 30-Min-Polling</div>
    </div>
  );
}
