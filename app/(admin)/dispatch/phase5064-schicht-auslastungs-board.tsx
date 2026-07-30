'use client';

import { useEffect, useState } from 'react';
import { Activity, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  auslastung_pct: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  rang: number;
  alert_bottom: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  bester_name: string;
  niedrigster_name: string;
  alert_count: number;
  gesamt: number;
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta < 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta > 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

function ampelColor(a: string) {
  if (a === 'gruen') return 'text-green-300';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-red-400';
}

function barColor(a: string) {
  if (a === 'gruen') return 'bg-green-400';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-red-500';
}

export function DispatchPhase5064SchichtAuslastungsBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-schicht-auslastungs-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-schicht-auslastungs-ranking?location_id=mock';
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

  const bester = data.fahrer[0];
  const letzter = data.fahrer[data.fahrer.length - 1];

  return (
    <div className="rounded-2xl border border-emerald-700 bg-emerald-950/40 overflow-hidden mb-4">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-emerald-700/50 bg-emerald-900/20">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-300" />
          <span className="text-sm font-semibold text-emerald-200">Schicht-Auslastung je Fahrer (letzte 30 Tage)</span>
        </div>
        {data.alert_count > 0 && (
          <div className="flex items-center gap-1 text-xs text-red-400">
            <AlertTriangle className="w-3.5 h-3.5" />
            {data.alert_count} Niedrig-Alert
          </div>
        )}
      </div>

      {/* KPI-Grid */}
      <div className="grid grid-cols-3 divide-x divide-emerald-800/40 border-b border-emerald-700/30">
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Höchste</div>
          <div className="text-sm font-bold text-green-300">{bester?.auslastung_pct ?? '–'}%</div>
          <div className="text-[10px] text-gray-500 truncate">{bester?.fahrer_name ?? '–'}</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Team-Ø</div>
          <div className="text-sm font-bold text-emerald-200">{data.team_avg}%</div>
          <div className="text-[10px] text-gray-500">Ziel ≥75%</div>
        </div>
        <div className="px-3 py-2 text-center">
          <div className="text-[10px] text-gray-500 mb-0.5">Niedrigste</div>
          <div className="text-sm font-bold text-red-400">{letzter?.auslastung_pct ?? '–'}%</div>
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
                style={{ width: `${f.auslastung_pct}%` }}
              />
            </div>
            <span className={`text-xs font-semibold w-10 text-right shrink-0 ${ampelColor(f.ampel)}`}>
              {f.auslastung_pct}%
            </span>
            <DeltaIcon delta={f.rank_delta} />
            {f.alert_bottom && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
          </div>
        ))}
      </div>

      {/* Champion Footer */}
      <div className="px-4 py-2 border-t border-emerald-800/30 bg-emerald-900/10">
        <div className="text-[10px] text-gray-500">
          Höchste: <span className="text-green-300 font-semibold">{data.bester_name}</span> ·
          Niedrigste: <span className="text-red-400">{data.niedrigster_name}</span>
        </div>
      </div>
    </div>
  );
}
