'use client';

import { useEffect, useState } from 'react';
import { Clock3, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  puenktlichkeit_pct: number;
  schichten_gesamt: number;
  rank_delta: number;
  ampel: 'gruen' | 'gelb' | 'rot';
  alert_spaet: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_pct: number;
  puenktlichste_name: string | null;
  unzuverlaessigste_name: string | null;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, puenktlichkeit_pct: 95, schichten_gesamt: 22, rank_delta:  1, ampel: 'gruen', alert_spaet: false },
    { fahrer_id: 'f2', fahrer_name: 'Kemal A.', rang: 2, puenktlichkeit_pct: 88, schichten_gesamt: 18, rank_delta: -1, ampel: 'gruen', alert_spaet: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara M.',  rang: 3, puenktlichkeit_pct: 73, schichten_gesamt: 15, rank_delta:  0, ampel: 'gelb',  alert_spaet: true  },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, puenktlichkeit_pct: 54, schichten_gesamt: 13, rank_delta:  0, ampel: 'rot',   alert_spaet: true  },
  ],
  team_avg_pct: 78,
  puenktlichste_name: 'Julia F.',
  unzuverlaessigste_name: 'Tim B.',
  alert_count: 2,
  gesamt: 4,
};

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="w-3 h-3 text-green-400" />;
  if (d < 0) return <TrendingDown className="w-3 h-3 text-red-400" />;
  return <Minus className="w-3 h-3 text-gray-500" />;
}

export function DispatchPhase5303SchichtPuenktlichkeitBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse | null>(null);

  async function load() {
    if (!locationId) { setData(MOCK); return; }
    const res = await fetch(`/api/delivery/admin/fahrer-schicht-puenktlichkeit-ranking?location_id=${locationId}`).catch(() => null);
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

  const maxVal = Math.max(...data.fahrer.map(f => f.puenktlichkeit_pct), 1);

  return (
    <div className="rounded-xl border border-emerald-800/60 bg-emerald-950/20 p-4 mb-3">
      <div className="flex items-center gap-2 mb-3">
        <Clock3 className="w-4 h-4 text-emerald-400 shrink-0" />
        <span className="text-sm font-semibold text-gray-200">Schicht-Pünktlichkeit Ranking</span>
        {data.alert_count > 0 && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-red-400 bg-red-900/30 px-2 py-0.5 rounded-full">
            <AlertTriangle className="w-2.5 h-2.5" />{data.alert_count} Spät
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-lg bg-emerald-900/30 px-2 py-2 text-center">
          <div className="text-[10px] text-gray-500">Pünktlichste</div>
          <div className="text-xs font-bold text-emerald-300 truncate">{data.puenktlichste_name ?? '—'}</div>
        </div>
        <div className="rounded-lg bg-gray-800/60 px-2 py-2 text-center">
          <div className="text-[10px] text-gray-500">Team-Ø</div>
          <div className="text-base font-black text-gray-200 tabular-nums">{data.team_avg_pct}%</div>
        </div>
        <div className="rounded-lg bg-red-900/20 px-2 py-2 text-center">
          <div className="text-[10px] text-gray-500">Unpünktlichste</div>
          <div className="text-xs font-bold text-red-400 truncate">{data.unzuverlaessigste_name ?? '—'}</div>
        </div>
      </div>

      <div className="space-y-2">
        {data.fahrer.map(f => {
          const barColor =
            f.ampel === 'gruen' ? 'bg-emerald-500' :
            f.ampel === 'gelb'  ? 'bg-yellow-500' : 'bg-red-500';
          const textColor =
            f.ampel === 'gruen' ? 'text-emerald-400' :
            f.ampel === 'gelb'  ? 'text-yellow-400' : 'text-red-400';
          return (
            <div key={f.fahrer_id} className="rounded-lg bg-gray-800/40 px-3 py-2">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-[10px] text-gray-500 font-mono w-4 shrink-0">#{f.rang}</span>
                  <span className="text-xs font-semibold text-gray-200 truncate">{f.fahrer_name}</span>
                  {f.alert_spaet && <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />}
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <DeltaIcon d={f.rank_delta} />
                  <span className={`text-sm font-black tabular-nums ${textColor}`}>{f.puenktlichkeit_pct}%</span>
                </div>
              </div>
              <div className="h-1.5 rounded-full bg-gray-700 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                  style={{ width: `${maxVal > 0 ? (f.puenktlichkeit_pct / maxVal) * 100 : 0}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-[9px] text-gray-600 text-right">{data.gesamt} Fahrer · letzte 30 Tage · 30-Min-Polling</div>
    </div>
  );
}
