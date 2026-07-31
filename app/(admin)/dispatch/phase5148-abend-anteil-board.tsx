'use client';

import { useEffect, useState } from 'react';
import { Moon, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  abend_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_wenig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  hoechste_name: string;
  niedrigste_name: string;
  alert_count: number;
  gesamt: number;
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-indigo-300';
  if (a === 'gelb') return 'text-blue-400';
  return 'text-gray-400';
}

function barColor(a: string) {
  if (a === 'gruen') return 'bg-indigo-400';
  if (a === 'gelb') return 'bg-blue-500';
  return 'bg-gray-500';
}

export function DispatchPhase5148AbendAnteilBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-abend-anteil-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-abend-anteil-ranking';
    const res = await fetch(url);
    if (res.ok) setData(await res.json());
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  if (!data) return null;

  const bester  = data.fahrer[0];
  const letzter = data.fahrer[data.fahrer.length - 1];

  return (
    <div className="rounded-2xl border border-indigo-800/40 bg-indigo-950/20 overflow-hidden mb-4">
      <div className="px-4 py-3 flex items-center justify-between border-b border-indigo-800/30 bg-indigo-900/10">
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-indigo-200">Abend-Anteil je Fahrer — 18–22 Uhr UTC (letzte 30 Tage)</span>
        </div>
        {data.alert_count > 0 && (
          <div className="flex items-center gap-1 text-xs text-indigo-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            {data.alert_count} Wenig-Alert
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 divide-x divide-indigo-800/30 border-b border-indigo-800/20">
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Höchster</div>
          <div className="text-sm font-bold text-indigo-300">{bester?.abend_pct ?? '–'} %</div>
          <div className="text-[10px] text-gray-500 truncate">{bester?.fahrer_name ?? '–'}</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Team-Avg</div>
          <div className="text-sm font-bold text-indigo-200">{data.team_avg} %</div>
          <div className="text-[10px] text-gray-500">Abend-Anteil</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Niedrigster</div>
          <div className="text-sm font-bold text-gray-400">{letzter?.abend_pct ?? '–'} %</div>
          <div className="text-[10px] text-gray-500 truncate">{letzter?.fahrer_name ?? '–'}</div>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2.5">
        {data.fahrer.map((f) => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            <span className={`text-xs font-bold w-5 shrink-0 ${ampelColor(f.ampel)}`}>#{f.rang}</span>
            <span className="text-xs text-gray-300 truncate flex-1">{f.fahrer_name}</span>
            <div className="w-20 h-1.5 rounded-full bg-gray-800 overflow-hidden shrink-0">
              <div
                className={`h-full rounded-full ${barColor(f.ampel)}`}
                style={{ width: `${Math.min(100, f.abend_pct)}%` }}
              />
            </div>
            <span className={`text-xs font-semibold w-10 text-right shrink-0 ${ampelColor(f.ampel)}`}>
              {f.abend_pct} %
            </span>
            <DeltaIcon delta={f.rank_delta} />
            {f.alert_wenig && <AlertTriangle className="w-3 h-3 text-indigo-400 shrink-0" />}
          </div>
        ))}
      </div>

      <div className="px-4 py-2 border-t border-indigo-800/20 bg-indigo-900/5">
        <div className="text-[10px] text-gray-500">
          Höchster: <span className="text-indigo-300 font-semibold">{data.hoechste_name}</span> ·
          Niedrigster: <span className="text-gray-400">{data.niedrigste_name}</span>
        </div>
      </div>
    </div>
  );
}
