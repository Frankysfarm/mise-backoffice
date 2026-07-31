'use client';

import { useEffect, useState } from 'react';
import { Euro, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  umsatz_avg: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_low: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'm1', fahrer_name: 'Julia F.', rang: 1, umsatz_avg: 38.00, rank_delta:  1, ampel: 'gruen', alert_low: false },
    { fahrer_id: 'm2', fahrer_name: 'Sara K.',  rang: 2, umsatz_avg: 32.00, rank_delta:  0, ampel: 'gruen', alert_low: false },
    { fahrer_id: 'm3', fahrer_name: 'Max M.',   rang: 3, umsatz_avg: 27.00, rank_delta: -1, ampel: 'gelb',  alert_low: false },
    { fahrer_id: 'm4', fahrer_name: 'Tim B.',   rang: 4, umsatz_avg: 21.00, rank_delta:  0, ampel: 'rot',   alert_low: true  },
  ],
  team_avg: 29.50,
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

export function DispatchPhase5342UmsatzBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    const res = await fetch(
      `/api/delivery/admin/fahrer-umsatz-pro-tour?location_id=${locationId}`
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

  const maxUmsatz = Math.max(...data.fahrer.map(f => f.umsatz_avg), 0.01);

  return (
    <div className="rounded-xl border border-green-700 bg-green-900/20 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Euro className="w-4 h-4 text-green-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Umsatz-Ranking Ø/Tour (30 Tage)</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3 h-3" />
            {data.alert_count} niedrig
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-green-900/40 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Beste/r</div>
          <div className="text-xs font-bold text-green-300 truncate">{data.bester_name}</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500">Team-Ø</div>
          <div className="text-xs font-bold text-green-300">€ {data.team_avg.toFixed(2)}</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Letzte/r</div>
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
                style={{ width: `${(f.umsatz_avg / maxUmsatz) * 100}%` }}
              />
            </div>
            <span className="text-xs font-bold tabular-nums text-green-300 w-14 text-right">€ {f.umsatz_avg.toFixed(2)}</span>
            <DeltaIcon delta={f.rank_delta} />
            {f.alert_low && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
          </div>
        ))}
      </div>

      <div className="mt-2 text-[9px] text-gray-600 text-right">{data.gesamt} Fahrer · Ø Umsatz absteigend · 30-Min-Polling</div>
    </div>
  );
}
