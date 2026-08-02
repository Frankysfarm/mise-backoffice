'use client';

import { useEffect, useRef, useState } from 'react';
import { Hourglass, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

// Phase 5626 — Tourdauer-Trend-Board (Dispatch) — Batch 101
// Hourglass purple; tourdauer_delta_min AUFSTEIGEND Rang 1=größte Verkürzung=bester;
// 3-KPI-Grid Schnellste/r/Team-Trend/Langsamste/r; Balken farbkodiert; DeltaIcons; Rückfall-Alert; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  tourdauer_delta_min: number;
  aktuell_avg_min: number;
  rank_delta: number;
  ampel: Ampel;
  alert_rueckfall: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_delta_min: number;
  schnellste_name: string;
  langsamste_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, tourdauer_delta_min: -4.2, aktuell_avg_min: 22.1, rank_delta:  2, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, tourdauer_delta_min: -1.8, aktuell_avg_min: 24.5, rank_delta:  0, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, tourdauer_delta_min:  0.5, aktuell_avg_min: 27.8, rank_delta: -1, ampel: 'gelb',  alert_rueckfall: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, tourdauer_delta_min:  6.3, aktuell_avg_min: 35.1, rank_delta: -1, ampel: 'rot',   alert_rueckfall: true  },
  ],
  team_avg_delta_min: 0.2,
  schnellste_name: 'Julia F.',
  langsamste_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function barColor(delta: number): string {
  if (delta < 0)  return '#a855f7'; // purple — improved (faster)
  if (delta === 0) return '#fbbf24';
  return '#f87171';
}

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3 w-3 text-emerald-400" />;
  if (d < 0) return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-gray-500" />;
}

function fmtDelta(v: number): string {
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)} min`;
}

export function DispatchPhase5626TourdauerTrendBoard({ locationId }: { locationId: string | null }) {
  const [data, setData]       = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-tourdauer-trend-ranking?location_id=${locationId}`);
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

  const schnellste = data.fahrer.find(f => f.rang === 1);
  const langsamste = data.fahrer.find(f => f.rang === data.gesamt);
  const maxAbs     = Math.max(...data.fahrer.map(f => Math.abs(f.tourdauer_delta_min)), 1);

  return (
    <div className={`rounded-lg bg-gray-900 border ${data.alert_count > 0 ? 'border-red-700/60' : 'border-purple-700/40'} p-3 space-y-2.5`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Hourglass className="h-3.5 w-3.5 text-purple-400" />
          <span className="text-xs font-semibold text-white">Tourdauer-Trend</span>
          {loading && <span className="text-[10px] text-gray-500 animate-pulse">…</span>}
        </div>
        {data.alert_count > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-red-400">
            <AlertTriangle className="h-3 w-3" />
            {data.alert_count} Rückfall
          </div>
        )}
      </div>

      {/* 3-KPI-Grid */}
      <div className="grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Schnellste/r</div>
          <div className="text-xs font-bold text-purple-400">{schnellste ? fmtDelta(schnellste.tourdauer_delta_min) : '—'}</div>
          <div className="text-[10px] text-gray-500 truncate">{data.schnellste_name}</div>
        </div>
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Team-Trend</div>
          <div className="text-xs font-bold text-white">{fmtDelta(data.team_avg_delta_min)}</div>
          <div className="text-[10px] text-gray-500">Ø 30 Tage</div>
        </div>
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Langsamste/r</div>
          <div className="text-xs font-bold text-red-400">{langsamste ? fmtDelta(langsamste.tourdauer_delta_min) : '—'}</div>
          <div className="text-[10px] text-gray-500 truncate">{data.langsamste_name}</div>
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
                style={{ width: `${(Math.abs(f.tourdauer_delta_min) / maxAbs) * 100}%`, backgroundColor: barColor(f.tourdauer_delta_min) }}
              />
            </div>
            <span className="text-[10px] font-mono text-purple-300 w-10 text-right">{f.aktuell_avg_min.toFixed(1)}m</span>
            <span className="text-[10px] font-mono text-gray-400 w-12 text-right">{fmtDelta(f.tourdauer_delta_min)}</span>
            <DeltaIcon d={f.rank_delta} />
            {f.alert_rueckfall && <AlertTriangle className="h-3 w-3 text-red-400" />}
          </div>
        ))}
      </div>
    </div>
  );
}
