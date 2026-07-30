'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Clock } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  stunden_gesamt: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_hoch: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_stunden: number;
  bester_name: string;
  letzter_name: string;
  alert_count: number;
  gesamt: number;
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (delta < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-400" />;
}

function ampelColor(a: string) {
  if (a === 'rot') return 'text-violet-300';
  if (a === 'gelb') return 'text-yellow-400';
  return 'text-gray-400';
}

function barColor(a: string) {
  if (a === 'rot') return 'bg-violet-400';
  if (a === 'gelb') return 'bg-yellow-500';
  return 'bg-gray-600';
}

export function DispatchPhase4969StundenBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    const url = locationId
      ? `/api/delivery/admin/fahrer-stunden-ranking?location_id=${locationId}`
      : '/api/delivery/admin/fahrer-stunden-ranking';
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

  const maxVal = Math.max(...data.fahrer.map(f => f.stunden_gesamt), 1);

  return (
    <div className="rounded-2xl border border-violet-700 bg-violet-950/40 overflow-hidden mb-4">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-violet-700/50 bg-violet-900/20">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-violet-300" />
          <span className="text-sm font-semibold text-violet-200">Stunden-Ranking (letzte 30 Tage)</span>
        </div>
        {data.alert_count > 0 && (
          <div className="flex items-center gap-1 text-xs text-violet-300">
            <AlertTriangle className="w-3.5 h-3.5" />
            {data.alert_count} Spitzenreiter
          </div>
        )}
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-3 divide-x divide-violet-800/50 border-b border-violet-800/50">
        {[
          { label: 'Meiste',    val: `${data.fahrer[0]?.stunden_gesamt ?? '—'}h`,                              sub: data.bester_name },
          { label: 'Team-Ø',   val: `${data.team_avg_stunden ?? '—'}h`,                                       sub: `${data.gesamt} Fahrer` },
          { label: 'Wenigste', val: `${data.fahrer[data.fahrer.length - 1]?.stunden_gesamt ?? '—'}h`,         sub: data.letzter_name },
        ].map(k => (
          <div key={k.label} className="flex flex-col items-center py-3 gap-0.5">
            <span className="text-sm font-bold text-violet-100">{k.val}</span>
            <span className="text-[10px] text-violet-400">{k.label}</span>
            <span className="text-[10px] text-gray-500 truncate max-w-[80px] text-center">{k.sub}</span>
          </div>
        ))}
      </div>

      {/* Ranking — descending: Rang 1 = meiste Stunden */}
      <div className="divide-y divide-violet-900/40">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="px-4 py-2.5 flex items-center gap-3">
            <span className={`text-sm font-bold w-5 text-center ${f.rang === 1 ? 'text-violet-300' : 'text-gray-400'}`}>
              #{f.rang}
            </span>
            <span className="flex-1 text-sm text-gray-200 truncate">{f.fahrer_name}</span>
            <div className="flex items-center gap-1">
              <div className="w-20 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${barColor(f.ampel)}`}
                  style={{ width: `${(f.stunden_gesamt / maxVal) * 100}%` }}
                />
              </div>
              <span className={`text-xs font-semibold w-12 text-right ${ampelColor(f.ampel)}`}>
                {f.stunden_gesamt}h
              </span>
            </div>
            <DeltaIcon delta={f.rank_delta} />
          </div>
        ))}
      </div>

      {/* Champion Footer */}
      <div className="px-4 py-2 border-t border-violet-800/40 bg-violet-900/10">
        <span className="text-[10px] text-gray-500">
          Champion: {data.bester_name} · Ziel ≥40h/Monat · Alert bei ≥80h
        </span>
      </div>
    </div>
  );
}
