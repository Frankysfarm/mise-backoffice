'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  quote_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_quote: number;
  beste_name: string;
  schlechteste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'm1', fahrer_name: 'Julia F.', rang: 1, quote_pct: 99, rank_delta:  1, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'm2', fahrer_name: 'Sara K.',  rang: 2, quote_pct: 97, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'm3', fahrer_name: 'Max M.',   rang: 3, quote_pct: 91, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'm4', fahrer_name: 'Tim B.',   rang: 4, quote_pct: 78, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg_quote: 91,
  beste_name: 'Julia F.',
  schlechteste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

export function DispatchPhase5330StoppQuoteBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    const res = await fetch(
      `/api/delivery/admin/fahrer-stoppquoten-ranking?location_id=${locationId}`
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

  const maxPct = Math.max(...data.fahrer.map(f => f.quote_pct), 1);

  return (
    <div className="rounded-xl border border-emerald-700 bg-emerald-900/20 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Stoppquoten-Ranking (30 Tage)</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3 h-3" />
            {data.alert_count} niedrig
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-emerald-900/40 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Beste/r</div>
          <div className="text-xs font-bold text-emerald-300 truncate">{data.beste_name}</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500">Team-Ø</div>
          <div className="text-xs font-bold text-emerald-300">{data.team_avg_quote}%</div>
        </div>
        <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 truncate">Schlechteste/r</div>
          <div className="text-xs font-bold text-gray-400 truncate">{data.schlechteste_name}</div>
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
                  f.ampel === 'gruen' ? 'bg-emerald-400' :
                  f.ampel === 'gelb'  ? 'bg-yellow-400' : 'bg-red-500'
                }`}
                style={{ width: `${(f.quote_pct / maxPct) * 100}%` }}
              />
            </div>
            <span className="text-xs font-bold tabular-nums text-emerald-300 w-14 text-right">{f.quote_pct}%</span>
            <DeltaIcon delta={f.rank_delta} />
            {f.alert_niedrig && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
          </div>
        ))}
      </div>

      <div className="mt-2 text-[9px] text-gray-600 text-right">{data.gesamt} Fahrer · Stoppquote absteigend · 30-Min-Polling</div>
    </div>
  );
}
