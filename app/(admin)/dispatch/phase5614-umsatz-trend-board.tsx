'use client';

import { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';

// Phase 5614 — Umsatz-Trend-Board (Dispatch)
// TrendingUp emerald-400; umsatz_delta ABSTEIGEND Rang 1=größte positive Verbesserung=bester;
// 3-KPI-Grid Beste/r/Team-Trend/Schwächste/r; Balken farbkodiert; DeltaIcons; Rückfall-Alert; 30-Min-Polling; Mock-Fallback

type Ampel = 'gruen' | 'gelb' | 'rot';

interface FahrerRow {
  fahrer_id: string;
  fahrer_name: string;
  rang: number;
  umsatz_delta: number;
  aktuell_avg: number;
  rank_delta: number;
  ampel: Ampel;
  alert_rueckfall: boolean;
}

interface ApiResponse {
  fahrer: FahrerRow[];
  team_avg_delta: number;
  bester_name: string;
  schwaechster_name: string;
  alert_count: number;
  gesamt: number;
}

const MOCK: ApiResponse = {
  fahrer: [
    { fahrer_id: 'f1', fahrer_name: 'Julia F.', rang: 1, umsatz_delta:  3.50, aktuell_avg: 28.50, rank_delta:  1, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f2', fahrer_name: 'Max M.',   rang: 2, umsatz_delta:  1.20, aktuell_avg: 24.80, rank_delta:  0, ampel: 'gruen', alert_rueckfall: false },
    { fahrer_id: 'f3', fahrer_name: 'Sara K.',  rang: 3, umsatz_delta: -0.80, aktuell_avg: 21.30, rank_delta: -1, ampel: 'gelb',  alert_rueckfall: false },
    { fahrer_id: 'f4', fahrer_name: 'Tim B.',   rang: 4, umsatz_delta: -2.40, aktuell_avg: 17.60, rank_delta:  0, ampel: 'rot',   alert_rueckfall: true  },
  ],
  team_avg_delta: 0.38,
  bester_name: 'Julia F.',
  schwaechster_name: 'Tim B.',
  alert_count: 1,
  gesamt: 4,
};

function barColor(delta: number): string {
  if (delta > 0)   return '#34d399';
  if (delta === 0) return '#fbbf24';
  return '#f87171';
}

function DeltaIcon({ d }: { d: number }) {
  if (d > 0) return <TrendingUp className="h-3 w-3 text-emerald-400" />;
  if (d < 0) return <TrendingDown className="h-3 w-3 text-red-400" />;
  return <Minus className="h-3 w-3 text-gray-500" />;
}

function fmtDelta(v: number): string {
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}€`;
}

export function DispatchPhase5614UmsatzTrendBoard({ locationId }: { locationId: string | null }) {
  const [data, setData]       = useState<ApiResponse>(MOCK);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = async () => {
    if (!locationId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/delivery/admin/fahrer-umsatz-trend-ranking?location_id=${locationId}`);
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

  const bester   = data.fahrer.find(f => f.rang === 1);
  const schwaech = data.fahrer.find(f => f.rang === data.gesamt);
  const maxAbs   = Math.max(...data.fahrer.map(f => Math.abs(f.umsatz_delta)), 0.01);

  return (
    <div className={`rounded-lg bg-gray-900 border ${data.alert_count > 0 ? 'border-red-700/60' : 'border-gray-700/50'} p-3 space-y-2.5`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-xs font-semibold text-white">Umsatz-Trend</span>
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
          <div className="text-[10px] text-gray-400">Beste/r</div>
          <div className="text-xs font-bold text-emerald-400">{bester ? fmtDelta(bester.umsatz_delta) : '—'}</div>
          <div className="text-[10px] text-gray-500 truncate">{data.bester_name}</div>
        </div>
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Team-Trend</div>
          <div className="text-xs font-bold text-white">{fmtDelta(data.team_avg_delta)}</div>
          <div className="text-[10px] text-gray-500">Ø 30 Tage</div>
        </div>
        <div className="rounded bg-gray-800 px-2 py-1.5">
          <div className="text-[10px] text-gray-400">Schwächste/r</div>
          <div className="text-xs font-bold text-red-400">{schwaech ? fmtDelta(schwaech.umsatz_delta) : '—'}</div>
          <div className="text-[10px] text-gray-500 truncate">{data.schwaechster_name}</div>
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
                style={{ width: `${(Math.abs(f.umsatz_delta) / maxAbs) * 100}%`, backgroundColor: barColor(f.umsatz_delta) }}
              />
            </div>
            <span className="text-[10px] font-mono text-emerald-300 w-12 text-right">{f.aktuell_avg.toFixed(2)}€</span>
            <span className="text-[10px] font-mono text-gray-400 w-10 text-right">{fmtDelta(f.umsatz_delta)}</span>
            <DeltaIcon d={f.rank_delta} />
            {f.alert_rueckfall && <AlertTriangle className="h-3 w-3 text-red-400" />}
          </div>
        ))}
      </div>
    </div>
  );
}
