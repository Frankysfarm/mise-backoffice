'use client';

import { useEffect, useState } from 'react';
import { Moon, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  nacht_anteil_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  meister_name: string;
  wenigster_name: string;
  alert_count: number;
  gesamt: number;
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-300';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

function barColor(a: string) {
  if (a === 'gruen') return 'bg-violet-400';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

export function DispatchPhase5091NachtAnteilBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-nacht-anteil-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-nacht-anteil-ranking';
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
  const maxVal  = bester?.nacht_anteil_pct ?? 1;

  return (
    <div className="rounded-2xl border border-violet-700 bg-violet-950/40 overflow-hidden mb-4">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-violet-700/50 bg-violet-900/20">
        <div className="flex items-center gap-2">
          <Moon className="w-4 h-4 text-violet-300" />
          <span className="text-sm font-semibold text-violet-200">Nacht-Anteil je Fahrer (letzte 30 Tage)</span>
        </div>
        {data.alert_count > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            {data.alert_count} Hoch-Alert
          </div>
        )}
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 divide-x divide-violet-800/40 border-b border-violet-700/30">
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Höchster</div>
          <div className="text-sm font-bold text-violet-300">{bester?.nacht_anteil_pct ?? '–'}%</div>
          <div className="text-[10px] text-gray-500 truncate">{bester?.fahrer_name ?? '–'}</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Team-Ø</div>
          <div className="text-sm font-bold text-violet-200">{data.team_avg_pct}%</div>
          <div className="text-[10px] text-gray-500">Nacht-Schichten</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Niedrigster</div>
          <div className="text-sm font-bold text-gray-400">{letzter?.nacht_anteil_pct ?? '–'}%</div>
          <div className="text-[10px] text-gray-500 truncate">{letzter?.fahrer_name ?? '–'}</div>
        </div>
      </div>

      {/* Ranking-Liste */}
      <div className="px-4 py-3 space-y-2.5">
        {data.fahrer.map((f) => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            <span className={`text-xs font-bold w-5 shrink-0 ${ampelColor(f.ampel)}`}>#{f.rang}</span>
            <span className="text-xs text-gray-300 truncate flex-1">{f.fahrer_name}</span>
            <div className="w-20 h-1.5 rounded-full bg-gray-800 overflow-hidden shrink-0">
              <div
                className={`h-full rounded-full ${barColor(f.ampel)}`}
                style={{ width: `${maxVal > 0 ? Math.round((f.nacht_anteil_pct / maxVal) * 100) : 0}%` }}
              />
            </div>
            <span className={`text-xs font-semibold w-10 text-right shrink-0 ${ampelColor(f.ampel)}`}>
              {f.nacht_anteil_pct}%
            </span>
            <DeltaIcon delta={f.rank_delta} />
            {f.alert_hoch && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
          </div>
        ))}
      </div>

      {/* Champion Footer */}
      <div className="px-4 py-2 border-t border-violet-800/30 bg-violet-900/10">
        <div className="text-[10px] text-gray-500">
          Meiste Nacht-Schichten: <span className="text-violet-300 font-semibold">{data.meister_name}</span> ·
          Wenigste: <span className="text-gray-400">{data.wenigster_name}</span>
        </div>
      </div>
    </div>
  );
}
