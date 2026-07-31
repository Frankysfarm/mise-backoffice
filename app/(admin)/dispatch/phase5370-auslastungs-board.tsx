'use client';

import { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  auslastung_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_bottom: boolean;
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
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, auslastung_pct: 87, rank_delta:  1, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, auslastung_pct: 74, rank_delta:  0, ampel: 'gruen', alert_bottom: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, auslastung_pct: 61, rank_delta: -1, ampel: 'gelb',  alert_bottom: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, auslastung_pct: 38, rank_delta:  0, ampel: 'rot',   alert_bottom: true  },
  ],
  team_avg_pct: 65,
  bester_name: 'Julia F.',
  letzter_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function DeltaIcon({ delta }: { delta: number }) {
  if (delta < 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta > 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

function barColor(ampel: string) {
  if (ampel === 'gruen') return 'bg-blue-400';
  if (ampel === 'gelb')  return 'bg-yellow-400';
  return 'bg-red-500';
}

export function DispatchPhase5370AuslastungsBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    const res = await fetch(
      `/api/delivery/admin/fahrer-auslastungs-ranking?location_id=${locationId}`
    );
    if (!res.ok) { setData(MOCK); return; }
    setData(await res.json());
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  }, [locationId]);

  if (!data) return <div className="text-gray-400 text-sm p-4">Lade Auslastungs-Ranking…</div>;

  const maxPct = Math.max(...data.fahrer.map(f => f.auslastung_pct), 1);

  return (
    <div className="bg-gray-900 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <BarChart2 className="w-5 h-5 text-blue-400" />
        <span className="text-white font-semibold">Auslastungs-Ranking</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3 h-3" /> {data.alert_count} niedrig
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-[10px] text-gray-400">Beste/r</div>
          <div className="text-xs text-blue-400 font-medium truncate">{data.bester_name}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-[10px] text-gray-400">Team-Ø</div>
          <div className="text-xs text-blue-400 font-medium">{data.team_avg_pct}%</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-2">
          <div className="text-[10px] text-gray-400">Wenigste</div>
          <div className="text-xs text-red-400 font-medium truncate">{data.letzter_name}</div>
        </div>
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            <span className="text-[11px] text-gray-400 w-4 text-right">{f.rang}</span>
            <DeltaIcon delta={f.rank_delta} />
            <span className="text-[11px] text-white flex-1 truncate">{f.fahrer_name}</span>
            {f.alert_bottom && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
            <div className="w-20 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor(f.ampel)}`}
                style={{ width: `${Math.min(100, (f.auslastung_pct / maxPct) * 100)}%` }}
              />
            </div>
            <span className="text-[11px] text-gray-300 w-8 text-right">{f.auslastung_pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
