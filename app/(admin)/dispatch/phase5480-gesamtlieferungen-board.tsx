'use client';

import { useEffect, useRef, useState } from 'react';
import { Package2, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

// Phase 5480 — Gesamtlieferungen-Board (Dispatch)
// Package2 green-400; gesamt_lieferungen ABSTEIGEND Rang 1=meiste=aktivster;
// 3-KPI-Grid Aktivste/r/Team-Ø/Wenigste/r; Balken farbkodiert; DeltaIcons; Niedrig-Alert; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  gesamt_lieferungen: number;
  rank_delta: number;
  ampel: Ampel;
  alert_niedrig: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg: number;
  aktivster_name: string;
  wenigster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, gesamt_lieferungen: 312, rank_delta:  2, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, gesamt_lieferungen: 287, rank_delta:  0, ampel: 'gruen', alert_niedrig: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, gesamt_lieferungen: 215, rank_delta: -1, ampel: 'gelb',  alert_niedrig: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, gesamt_lieferungen:  98, rank_delta:  0, ampel: 'rot',   alert_niedrig: true  },
  ],
  team_avg: 228,
  aktivster_name: 'Julia F.',
  wenigster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function barColor(a: Ampel): string {
  if (a === 'rot')  return '#f87171';
  if (a === 'gelb') return '#fbbf24';
  return '#4ade80';
}

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3 w-3 text-green-400" />;
  if (d < 0) return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-gray-500" />;
}

export function DispatchPhase5480GesamtlieferungenBoard({ locationId }: { locationId: string | null }) {
  const [data, setData] = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-gesamtlieferungen-ranking?location_id=${locationId}`);
      if (r.ok) setData(await r.json());
    } catch { /* use mock */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 30 * 60_000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId]);

  const aktivster  = data.fahrer.find(f => f.rang === 1);
  const wenigster  = data.fahrer.find(f => f.rang === data.gesamt);
  const maxVal     = Math.max(...data.fahrer.map(f => f.gesamt_lieferungen), 1);

  return (
    <div className={`rounded-lg bg-gray-900 border ${data.alert_count > 0 ? 'border-green-700/60' : 'border-gray-700/50'} p-3 space-y-2.5`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Package2 className="h-3.5 w-3.5 text-green-400" />
          <span className="text-xs font-semibold text-white">Gesamtlieferungen-Ranking</span>
          {loading && <span className="text-[10px] text-gray-500 animate-pulse">…</span>}
        </div>
        {data.alert_count > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-yellow-400">
            <AlertTriangle className="h-3 w-3" />
            {data.alert_count} Niedrig
          </div>
        )}
      </div>

      {/* 3-KPI-Grid */}
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Aktivste/r</div>
          <div className="text-xs font-bold text-green-400">{aktivster ? aktivster.gesamt_lieferungen : '—'}</div>
          <div className="text-[10px] text-gray-500 truncate">{data.aktivster_name}</div>
        </div>
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Team-Ø</div>
          <div className="text-xs font-bold text-white">{data.team_avg}</div>
          <div className="text-[10px] text-gray-500">Lieferungen</div>
        </div>
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Wenigste/r</div>
          <div className="text-xs font-bold text-red-400">{wenigster ? wenigster.gesamt_lieferungen : '—'}</div>
          <div className="text-[10px] text-gray-500 truncate">{data.wenigster_name}</div>
        </div>
      </div>

      {/* Fahrerliste */}
      <div className="space-y-1">
        {data.fahrer.map(f => (
          <div key={f.fahrer_id} className="flex items-center gap-2">
            <span className="text-[10px] text-gray-500 w-4 text-right">{f.rang}</span>
            <span className="text-[10px] text-white truncate w-20">{f.fahrer_name}</span>
            <div className="flex-1 h-1.5 rounded-full bg-gray-800">
              <div
                className="h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${(f.gesamt_lieferungen / maxVal) * 100}%`, backgroundColor: barColor(f.ampel) }}
              />
            </div>
            <span className="text-[10px] font-mono text-gray-300 w-8 text-right">{f.gesamt_lieferungen}</span>
            <DeltaIcon d={f.rank_delta} />
            {f.alert_niedrig && <AlertTriangle className="h-3 w-3 text-yellow-400" />}
          </div>
        ))}
      </div>
    </div>
  );
}
