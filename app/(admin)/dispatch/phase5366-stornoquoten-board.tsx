'use client';

import { useEffect, useState } from 'react';
import { XCircle, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  rate_pct: number;
  cancelled_orders: number;
  assigned_orders: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_rate: number;
  beste_name: string;
  hoechste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, rate_pct: 1,  cancelled_orders: 1,  assigned_orders: 65, rank_delta:  0, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, rate_pct: 4,  cancelled_orders: 2,  assigned_orders: 55, rank_delta:  1, ampel: 'gruen', alert_hoch: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, rate_pct: 8,  cancelled_orders: 3,  assigned_orders: 40, rank_delta: -1, ampel: 'gelb',  alert_hoch: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, rate_pct: 17, cancelled_orders: 7,  assigned_orders: 42, rank_delta:  0, ampel: 'rot',   alert_hoch: true  },
  ],
  team_avg_rate: 8,
  beste_name: 'Julia F.',
  hoechste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

function ampelColor(ampel: string) {
  if (ampel === 'gruen') return 'bg-green-500';
  if (ampel === 'gelb')  return 'bg-yellow-400';
  return 'bg-red-500';
}

export function DispatchPhase5366StornoquotenBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    const res = await fetch(
      `/api/delivery/admin/fahrer-storno-rate-ranking?location_id=${locationId}`
    );
    if (!res.ok) { setData(MOCK); return; }
    setData(await res.json());
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!data) return <div className="text-gray-400 text-sm p-4">Lade Stornoquoten-Ranking…</div>;

  const maxRate = Math.max(...data.fahrer.map(f => f.rate_pct), 1);

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <XCircle className="w-5 h-5 text-orange-400" />
        <span className="text-white font-semibold">Stornoquoten-Ranking</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3 h-3" /> {data.alert_count} hoch
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-[10px] text-gray-400">Beste/r</div>
          <div className="text-xs text-green-400 font-medium truncate">{data.beste_name}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-[10px] text-gray-400">Team-Ø</div>
          <div className="text-xs text-orange-400 font-medium">{data.team_avg_rate}%</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-[10px] text-gray-400">Höchste</div>
          <div className="text-xs text-red-400 font-medium truncate">{data.hoechste_name}</div>
        </div>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400 w-4 text-right">{f.rang}</span>
            <DeltaIcon delta={f.rank_delta} />
            <span className="text-[11px] text-white flex-1 truncate">{f.fahrer_name}</span>
            {f.alert_hoch && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
            <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${ampelColor(f.ampel)}`}
                style={{ width: `${Math.min(100, (f.rate_pct / maxRate) * 100)}%` }}
              />
            </div>
            <span className="text-[11px] text-gray-300 w-8 text-right">{f.rate_pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
